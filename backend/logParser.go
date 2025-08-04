package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

)

type LogEntry struct {
	ID                      string  `json:"id"`
	Timestamp               string  `json:"timestamp"`
	ClientIP                string  `json:"clientIP"`
	Method                  string  `json:"method"`
	Path                    string  `json:"path"`
	Status                  int     `json:"status"`
	ResponseTime            float64 `json:"responseTime"`
	ServiceName             string  `json:"serviceName"`
	RouterName              string  `json:"routerName"`
	Host                    string  `json:"host"`
	RequestAddr             string  `json:"requestAddr"`
	RequestHost             string  `json:"requestHost"`
	UserAgent               string  `json:"userAgent"`
	Size                    int     `json:"size"`
	Country                 *string `json:"country"`
	City                    *string `json:"city"`
	CountryCode             *string `json:"countryCode"`
	Lat                     *float64 `json:"lat"`
	Lon                     *float64 `json:"lon"`
	
	// Additional fields from the original
	StartUTC                string  `json:"StartUTC,omitempty"`
	StartLocal              string  `json:"StartLocal,omitempty"`
	Duration                int64   `json:"Duration,omitempty"`
	ServiceURL              string  `json:"ServiceURL,omitempty"`
	ServiceAddr             string  `json:"ServiceAddr,omitempty"`
	ClientHost              string  `json:"ClientHost,omitempty"`
	ClientPort              string  `json:"ClientPort,omitempty"`
	ClientUsername          string  `json:"ClientUsername,omitempty"`
	RequestPort             string  `json:"RequestPort,omitempty"`
	RequestProtocol         string  `json:"RequestProtocol,omitempty"`
	RequestScheme           string  `json:"RequestScheme,omitempty"`
	RequestLine             string  `json:"RequestLine,omitempty"`
	RequestContentSize      int     `json:"RequestContentSize,omitempty"`
	OriginDuration          int64   `json:"OriginDuration,omitempty"`
	OriginContentSize       int     `json:"OriginContentSize,omitempty"`
	OriginStatus            int     `json:"OriginStatus,omitempty"`
	DownstreamStatus        int     `json:"DownstreamStatus,omitempty"`
	RequestCount            int     `json:"RequestCount,omitempty"`
	GzipRatio               float64 `json:"GzipRatio,omitempty"`
	Overhead                int64   `json:"Overhead,omitempty"`
	RetryAttempts           int     `json:"RetryAttempts,omitempty"`
	TLSVersion              string  `json:"TLSVersion,omitempty"`
	TLSCipher               string  `json:"TLSCipher,omitempty"`
	TLSClientSubject        string  `json:"TLSClientSubject,omitempty"`
	TraceId                 string  `json:"TraceId,omitempty"`
	SpanId                  string  `json:"SpanId,omitempty"`
}

type RawLogEntry map[string]interface{}

type Stats struct {
	TotalRequests          int                    `json:"totalRequests"`
	StatusCodes            map[int]int            `json:"statusCodes"`
	Services               map[string]int         `json:"services"`
	Routers                map[string]int         `json:"routers"`
	Methods                map[string]int         `json:"methods"`
	AvgResponseTime        float64                `json:"avgResponseTime"`
	Requests5xx            int                    `json:"requests5xx"`
	Requests4xx            int                    `json:"requests4xx"`
	Requests2xx            int                    `json:"requests2xx"`
	RequestsPerSecond      int                    `json:"requestsPerSecond"`
	TopIPs                 []IPCount              `json:"topIPs"`
	Countries              map[string]int         `json:"countries"`
	TopCountries           []CountryCount         `json:"topCountries"`
	TopRouters             []RouterCount          `json:"topRouters"`
	TopRequestAddrs        []AddrCount            `json:"topRequestAddrs"`
	TopRequestHosts        []HostCount            `json:"topRequestHosts"`
	GeoProcessingRemaining int                    `json:"geoProcessingRemaining"`
	TotalDataTransmitted   int64                  `json:"totalDataTransmitted"`
	OldestLogTime          string                 `json:"oldestLogTime"`
	NewestLogTime          string                 `json:"newestLogTime"`
	AnalysisPeriod         string                 `json:"analysisPeriod"`
}

