package routes

import (
	"net/http"

	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/utils"
	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logs"
	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/system"
)

// HandleSystemLogs handles requests for system logs listing
func (h *Handler) HandleSystemLogs(w http.ResponseWriter, r *http.Request) {
	utils.EnableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	logSizes, err := logs.GetLogSizes(h.config.AccessPath)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.RespondJSON(w, http.StatusOK, logSizes)
}

// HandleSystemResources handles requests for system resource statistics
func (h *Handler) HandleSystemResources(w http.ResponseWriter, r *http.Request) {
	utils.EnableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if !h.config.SystemMonitoring {
		utils.RespondError(w, http.StatusForbidden, "System monitoring is disabled")
		return
	}

	stats, err := system.MeasureSystem()
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.RespondJSON(w, http.StatusOK, stats)
}
