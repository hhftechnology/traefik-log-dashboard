package utils

import (
	"encoding/json"
	"net/http"
	"strconv"
)

// RespondJSON sends a JSON response with the given status code
func RespondJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

// RespondError sends a JSON error response
func RespondError(w http.ResponseWriter, statusCode int, message string) {
	RespondJSON(w, statusCode, map[string]string{
		"error": message,
	})
}

// GetQueryParam retrieves a query parameter from the request
func GetQueryParam(r *http.Request, key, defaultValue string) string {
	value := r.URL.Query().Get(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// GetQueryParamInt retrieves an integer query parameter from the request
func GetQueryParamInt(r *http.Request, key string, defaultValue int) int {
	value := r.URL.Query().Get(key)
	if value == "" {
		return defaultValue
	}
	
	intValue, err := strconv.Atoi(value)
	if err != nil {
		return defaultValue
	}
	
	return intValue
}

// GetQueryParamInt64 retrieves an int64 query parameter from the request
func GetQueryParamInt64(r *http.Request, key string, defaultValue int64) int64 {
	value := r.URL.Query().Get(key)
	if value == "" {
		return defaultValue
	}
	
	int64Value, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return defaultValue
	}
	
	return int64Value
}

// GetQueryParamBool retrieves a boolean query parameter from the request
func GetQueryParamBool(r *http.Request, key string, defaultValue bool) bool {
	value := r.URL.Query().Get(key)
	if value == "" {
		return defaultValue
	}

	boolValue, err := strconv.ParseBool(value)
	if err != nil {
		return defaultValue
	}

	return boolValue
}