type IPCount struct {
	IP    string `json:"ip"`
	Count int    `json:"count"`
}

type CountryCount struct {
	Country     string `json:"country"`
	CountryCode string `json:"countryCode"`
	Count       int    `json:"count"`
}

type RouterCount struct {
	Router string `json:"router"`
	Count  int    `json:"count"`
}

type AddrCount struct {
	Addr  string `json:"addr"`
	Count int    `json:"count"`
}

type HostCount struct {
	Host  string `json:"host"`
	Count int    `json:"count"`
}

type LogsParams struct {
	Page    int     `json:"page"`
	Limit   int     `json:"limit"`
	Filters Filters `json:"filters"`
}

type Filters struct {
	Service        string `json:"service"`
	Status         string `json:"status"`
	Router         string `json:"router"`
	HideUnknown    bool   `json:"hideUnknown"`
	HidePrivateIPs bool   `json:"hidePrivateIPs"`
}

type LogsResult struct {
	Logs       []LogEntry `json:"logs"`
	Total      int        `json:"total"`
	Page       int        `json:"page"`
	TotalPages int        `json:"totalPages"`
}

type GeoStats struct {
	Countries              []CountryCount `json:"countries"`
	TotalCountries         int            `json:"totalCountries"`
	GeoProcessingRemaining int            `json:"geoProcessingRemaining"`
}

type LogParser struct {
	logs                  []LogEntry
	maxLogs               int
	fileWatcher           *FileWatcher
	stats                 Stats
	lastTimestamp         time.Time
	requestsInLastSecond  int
	geoProcessingQueue    []string
	processedIPs          map[string]bool
	isProcessingGeo       bool
	mu                    sync.RWMutex
	listeners             []chan LogEntry
	topIPs                map[string]int
	topRouters            map[string]int
	topRequestAddrs       map[string]int
	topRequestHosts       map[string]int
	totalDataTransmitted  int64
	oldestLogTime         time.Time
	newestLogTime         time.Time
	stopChan              chan struct{}
	geoStopChan           chan struct{}
}

func NewLogParser() *LogParser {
	return &LogParser{
		logs:            make([]LogEntry, 0),
		maxLogs:         10000,
		stats:           Stats{
			StatusCodes:     make(map[int]int),
			Services:        make(map[string]int),
			Routers:         make(map[string]int),
			Methods:         make(map[string]int),
			Countries:       make(map[string]int),
		},
		lastTimestamp:        time.Now(),
		geoProcessingQueue:   make([]string, 0),
		processedIPs:         make(map[string]bool),
		listeners:            make([]chan LogEntry, 0),
		topIPs:               make(map[string]int),
		topRouters:           make(map[string]int),
		topRequestAddrs:      make(map[string]int),
		topRequestHosts:      make(map[string]int),
		totalDataTransmitted: 0,
		oldestLogTime:        time.Time{},
		newestLogTime:        time.Time{},
		stopChan:             make(chan struct{}),
		geoStopChan:          make(chan struct{}),
	}
}

func (lp *LogParser) Stop() {
	close(lp.stopChan)
	close(lp.geoStopChan)
	
	if lp.fileWatcher != nil {
		lp.fileWatcher.Stop()
	}
	
	// Clean up listeners
	lp.mu.Lock()
	for _, ch := range lp.listeners {
		close(ch)
	}
	lp.listeners = nil
	lp.mu.Unlock()
}

