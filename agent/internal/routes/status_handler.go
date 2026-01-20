package routes

import (
	"net/http"
	"os"

	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/utils"
)

// HandleStatus handles health check requests
func (h *Handler) HandleStatus(w http.ResponseWriter, r *http.Request) {
	accessPathExists := false
	if info, err := os.Stat(h.config.AccessPath); err == nil {
		accessPathExists = true
		if info.IsDir() {
			entries, _ := os.ReadDir(h.config.AccessPath)
			if len(entries) == 0 {
				accessPathExists = false
			}
		}
	}

	errorPathExists := false
	if info, err := os.Stat(h.config.ErrorPath); err == nil {
		errorPathExists = true
		if info.IsDir() {
			entries, _ := os.ReadDir(h.config.ErrorPath)
			if len(entries) == 0 {
				errorPathExists = false
			}
		}
	}

	status := map[string]interface{}{
		"status":             "ok",
		"access_path":        h.config.AccessPath,
		"access_path_exists": accessPathExists,
		"error_path":         h.config.ErrorPath,
		"error_path_exists":  errorPathExists,
		"system_monitoring":  h.config.SystemMonitoring,
		"auth_enabled":       h.config.AuthToken != "",
	}

	utils.RespondJSON(w, http.StatusOK, status)
}
