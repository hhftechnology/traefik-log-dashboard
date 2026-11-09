package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/utils"
	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logger"
	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logs"
)

// HandleAccessLogs handles requests for access logs.
func (h *Handler) HandleAccessLogs(w http.ResponseWriter, r *http.Request) {
	h.handleLogs(w, r, h.config.AccessPath, false, 1000)
}

// HandleErrorLogs handles requests for error logs.
func (h *Handler) HandleErrorLogs(w http.ResponseWriter, r *http.Request) {
	h.handleLogs(w, r, h.config.ErrorPath, true, 100)
}

// handleLogs is the shared implementation for access and error log retrieval.
func (h *Handler) handleLogs(w http.ResponseWriter, r *http.Request, path string, isErrorLog bool, defaultLines int) {
	position := utils.GetQueryParamInt64(r, "position", -2) // -2 means use tracked position
	lines := utils.GetQueryParamInt(r, "lines", defaultLines)
	tail := utils.GetQueryParamBool(r, "tail", false)

	fileInfo, err := os.Stat(path)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var result logs.LogResult

	if fileInfo.IsDir() {
		if tail || position == -2 {
			positions := []logs.Position{}
			result, err = logs.GetLogsWithLimit(path, positions, isErrorLog, false, lines)
		} else {
			positions := []logs.Position{{Position: position}}
			result, err = logs.GetLogsWithLimit(path, positions, isErrorLog, false, lines)
		}
	} else {
		trackedPos := h.state.GetFilePosition(path)

		var usePosition int64
		if position == -2 {
			usePosition = trackedPos
			// Fallback to tail when stuck at EOF (no new data would be returned)
			if trackedPos >= 0 && fileInfo.Size() > 0 && trackedPos >= fileInfo.Size() {
				usePosition = -1
			}
		} else if position == -1 || tail {
			usePosition = -1
		} else {
			usePosition = position
		}

		positions := []logs.Position{{Position: usePosition}}
		result, err = logs.GetLogsWithLimit(path, positions, isErrorLog, false, lines)

		if err == nil && len(result.Positions) > 0 {
			h.state.SetFilePosition(path, result.Positions[0].Position)
		}
	}

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if len(result.Logs) > lines {
		startIdx := len(result.Logs) - lines
		result.Logs = result.Logs[startIdx:]
	}

	utils.RespondJSON(w, http.StatusOK, result)
}

// resolveLogFilename joins filename onto base and rejects paths that escape base.
func resolveLogFilename(base, filename string) (string, error) {
	if filename == "" || strings.Contains(filename, "\x00") {
		return "", fmt.Errorf("invalid filename")
	}

	cleaned := filepath.Clean(filename)
	if cleaned == "." || filepath.IsAbs(cleaned) || cleaned == ".." || strings.HasPrefix(cleaned, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("invalid filename")
	}

	root := filepath.Clean(base)
	full := filepath.Join(root, cleaned)
	rel, err := filepath.Rel(root, full)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("invalid filename")
	}
	return full, nil
}

// HandleGetLog handles requests for a specific log file
func (h *Handler) HandleGetLog(w http.ResponseWriter, r *http.Request) {
	filename := utils.GetQueryParam(r, "filename", "")
	if filename == "" {
		utils.RespondError(w, http.StatusBadRequest, "filename parameter is required")
		return
	}

	position := utils.GetQueryParamInt64(r, "position", 0)
	lines := utils.GetQueryParamInt(r, "lines", 100)

	fullPath, err := resolveLogFilename(h.config.AccessPath, filename)
	if err != nil {
		utils.RespondError(w, http.StatusBadRequest, "invalid filename")
		return
	}

	positions := []logs.Position{{Position: position, Filename: filename}}
	result, err := logs.GetLogs(fullPath, positions, false, false)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if len(result.Logs) > lines {
		result.Logs = result.Logs[:lines]
	}

	utils.RespondJSON(w, http.StatusOK, result)
}

// HandleStreamAccessLogs streams access logs over SSE with light batching/backpressure.
func (h *Handler) HandleStreamAccessLogs(w http.ResponseWriter, r *http.Request) {
	if h.streamClients.Load() >= int32(h.config.StreamMaxClients) {
		utils.RespondError(w, http.StatusServiceUnavailable, "too many streaming clients")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		utils.RespondError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	h.streamClients.Add(1)
	defer h.streamClients.Add(-1)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ctx := r.Context()
	requestedPos := utils.GetQueryParamInt64(r, "position", -2)
	startPos := h.state.GetFilePosition(h.config.AccessPath)
	switch {
	case requestedPos == -1:
		if fileInfo, err := os.Stat(h.config.AccessPath); err == nil && !fileInfo.IsDir() {
			startPos = fileInfo.Size()
		} else {
			startPos = 0
		}
	case requestedPos >= 0:
		startPos = requestedPos
	}
	if startPos < 0 {
		startPos = 0
	}
	currentPos := startPos

	flushInterval := time.Duration(h.config.StreamFlushIntervalMS) * time.Millisecond
	ticker := time.NewTicker(flushInterval)
	defer ticker.Stop()

	maxDuration := time.Duration(h.config.StreamMaxDurationSec) * time.Second
	timeout := time.NewTimer(maxDuration)
	defer timeout.Stop()

	// Initial comment to establish stream
	if _, err := w.Write([]byte(": stream-start\n\n")); err == nil {
		flusher.Flush()
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-timeout.C:
			_, _ = w.Write([]byte("event: end\ndata: stream timeout\n\n"))
			flusher.Flush()
			return
		case <-ticker.C:
			streamedLogs, nextPos, err := logs.StreamFromPosition(ctx, h.config.AccessPath, currentPos, h.config.StreamBatchLines, h.config.StreamMaxBytesPerBatch)
			if err != nil && err != context.Canceled {
				logger.Log.Printf("stream error: %v", err)
				utils.RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			if len(streamedLogs) == 0 {
				_, _ = w.Write([]byte(": keep-alive\n\n"))
				flusher.Flush()
				continue
			}

			var builder strings.Builder
			bytesUsed := 0
			maxBytes := h.config.StreamMaxBytesPerBatch
			if maxBytes <= 0 {
				maxBytes = 512 * 1024
			}

			for _, log := range streamedLogs {
				jsonBytes, jsonErr := json.Marshal(log)
				if jsonErr != nil {
					continue
				}
				entry := "event: log\n" + "data: " + string(jsonBytes) + "\n\n"
				if bytesUsed+len(entry)+1 > maxBytes {
					logger.Log.Printf("stream batch truncated at %d bytes", bytesUsed)
					break
				}
				builder.WriteString(entry)
				bytesUsed += len(entry)
			}

			if builder.Len() > 0 {
				if _, err := w.Write([]byte(builder.String())); err != nil {
					return
				}
				if _, err := w.Write([]byte(fmt.Sprintf("event: cursor\ndata: {\"position\":%d}\n\n", nextPos))); err != nil {
					return
				}
				flusher.Flush()
			}

			currentPos = nextPos
			h.state.SetFilePosition(h.config.AccessPath, currentPos)
		}
	}
}