func (lp *LogParser) SetLogFiles(logPaths []string) error {
	// Stop existing file watcher
	if lp.fileWatcher != nil {
		lp.fileWatcher.Stop()
		lp.fileWatcher = nil
	}

	log.Printf("Setting up monitoring for log file(s): %v", logPaths)

	// Only use the first log file
	if len(logPaths) > 0 {
		fw, err := NewFileWatcher(logPaths[0], lp)
		if err != nil {
			return fmt.Errorf("failed to create file watcher: %v", err)
		}
		lp.fileWatcher = fw
		
		// Load only last 1000 lines for initial history
		lp.loadRecentLogs(logPaths[0], 1000)
		
		// Start file watching
		if err := fw.Start(); err != nil {
			return fmt.Errorf("failed to start file watcher: %v", err)
		}
	}

	// Start geo processing
	go lp.startGeoProcessing()

	return nil
}

func (lp *LogParser) loadRecentLogs(filePath string, maxLines int) {
	file, err := os.Open(filePath)
	if err != nil {
		log.Printf("Error opening file %s: %v", filePath, err)
		return
	}
	defer file.Close()

	// Get file size
	stat, err := file.Stat()
	if err != nil {
		return
	}

	// Start from end and read backwards to get last N lines
	var lines []string
	var offset int64 = stat.Size()
	bufferSize := int64(8192)
	
	for len(lines) < maxLines && offset > 0 {
		if offset < bufferSize {
			bufferSize = offset
		}
		offset -= bufferSize
		
		buffer := make([]byte, bufferSize)
		_, err := file.ReadAt(buffer, offset)
		if err != nil && err != io.EOF {
			break
		}
		
		// Process buffer in reverse
		content := string(buffer)
		newLines := strings.Split(content, "\n")
		
		// Prepend to lines slice
		if len(lines) > 0 && len(newLines) > 0 {
			// Handle partial line at boundary
			lines[0] = newLines[len(newLines)-1] + lines[0]
			if len(newLines) > 1 {
				lines = append(newLines[:len(newLines)-1], lines...)
			}
		} else {
			lines = append(newLines, lines...)
		}
		
		if len(lines) > maxLines {
			lines = lines[len(lines)-maxLines:]
			break
		}
	}

	// Parse the lines
	log.Printf("Loading last %d log entries from %s", len(lines), filePath)
	for _, line := range lines {
		if strings.TrimSpace(line) != "" {
			lp.parseLine(line, false)
		}
	}
}

func determineClientAddr(raw map[string]interface{}) string {
    if v := getStringValue(raw, "request_X-Forwarded-For", ""); v != "" {
        return v
    }
    if v := getStringValue(raw, "request_Cf-Connecting-Ip", ""); v != "" {
        return v
    }
    return getStringValue(raw, "ClientAddr", "")
}

