package routes

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/utils"
	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logs"
)

// HandleAccessLogs handles requests for access logs
func (h *Handler) HandleAccessLogs(w http.ResponseWriter, r *http.Request) {
	utils.EnableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Get query parameters
	position := utils.GetQueryParamInt64(r, "position", -2) // -2 means use tracked position
	lines := utils.GetQueryParamInt(r, "lines", 1000)
	tail := utils.GetQueryParamBool(r, "tail", false)

	// Check if path exists
	fileInfo, err := os.Stat(h.config.AccessPath)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var result logs.LogResult

	if fileInfo.IsDir() {
		// For directories, get logs from all files
		if tail || position == -2 {
			// First request or tail mode - get last N lines
			positions := []logs.Position{}
			result, err = logs.GetLogs(h.config.AccessPath, positions, false, false)
		} else {
			// Use provided position
			positions := []logs.Position{{Position: position}}
			result, err = logs.GetLogs(h.config.AccessPath, positions, false, false)
		}
	} else {
		// Single file
		trackedPos := h.state.GetFilePosition(h.config.AccessPath)

		// Determine position to use
		var usePosition int64
		if position == -2 {
			// Use tracked position
			usePosition = trackedPos
		} else if position == -1 || tail {
			// Tail mode requested
			usePosition = -1
		} else {
			// Use provided position
			usePosition = position
		}

		positions := []logs.Position{{Position: usePosition}}
		result, err = logs.GetLogs(h.config.AccessPath, positions, false, false)

		// Update tracked position if we got results
		if err == nil && len(result.Positions) > 0 {
			h.state.SetFilePosition(h.config.AccessPath, result.Positions[0].Position)
		}
	}

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Limit the number of logs returned
	if len(result.Logs) > lines {
		// Keep only the most recent logs
		startIdx := len(result.Logs) - lines
		result.Logs = result.Logs[startIdx:]
	}

	utils.RespondJSON(w, http.StatusOK, result)
}

// HandleErrorLogs handles requests for error logs
func (h *Handler) HandleErrorLogs(w http.ResponseWriter, r *http.Request) {
	utils.EnableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	position := utils.GetQueryParamInt64(r, "position", -2)
	lines := utils.GetQueryParamInt(r, "lines", 100)
	tail := utils.GetQueryParamBool(r, "tail", false)

	fileInfo, err := os.Stat(h.config.ErrorPath)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var result logs.LogResult

	if fileInfo.IsDir() {
		if tail || position == -2 {
			positions := []logs.Position{}
			result, err = logs.GetLogs(h.config.ErrorPath, positions, true, false)
		} else {
			positions := []logs.Position{{Position: position}}
			result, err = logs.GetLogs(h.config.ErrorPath, positions, true, false)
		}
	} else {
		trackedPos := h.state.GetFilePosition(h.config.ErrorPath)

		var usePosition int64
		if position == -2 {
			usePosition = trackedPos
		} else if position == -1 || tail {
			usePosition = -1
		} else {
			usePosition = position
		}

		positions := []logs.Position{{Position: usePosition}}
		result, err = logs.GetLogs(h.config.ErrorPath, positions, true, false)

		if err == nil && len(result.Positions) > 0 {
			h.state.SetFilePosition(h.config.ErrorPath, result.Positions[0].Position)
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

// HandleGetLog handles requests for a specific log file
func (h *Handler) HandleGetLog(w http.ResponseWriter, r *http.Request) {
	utils.EnableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	filename := utils.GetQueryParam(r, "filename", "")
	if filename == "" {
		utils.RespondError(w, http.StatusBadRequest, "filename parameter is required")
		return
	}

	position := utils.GetQueryParamInt64(r, "position", 0)
	lines := utils.GetQueryParamInt(r, "lines", 100)

	fullPath := filepath.Join(h.config.AccessPath, filename)

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
