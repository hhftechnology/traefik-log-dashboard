package routes

import (
	"encoding/json"
	"net/http"

	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/utils"
	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/location"
)

// HandleLocationLookup handles requests for IP geolocation lookups
func (h *Handler) HandleLocationLookup(w http.ResponseWriter, r *http.Request) {
	utils.EnableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Only allow POST requests for location lookups
	if r.Method != http.MethodPost {
		utils.RespondError(w, http.StatusMethodNotAllowed, "Only POST method is allowed")
		return
	}

	// Check if GeoIP is enabled
	if !h.config.GeoIPEnabled {
		utils.RespondError(w, http.StatusForbidden, "GeoIP lookups are disabled")
		return
	}

	// Check if location services are available
	if !location.LocationsEnabled() {
		utils.RespondError(w, http.StatusServiceUnavailable, "GeoIP databases not available")
		return
	}

	// Parse request body - expecting array of IP addresses
	var request struct {
		IPs []string `json:"ips"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate request
	if len(request.IPs) == 0 {
		utils.RespondError(w, http.StatusBadRequest, "No IP addresses provided")
		return
	}

	// Limit to 1000 IPs per request to prevent abuse
	if len(request.IPs) > 1000 {
		utils.RespondError(w, http.StatusBadRequest, "Too many IP addresses (max 1000)")
		return
	}

	// Perform location lookups
	locations, err := location.ResolveLocations(request.IPs)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Return results
	response := map[string]interface{}{
		"locations": locations,
		"count":     len(locations),
	}

	utils.RespondJSON(w, http.StatusOK, response)
}

// HandleLocationStatus returns the status of the GeoIP service
func (h *Handler) HandleLocationStatus(w http.ResponseWriter, r *http.Request) {
	utils.EnableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	status := map[string]interface{}{
		"enabled":    h.config.GeoIPEnabled,
		"available":  location.LocationsEnabled(),
		"city_db":    h.config.GeoIPCityDB,
		"country_db": h.config.GeoIPCountryDB,
	}

	utils.RespondJSON(w, http.StatusOK, status)
}