func (lp *LogParser) parseLine(line string, emit bool) {
	if strings.TrimSpace(line) == "" {
		return
	}

	var raw RawLogEntry
	if err := json.Unmarshal([]byte(line), &raw); err != nil {
		return // Ignore non-JSON lines
	}


	logEntry := LogEntry{
		ID:           fmt.Sprintf("%d-%d", time.Now().UnixNano(), len(lp.logs)),
		Timestamp:    getStringValue(raw, "time", time.Now().Format(time.RFC3339)),
		ClientIP:     lp.extractIP(determineClientAddr(raw)),
		Method:       getStringValue(raw, "RequestMethod", "GET"),
		Path:         getStringValue(raw, "RequestPath", ""),
		Status:       getIntValue(raw, "DownstreamStatus", 0),
		ResponseTime: getFloatValue(raw, "Duration", 0) / 1e6, // Convert nanoseconds to ms
		ServiceName:  getStringValue(raw, "ServiceName", "unknown"),
		RouterName:   getStringValue(raw, "RouterName", "unknown"),
		Host:         getStringValue(raw, "RequestHost", ""),
		RequestAddr:  getStringValue(raw, "RequestAddr", ""),
		RequestHost:  getStringValue(raw, "RequestHost", ""),
		UserAgent:    getStringValue(raw, "request_User-Agent", ""),
		Size:         getIntValue(raw, "DownstreamContentSize", 0),
		
		// Additional fields
		StartUTC:           getStringValue(raw, "StartUTC", ""),
		StartLocal:         getStringValue(raw, "StartLocal", ""),
		Duration:           getInt64Value(raw, "Duration", 0),
		ServiceURL:         getStringValue(raw, "ServiceURL", ""),
		ServiceAddr:        getStringValue(raw, "ServiceAddr", ""),
		ClientHost:         getStringValue(raw, "ClientHost", ""),
		ClientPort:         getStringValue(raw, "ClientPort", ""),
		ClientUsername:     getStringValue(raw, "ClientUsername", ""),
		RequestPort:        getStringValue(raw, "RequestPort", ""),
		RequestProtocol:    getStringValue(raw, "RequestProtocol", ""),
		RequestScheme:      getStringValue(raw, "RequestScheme", ""),
		RequestLine:        getStringValue(raw, "RequestLine", ""),
		RequestContentSize: getIntValue(raw, "RequestContentSize", 0),
		OriginDuration:     getInt64Value(raw, "OriginDuration", 0),
		OriginContentSize:  getIntValue(raw, "OriginContentSize", 0),
		OriginStatus:       getIntValue(raw, "OriginStatus", 0),
		DownstreamStatus:   getIntValue(raw, "DownstreamStatus", 0),
		RequestCount:       getIntValue(raw, "RequestCount", 0),
		GzipRatio:          getFloatValue(raw, "GzipRatio", 0),
		Overhead:           getInt64Value(raw, "Overhead", 0),
		RetryAttempts:      getIntValue(raw, "RetryAttempts", 0),
		TLSVersion:         getStringValue(raw, "TLSVersion", ""),
		TLSCipher:          getStringValue(raw, "TLSCipher", ""),
		TLSClientSubject:   getStringValue(raw, "TLSClientSubject", ""),
		TraceId:            getStringValue(raw, "TraceId", ""),
		SpanId:             getStringValue(raw, "SpanId", ""),
	}

	// Try to get geolocation from cache immediately
	if logEntry.ClientIP != "unknown" && !lp.isPrivateIP(logEntry.ClientIP) {
		if geoData := GetGeoLocationFromCache(logEntry.ClientIP); geoData != nil {
			logEntry.Country = &geoData.Country
			logEntry.City = &geoData.City
			logEntry.CountryCode = &geoData.CountryCode
			logEntry.Lat = &geoData.Lat
			logEntry.Lon = &geoData.Lon
		}
	}

	lp.updateStats(&logEntry)

	lp.mu.Lock()
	// Add log to the main logs slice
	lp.logs = append([]LogEntry{logEntry}, lp.logs...)
	if len(lp.logs) > lp.maxLogs {
		lp.logs = lp.logs[:lp.maxLogs]
	}

	// Add to geo processing queue if needed and not in cache
	if logEntry.ClientIP != "unknown" && !lp.isPrivateIP(logEntry.ClientIP) && logEntry.Country == nil {
		if !lp.processedIPs[logEntry.ClientIP] {
			lp.geoProcessingQueue = append(lp.geoProcessingQueue, logEntry.ClientIP)
			lp.processedIPs[logEntry.ClientIP] = true
		}
	}
	lp.mu.Unlock()

	if emit {
		lp.notifyListeners(logEntry)
	}
}

func (lp *LogParser) ClearLogs() {
	lp.mu.Lock()
	defer lp.mu.Unlock()

	log.Println("Clearing all logs and stats")
	
	// Clear logs
	lp.logs = make([]LogEntry, 0)
	
	// Reset stats
	lp.stats = Stats{
		StatusCodes:     make(map[int]int),
		Services:        make(map[string]int),
		Routers:         make(map[string]int),
		Methods:         make(map[string]int),
		Countries:       make(map[string]int),
	}
	
	// Reset counters
	lp.topIPs = make(map[string]int)
	lp.topRouters = make(map[string]int)
	lp.topRequestAddrs = make(map[string]int)
	lp.topRequestHosts = make(map[string]int)
	lp.requestsInLastSecond = 0
	
	// Reset data tracking
	lp.totalDataTransmitted = 0
	lp.oldestLogTime = time.Time{}
	lp.newestLogTime = time.Time{}
	
	// Clear geo processing data
	lp.geoProcessingQueue = make([]string, 0)
	lp.processedIPs = make(map[string]bool)
	
	// Notify listeners of the clear
	for _, listener := range lp.listeners {
		select {
		case listener <- LogEntry{ID: "CLEAR"}:
		default:
		}
	}
}

func (lp *LogParser) extractIP(clientAddr string) string {
	if clientAddr == "" {
		return "unknown"
	}

	// Handle IPv6 addresses in brackets
	if strings.HasPrefix(clientAddr, "[") {
		if match := strings.Index(clientAddr, "]"); match != -1 {
			return clientAddr[1:match]
		}
	}

	// Handle IPv4 with port
	if strings.Contains(clientAddr, ".") && strings.Contains(clientAddr, ":") {
		if lastColon := strings.LastIndex(clientAddr, ":"); lastColon != -1 {
			return clientAddr[:lastColon]
		}
	}

	// Handle IPv6 without brackets
	if strings.Contains(clientAddr, ":") && !strings.Contains(clientAddr, ".") {
		return clientAddr
	}

	return clientAddr
}

func (lp *LogParser) isPrivateIP(ip string) bool {
	if ip == "" || ip == "unknown" {
		return true
	}

	parts := strings.Split(ip, ".")
	if len(parts) != 4 {
		return false
	}

	return ip == "127.0.0.1" ||
		ip == "localhost" ||
		strings.HasPrefix(ip, "::") ||
		ip == "::1" ||
		parts[0] == "10" ||
		(parts[0] == "172" && isInRange(parts[1], 16, 31)) ||
		(parts[0] == "192" && parts[1] == "168") ||
		(parts[0] == "169" && parts[1] == "254")
}

func isInRange(s string, min, max int) bool {
	n, err := strconv.Atoi(s)
	if err != nil {
		return false
	}
	return n >= min && n <= max
}

func (lp *LogParser) updateStats(log *LogEntry) {
	lp.mu.Lock()
	defer lp.mu.Unlock()

	lp.stats.TotalRequests++

	statusGroup := log.Status / 100
	lp.stats.StatusCodes[log.Status]++

	switch statusGroup {
	case 2:
		lp.stats.Requests2xx++
	case 4:
		lp.stats.Requests4xx++
	case 5:
		lp.stats.Requests5xx++
	}

	if log.ServiceName != "" && log.ServiceName != "unknown" {
		lp.stats.Services[log.ServiceName]++
	}
	if log.RouterName != "" && log.RouterName != "unknown" {
		lp.stats.Routers[log.RouterName]++
	}
	lp.stats.Methods[log.Method]++

	if log.ClientIP != "" && log.ClientIP != "unknown" {
		lp.topIPs[log.ClientIP]++
	}

	if log.RouterName != "" && log.RouterName != "unknown" {
		lp.topRouters[log.RouterName]++
	}

	if log.RequestAddr != "" {
		lp.topRequestAddrs[log.RequestAddr]++
	}

	if log.RequestHost != "" {
		lp.topRequestHosts[log.RequestHost]++
	}

	// Update country stats if already geolocated
	if log.Country != nil && log.CountryCode != nil {
		key := fmt.Sprintf("%s|%s", *log.CountryCode, *log.Country)
		lp.stats.Countries[key]++
	}

	// Update total data transmitted
	lp.totalDataTransmitted += int64(log.Size)
	
	// Parse timestamp and update oldest/newest
	if timestamp, err := time.Parse(time.RFC3339, log.Timestamp); err == nil {
		if lp.oldestLogTime.IsZero() || timestamp.Before(lp.oldestLogTime) {
			lp.oldestLogTime = timestamp
		}
		if lp.newestLogTime.IsZero() || timestamp.After(lp.newestLogTime) {
			lp.newestLogTime = timestamp
		}
	}

	// Update average response time
	totalResponseTime := 0.0
	count := 0
	for i := range lp.logs {
		if i < 100 { // Only calculate for last 100 logs for performance
			totalResponseTime += lp.logs[i].ResponseTime
			count++
		}
	}
	if count > 0 {
		lp.stats.AvgResponseTime = totalResponseTime / float64(count)
	}

	// Update requests per second
	now := time.Now()
	if now.Sub(lp.lastTimestamp) >= time.Second {
		lp.stats.RequestsPerSecond = lp.requestsInLastSecond
		lp.requestsInLastSecond = 0
		lp.lastTimestamp = now
	}
	lp.requestsInLastSecond++
}

func (lp *LogParser) GetStats() Stats {
	lp.mu.RLock()
	defer lp.mu.RUnlock()

	stats := lp.stats
	stats.GeoProcessingRemaining = len(lp.geoProcessingQueue)

	// Add new fields
	stats.TotalDataTransmitted = lp.totalDataTransmitted
	
	// Format timestamps
	if !lp.oldestLogTime.IsZero() {
		stats.OldestLogTime = lp.oldestLogTime.Format(time.RFC3339)
	}
	if !lp.newestLogTime.IsZero() {
		stats.NewestLogTime = lp.newestLogTime.Format(time.RFC3339)
	}
	
	// Calculate analysis period
	if !lp.oldestLogTime.IsZero() && !lp.newestLogTime.IsZero() {
		duration := lp.newestLogTime.Sub(lp.oldestLogTime)
		if duration < time.Minute {
			stats.AnalysisPeriod = fmt.Sprintf("%.0f seconds", duration.Seconds())
		} else if duration < time.Hour {
			stats.AnalysisPeriod = fmt.Sprintf("%.1f minutes", duration.Minutes())
		} else if duration < 24*time.Hour {
			stats.AnalysisPeriod = fmt.Sprintf("%.1f hours", duration.Hours())
		} else {
			stats.AnalysisPeriod = fmt.Sprintf("%.1f days", duration.Hours()/24)
		}
	}

	// Get top IPs
	stats.TopIPs = getTopItems(lp.topIPs, 10, func(k string, v int) IPCount {
		return IPCount{IP: k, Count: v}
	})

	// Get ALL countries for the map
	countries := make([]CountryCount, 0)
	for key, count := range lp.stats.Countries {
		parts := strings.Split(key, "|")
		if len(parts) == 2 {
			countries = append(countries, CountryCount{
				CountryCode: parts[0],
				Country:     parts[1],
				Count:       count,
			})
		}
	}
	sort.Slice(countries, func(i, j int) bool {
		return countries[i].Count > countries[j].Count
	})
	stats.TopCountries = countries

	// Get top routers
	stats.TopRouters = getTopItems(lp.topRouters, 10, func(k string, v int) RouterCount {
		return RouterCount{Router: k, Count: v}
	})

	// Get top request addresses
	stats.TopRequestAddrs = getTopItems(lp.topRequestAddrs, 10, func(k string, v int) AddrCount {
		return AddrCount{Addr: k, Count: v}
	})

	// Get top request hosts
	stats.TopRequestHosts = getTopItems(lp.topRequestHosts, 10, func(k string, v int) HostCount {
		return HostCount{Host: k, Count: v}
	})

	stats.AvgResponseTime = math.Round(stats.AvgResponseTime*100) / 100

	return stats
}

func (lp *LogParser) GetLogs(params LogsParams) LogsResult {
	lp.mu.RLock()
	filteredLogs := make([]LogEntry, 0, len(lp.logs))
	
	for _, log := range lp.logs {
		// Apply filters
		if params.Filters.Service != "" && log.ServiceName != params.Filters.Service {
			continue
		}
		if params.Filters.Status != "" {
			if status, err := strconv.Atoi(params.Filters.Status); err == nil && log.Status != status {
				continue
			}
		}
		if params.Filters.Router != "" && log.RouterName != params.Filters.Router {
			continue
		}
		if params.Filters.HideUnknown && (log.ServiceName == "unknown" || log.RouterName == "unknown") {
			continue
		}
		if params.Filters.HidePrivateIPs && lp.isPrivateIP(log.ClientIP) {
			continue
		}
		
		filteredLogs = append(filteredLogs, log)
	}
	lp.mu.RUnlock()

	// Pagination
	start := (params.Page - 1) * params.Limit
	end := start + params.Limit
	if end > len(filteredLogs) {
		end = len(filteredLogs)
	}
	if start > len(filteredLogs) {
		start = len(filteredLogs)
	}

	paginatedLogs := filteredLogs[start:end]

	// Try to geolocate logs without location data (on-demand for display)
	for i := range paginatedLogs {
		if paginatedLogs[i].Country == nil && paginatedLogs[i].ClientIP != "" && !lp.isPrivateIP(paginatedLogs[i].ClientIP) {
			geoData := GetGeoLocation(paginatedLogs[i].ClientIP)
			if geoData != nil {
				paginatedLogs[i].Country = &geoData.Country
				paginatedLogs[i].City = &geoData.City
				paginatedLogs[i].CountryCode = &geoData.CountryCode
				paginatedLogs[i].Lat = &geoData.Lat
				paginatedLogs[i].Lon = &geoData.Lon
			}
		}
	}

	return LogsResult{
		Logs:       paginatedLogs,
		Total:      len(filteredLogs),
		Page:       params.Page,
		TotalPages: int(math.Ceil(float64(len(filteredLogs)) / float64(params.Limit))),
	}
}

func (lp *LogParser) GetServices() []string {
	lp.mu.RLock()
	defer lp.mu.RUnlock()

	services := make([]string, 0, len(lp.stats.Services))
	for service := range lp.stats.Services {
		services = append(services, service)
	}
	sort.Strings(services)
	return services
}

func (lp *LogParser) GetRouters() []string {
	lp.mu.RLock()
	defer lp.mu.RUnlock()

	routers := make([]string, 0, len(lp.stats.Routers))
	for router := range lp.stats.Routers {
		routers = append(routers, router)
	}
	sort.Strings(routers)
	return routers
}

func (lp *LogParser) GetGeoStats() GeoStats {
	lp.mu.RLock()
	defer lp.mu.RUnlock()

	countries := make([]CountryCount, 0)
	for key, count := range lp.stats.Countries {
		parts := strings.Split(key, "|")
		if len(parts) == 2 {
			countries = append(countries, CountryCount{
				CountryCode: parts[0],
				Country:     parts[1],
				Count:       count,
			})
		}
	}
	sort.Slice(countries, func(i, j int) bool {
		return countries[i].Count > countries[j].Count
	})

	return GeoStats{
		Countries:              countries,
		TotalCountries:         len(countries),
		GeoProcessingRemaining: len(lp.geoProcessingQueue),
	}
}

func (lp *LogParser) IsProcessingGeo() bool {
	lp.mu.RLock()
	defer lp.mu.RUnlock()
	return lp.isProcessingGeo
}

func (lp *LogParser) startGeoProcessing() {
	lp.mu.Lock()
	if lp.isProcessingGeo {
		lp.mu.Unlock()
		return
	}
	lp.isProcessingGeo = true
	lp.mu.Unlock()

	log.Println("Starting background geo processing...")

	for {
		select {
		case <-lp.geoStopChan:
			log.Println("Geo processing stopped")
			return
		default:
			lp.mu.Lock()
			if len(lp.geoProcessingQueue) == 0 {
				lp.isProcessingGeo = false
				lp.mu.Unlock()
				time.Sleep(5 * time.Second) // Wait before checking again
				continue
			}

			// Process up to 40 IPs at a time
			batchSize := 40
			if len(lp.geoProcessingQueue) < batchSize {
				batchSize = len(lp.geoProcessingQueue)
			}
			ipBatch := lp.geoProcessingQueue[:batchSize]
			lp.geoProcessingQueue = lp.geoProcessingQueue[batchSize:]
			lp.mu.Unlock()

			// Process each IP in the batch
			for _, ip := range ipBatch {
				geoData := GetGeoLocation(ip)
				if geoData != nil {
					lp.mu.Lock()
					
					// Update country stats
					key := fmt.Sprintf("%s|%s", geoData.CountryCode, geoData.Country)
					
					// Update all logs with this IP
					updatedCount := 0
					for i := range lp.logs {
						if lp.logs[i].ClientIP == ip && lp.logs[i].Country == nil {
							lp.logs[i].Country = &geoData.Country
							lp.logs[i].City = &geoData.City
							lp.logs[i].CountryCode = &geoData.CountryCode
							lp.logs[i].Lat = &geoData.Lat
							lp.logs[i].Lon = &geoData.Lon
							updatedCount++
						}
					}
					
					if updatedCount > 0 {
						lp.stats.Countries[key] += updatedCount
					}
					
					lp.mu.Unlock()
				}
			}

			log.Printf("Processed geo data for %d IPs. %d IPs remaining in queue.", len(ipBatch), len(lp.geoProcessingQueue))

			// Rate limit - only if there are more IPs to process
			if len(lp.geoProcessingQueue) > 0 {
				time.Sleep(60 * time.Second)
			}
		}
	}
}

func (lp *LogParser) AddListener(ch chan LogEntry) {
	lp.mu.Lock()
	defer lp.mu.Unlock()
	lp.listeners = append(lp.listeners, ch)
}

func (lp *LogParser) RemoveListener(ch chan LogEntry) {
	lp.mu.Lock()
	defer lp.mu.Unlock()
	for i, listener := range lp.listeners {
		if listener == ch {
			lp.listeners = append(lp.listeners[:i], lp.listeners[i+1:]...)
			break
		}
	}
}

func (lp *LogParser) notifyListeners(log LogEntry) {
	lp.mu.RLock()
	listeners := make([]chan LogEntry, len(lp.listeners))
	copy(listeners, lp.listeners)
	lp.mu.RUnlock()
	
	for _, listener := range listeners {
		select {
		case listener <- log:
		default:
			// Don't block if listener is not ready
		}
	}
}

// Helper functions
func getStringValue(m map[string]interface{}, key, defaultValue string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return defaultValue
}

func getIntValue(m map[string]interface{}, key string, defaultValue int) int {
	if v, ok := m[key]; ok {
		switch v := v.(type) {
		case float64:
			return int(v)
		case int:
			return v
		case string:
			if i, err := strconv.Atoi(v); err == nil {
				return i
			}
		}
	}
	return defaultValue
}

func getInt64Value(m map[string]interface{}, key string, defaultValue int64) int64 {
	if v, ok := m[key]; ok {
		switch v := v.(type) {
		case float64:
			return int64(v)
		case int64:
			return v
		case string:
			if i, err := strconv.ParseInt(v, 10, 64); err == nil {
				return i
			}
		}
	}
	return defaultValue
}

func getFloatValue(m map[string]interface{}, key string, defaultValue float64) float64 {
	if v, ok := m[key]; ok {
		switch v := v.(type) {
		case float64:
			return v
		case int:
			return float64(v)
		case string:
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				return f
			}
		}
	}
	return defaultValue
}

func getTopItems[T any](items map[string]int, limit int, converter func(string, int) T) []T {
	type kv struct {
		Key   string
		Value int
	}

	var sorted []kv
	for k, v := range items {
		sorted = append(sorted, kv{k, v})
	}
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Value > sorted[j].Value
	})

	result := make([]T, 0, limit)
	for i := 0; i < limit && i < len(sorted); i++ {
		result = append(result, converter(sorted[i].Key, sorted[i].Value))
	}
	return result
}
