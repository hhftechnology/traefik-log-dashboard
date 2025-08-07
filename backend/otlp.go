package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"go.opentelemetry.io/collector/pdata/pcommon"
	"go.opentelemetry.io/collector/pdata/ptrace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

type OTLPReceiver struct {
	grpcServer     *grpc.Server
	httpServer     *http.Server
	logParser      *LogParser
	grpcPort       int
	httpPort       int
	enabled        bool
	stopChan       chan struct{}
	isRunning      bool
	
	// Statistics
	tracesReceived    int64
	spansProcessed    int64
	errorCount       int64
}

type OTLPConfig struct {
	Enabled    bool   `json:"enabled"`
	GRPCPort   int    `json:"grpcPort"`
	HTTPPort   int    `json:"httpPort"`
	GRPCAddr   string `json:"grpcAddr"`
	HTTPAddr   string `json:"httpAddr"`
}

func NewOTLPReceiver(logParser *LogParser, config OTLPConfig) *OTLPReceiver {
	return &OTLPReceiver{
		logParser:         logParser,
		grpcPort:          config.GRPCPort,
		httpPort:          config.HTTPPort,
		enabled:           config.Enabled,
		stopChan:          make(chan struct{}),
		isRunning:         false,
		tracesReceived:    0,
		spansProcessed:    0,
		errorCount:       0,
	}
}

func (r *OTLPReceiver) Start() error {
	if !r.enabled {
		log.Println("[OTLP] OTLP receiver is disabled")
		return nil
	}

	if r.isRunning {
		log.Println("[OTLP] OTLP receiver is already running")
		return nil
	}

	log.Printf("[OTLP] Starting OTLP receiver - GRPC:%d, HTTP:%d", r.grpcPort, r.httpPort)

	// Start GRPC server
	if err := r.startGRPCServer(); err != nil {
		return fmt.Errorf("failed to start GRPC server: %v", err)
	}

	// Start HTTP server  
	if err := r.startHTTPServer(); err != nil {
		return fmt.Errorf("failed to start HTTP server: %v", err)
	}

	r.isRunning = true
	log.Println("[OTLP] OTLP receiver started successfully")
	return nil
}

func (r *OTLPReceiver) Stop() error {
	if !r.enabled || !r.isRunning {
		return nil
	}

	log.Println("[OTLP] Stopping OTLP receiver...")
	close(r.stopChan)
	r.isRunning = false

	// Stop GRPC server
	if r.grpcServer != nil {
		r.grpcServer.GracefulStop()
		r.grpcServer = nil
	}

	// Stop HTTP server
	if r.httpServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := r.httpServer.Shutdown(ctx); err != nil {
			log.Printf("[OTLP] HTTP server shutdown error: %v", err)
		}
		r.httpServer = nil
	}

	log.Println("[OTLP] OTLP receiver stopped")
	return nil
}

func (r *OTLPReceiver) startGRPCServer() error {
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", r.grpcPort))
	if err != nil {
		return err
	}

	r.grpcServer = grpc.NewServer()
	
	// Register OTLP trace service (placeholder for now)
	r.registerTraceService()
	
	// Enable reflection for debugging
	reflection.Register(r.grpcServer)

	go func() {
		if err := r.grpcServer.Serve(lis); err != nil {
			log.Printf("[OTLP] GRPC server error: %v", err)
		}
	}()

	log.Printf("[OTLP] GRPC server listening on :%d", r.grpcPort)
	return nil
}

func (r *OTLPReceiver) startHTTPServer() error {
	mux := http.NewServeMux()
	
	// Register OTLP HTTP endpoints
	mux.HandleFunc("/v1/traces", r.handleHTTPTraces)
	mux.HandleFunc("/health", r.handleHealth)
	mux.HandleFunc("/", r.handleRoot) // For debugging
	
	r.httpServer = &http.Server{
		Addr:    fmt.Sprintf(":%d", r.httpPort),
		Handler: r.corsMiddleware(mux),
	}

	go func() {
		if err := r.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[OTLP] HTTP server error: %v", err)
		}
	}()

	log.Printf("[OTLP] HTTP server listening on :%d", r.httpPort)
	return nil
}

func (r *OTLPReceiver) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		if req.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next.ServeHTTP(w, req)
	})
}

func (r *OTLPReceiver) registerTraceService() {
	// In a full implementation, you would register the OTLP trace service here
	// This would implement the OpenTelemetry protobuf service definitions
	log.Println("[OTLP] GRPC trace service registered (placeholder implementation)")
}

func (r *OTLPReceiver) handleHTTPTraces(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	log.Printf("[OTLP] Received HTTP trace request from %s, Content-Type: %s, Content-Length: %s", 
		req.RemoteAddr, req.Header.Get("Content-Type"), req.Header.Get("Content-Length"))

	// Read request body
	body, err := io.ReadAll(req.Body)
	if err != nil {
		log.Printf("[OTLP] Error reading request body: %v", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		r.errorCount++
		return
	}
	defer req.Body.Close()

	if len(body) == 0 {
		log.Printf("[OTLP] Received empty body")
		http.Error(w, "Empty body", http.StatusBadRequest)
		r.errorCount++
		return
	}

	log.Printf("[OTLP] Received %d bytes of trace data", len(body))
	r.tracesReceived++

	// Parse the OTLP protobuf data
	if err := r.processOTLPProtobuf(req.RemoteAddr, body); err != nil {
		log.Printf("[OTLP] Error processing OTLP data: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		r.errorCount++
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status": "success", "message": "Traces received"}`))
}

// Process real OTLP protobuf data from Traefik
func (r *OTLPReceiver) processOTLPProtobuf(remoteAddr string, body []byte) error {
	// Parse the OTLP traces protobuf
	unmarshaler := ptrace.ProtoUnmarshaler{}
	traces, err := unmarshaler.UnmarshalTraces(body)
	if err != nil {
		log.Printf("[OTLP] Failed to unmarshal traces: %v", err)
		return err
	}

	resourceSpansCount := traces.ResourceSpans().Len()
	log.Printf("[OTLP] Successfully parsed %d resource spans", resourceSpansCount)
	
	if resourceSpansCount == 0 {
		log.Printf("[OTLP] No resource spans found in trace data")
		return nil
	}
	
	// Process each span and convert to log entries
	return r.processOTLPSpans(traces)
}

// Enhanced OTLP span processing with full protobuf support
func (r *OTLPReceiver) processOTLPSpans(traces ptrace.Traces) error {
	processedCount := 0
	
	for i := 0; i < traces.ResourceSpans().Len(); i++ {
		resourceSpan := traces.ResourceSpans().At(i)
		resource := resourceSpan.Resource()
		
		// Log resource attributes for debugging
		if GetEnvBool("OTLP_DEBUG", false) {
			log.Printf("[OTLP] Resource attributes: %v", r.attributesToMap(resource.Attributes()))
		}
		
		for j := 0; j < resourceSpan.ScopeSpans().Len(); j++ {
			scopeSpan := resourceSpan.ScopeSpans().At(j)
			
			for k := 0; k < scopeSpan.Spans().Len(); k++ {
				span := scopeSpan.Spans().At(k)
				
				// Log span attributes for debugging
				if GetEnvBool("OTLP_DEBUG", false) {
					log.Printf("[OTLP] Span '%s' attributes: %v", span.Name(), r.attributesToMap(span.Attributes()))
				}
				
				// Convert span to log entry
				logEntry := r.spanToLogEntry(span, resource)
				
				// Process through existing pipeline
				r.logParser.ProcessOTLPLogEntry(logEntry)
				processedCount++
				r.spansProcessed++
			}
		}
	}
	
	log.Printf("[OTLP] Processed %d spans successfully", processedCount)
	return nil
}

// Enhanced span to log entry conversion with comprehensive attribute mapping
func (r *OTLPReceiver) spanToLogEntry(span ptrace.Span, resource pcommon.Resource) LogEntry {
	attrs := span.Attributes()
	resourceAttrs := resource.Attributes()
	
	// Extract HTTP attributes from span (Traefik uses these specific attributes)
	httpMethod := r.getStringAttr(attrs, "http.method", r.getStringAttr(attrs, "http.request.method", "GET"))
	httpURL := r.getStringAttr(attrs, "http.url", "")
	httpTarget := r.getStringAttr(attrs, "http.target", r.getStringAttr(attrs, "url.path", ""))
	httpStatusCode := r.getIntAttr(attrs, "http.status_code", r.getIntAttr(attrs, "http.response.status_code", 200))
	httpUserAgent := r.getStringAttr(attrs, "http.user_agent", r.getStringAttr(attrs, "user_agent.original", ""))
	httpClientIP := r.getStringAttr(attrs, "http.client_ip", r.getStringAttr(attrs, "client.address", "unknown"))
	httpHost := r.getStringAttr(attrs, "http.host", r.getStringAttr(attrs, "server.address", ""))
	httpScheme := r.getStringAttr(attrs, "http.scheme", r.getStringAttr(attrs, "url.scheme", "https"))
	
	// Extract server/network information
	serverPort := r.getIntAttr(attrs, "server.port", r.getIntAttr(attrs, "http.server.port", 80))
	clientPort := r.getIntAttr(attrs, "client.port", 0)
	
	// Extract service information from resource
	serviceName := r.getStringAttr(resourceAttrs, "service.name", r.getStringAttr(attrs, "service.name", "unknown"))
	serviceVersion := r.getStringAttr(resourceAttrs, "service.version", "")
	serviceInstanceId := r.getStringAttr(resourceAttrs, "service.instance.id", "")
	
	// Extract Traefik-specific attributes
	traefikService := r.getStringAttr(attrs, "traefik.service", serviceName)
	traefikRouter := r.getStringAttr(attrs, "traefik.router", r.getStringAttr(attrs, "http.route", fmt.Sprintf("%s-router", serviceName)))
	
	// Calculate response time from span duration
	durationNs := span.EndTimestamp().AsTime().Sub(span.StartTimestamp().AsTime()).Nanoseconds()
	responseTimeMs := float64(durationNs) / 1e6 // Convert to milliseconds
	
	// Build request path
	path := httpTarget
	if path == "" && httpURL != "" {
		// Parse URL to extract path
		if idx := strings.Index(httpURL, "://"); idx != -1 {
			remaining := httpURL[idx+3:]
			if pathIdx := strings.Index(remaining, "/"); pathIdx != -1 {
				path = remaining[pathIdx:]
			} else {
				path = "/"
			}
		}
	}
	if path == "" {
		path = "/" 
	}
	
	// Determine host
	host := httpHost
	if host == "" && httpURL != "" {
		if idx := strings.Index(httpURL, "://"); idx != -1 {
			remaining := httpURL[idx+3:]
			if pathIdx := strings.Index(remaining, "/"); pathIdx != -1 {
				host = remaining[:pathIdx]
			} else {
				host = remaining
			}
		}
	}
	
	// Extract response size
	responseSize := r.getIntAttr(attrs, "http.response.body.size", 
		r.getIntAttr(attrs, "http.response_content_length", 0))
	
	// Extract request size  
	requestSize := r.getIntAttr(attrs, "http.request.body.size",
		r.getIntAttr(attrs, "http.request_content_length", 0))
	
	// Extract span metadata
	spanStatus := span.Status()
	spanName := span.Name()
	
	// Build log entry with proper Traefik mapping
	logEntry := LogEntry{
		ID:           fmt.Sprintf("otlp-%s", span.SpanID().String()),
		Timestamp:    span.StartTimestamp().AsTime().Format(time.RFC3339),
		ClientIP:     r.extractClientIP(httpClientIP),
		Method:       httpMethod,
		Path:         path,
		Status:       httpStatusCode,
		ResponseTime: responseTimeMs,
		ServiceName:  traefikService,
		RouterName:   traefikRouter,
		Host:         host,
		RequestAddr:  r.buildRequestAddr(host, serverPort),
		RequestHost:  host,
		UserAgent:    httpUserAgent,
		Size:         responseSize,
		
		// OpenTelemetry specific fields
		TraceId:      span.TraceID().String(),
		SpanId:       span.SpanID().String(),
		Duration:     durationNs,
		StartUTC:     span.StartTimestamp().AsTime().UTC().Format(time.RFC3339),
		StartLocal:   span.StartTimestamp().AsTime().Format(time.RFC3339),
		
		// Additional metadata
		DataSource:      "otlp",
		OTLPReceiveTime: time.Now().Format(time.RFC3339),
		RequestProtocol: "HTTP",
		RequestScheme:   httpScheme,
		RequestPort:     strconv.Itoa(serverPort),
		ClientPort:      strconv.Itoa(clientPort),
		
		// Request/response details
		RequestLine:        fmt.Sprintf("%s %s HTTP/1.1", httpMethod, path),
		RequestContentSize: requestSize,
		
		// Service metadata from resource attributes
		ServiceURL:    r.buildServiceURL(serviceName, serviceVersion),
		ServiceAddr:   serviceInstanceId,
		
		// Span status and performance
		OriginStatus:     int(spanStatus.Code()),
		DownstreamStatus: httpStatusCode,
		RequestCount:     1,
		
		// TLS information if available
		TLSVersion: r.getStringAttr(attrs, "tls.version", ""),
		
		// Performance metrics
		Overhead: r.calculateOverhead(span, attrs),
	}
	
	log.Printf("[OTLP] Converted span '%s' to log entry: %s %s %d (%.2fms)", 
		spanName, httpMethod, path, httpStatusCode, responseTimeMs)
	
	return logEntry
}

// Helper function to extract client IP from various sources
func (r *OTLPReceiver) extractClientIP(httpClientIP string) string {
	if httpClientIP != "" && httpClientIP != "unknown" {
		// Handle IPv6 addresses in brackets
		if strings.HasPrefix(httpClientIP, "[") {
			if match := strings.Index(httpClientIP, "]"); match != -1 {
				return httpClientIP[1:match]
			}
		}
		
		// Handle IPv4 with port
		if strings.Contains(httpClientIP, ".") && strings.Contains(httpClientIP, ":") {
			if lastColon := strings.LastIndex(httpClientIP, ":"); lastColon != -1 {
				return httpClientIP[:lastColon]
			}
		}
		
		return httpClientIP
	}
	return "unknown"
}

// Helper function to calculate span overhead
func (r *OTLPReceiver) calculateOverhead(span ptrace.Span, attrs pcommon.Map) int64 {
	// Calculate overhead as the difference between total duration and actual processing time
	totalDuration := span.EndTimestamp().AsTime().Sub(span.StartTimestamp().AsTime()).Nanoseconds()
	
	// Look for processing time in attributes
	processingTime := r.getInt64Attr(attrs, "http.processing_time", 0)
	if processingTime > 0 {
		return totalDuration - processingTime
	}
	
	// Default minimal overhead
	return totalDuration / 100 // 1% overhead estimate
}

// Helper function to build request address with proper port handling
func (r *OTLPReceiver) buildRequestAddr(host string, port int) string {
	if host == "" {
		return ""
	}
	
	// If host already has port, return as is
	if strings.Contains(host, ":") {
		return host
	}
	
	// Add port if not default
	if port != 80 && port != 443 {
		return fmt.Sprintf("%s:%d", host, port)
	}
	
	return host
}

// Helper function to build service URL
func (r *OTLPReceiver) buildServiceURL(serviceName, serviceVersion string) string {
	if serviceName == "" {
		return ""
	}
	if serviceVersion != "" {
		return fmt.Sprintf("%s:%s", serviceName, serviceVersion)
	}
	return serviceName
}

// Enhanced attribute getters with type safety
func (r *OTLPReceiver) getInt64Attr(attrs pcommon.Map, key string, defaultValue int64) int64 {
	if val, ok := attrs.Get(key); ok {
		return val.Int()
	}
	return defaultValue
}

// Helper functions to extract attributes safely
func (r *OTLPReceiver) getStringAttr(attrs pcommon.Map, key, defaultValue string) string {
	if val, ok := attrs.Get(key); ok {
		return val.Str()
	}
	return defaultValue
}

func (r *OTLPReceiver) getIntAttr(attrs pcommon.Map, key string, defaultValue int) int {
	if val, ok := attrs.Get(key); ok {
		return int(val.Int())
	}
	return defaultValue
}

// Helper function to convert attributes to map for debugging
func (r *OTLPReceiver) attributesToMap(attrs pcommon.Map) map[string]interface{} {
	result := make(map[string]interface{})
	attrs.Range(func(k string, v pcommon.Value) bool {
		switch v.Type() {
		case pcommon.ValueTypeStr:
			result[k] = v.Str()
		case pcommon.ValueTypeInt:
			result[k] = v.Int()
		case pcommon.ValueTypeDouble:
			result[k] = v.Double()
		case pcommon.ValueTypeBool:
			result[k] = v.Bool()
		default:
			result[k] = v.AsString()
		}
		return true
	})
	return result
}

func (r *OTLPReceiver) handleHealth(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf(`{
		"status": "healthy", 
		"service": "otlp-receiver",
		"running": %t,
		"tracesReceived": %d,
		"spansProcessed": %d,
		"errors": %d
	}`, r.isRunning, r.tracesReceived, r.spansProcessed, r.errorCount)))
}

func (r *OTLPReceiver) handleRoot(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf(`{
		"service": "Traefik Dashboard OTLP Receiver",
		"version": "1.0.0",
		"endpoints": {
			"traces": "/v1/traces",
			"health": "/health"
		},
		"config": {
			"grpcPort": %d,
			"httpPort": %d,
			"enabled": %t,
			"running": %t
		},
		"stats": {
			"tracesReceived": %d,
			"spansProcessed": %d,
			"errors": %d
		}
	}`, r.grpcPort, r.httpPort, r.enabled, r.isRunning, 
		r.tracesReceived, r.spansProcessed, r.errorCount)))
}

// Configuration validation and status methods
func (r *OTLPReceiver) IsRunning() bool {
	return r.enabled && r.isRunning && r.grpcServer != nil && r.httpServer != nil
}

func (r *OTLPReceiver) GetConfig() OTLPConfig {
	return OTLPConfig{
		Enabled:  r.enabled,
		GRPCPort: r.grpcPort,
		HTTPPort: r.httpPort,
		GRPCAddr: fmt.Sprintf("0.0.0.0:%d", r.grpcPort),
		HTTPAddr: fmt.Sprintf("0.0.0.0:%d", r.httpPort),
	}
}

func (r *OTLPReceiver) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"enabled":         r.enabled,
		"grpcPort":        r.grpcPort,
		"httpPort":        r.httpPort,
		"running":         r.IsRunning(),
		"tracesReceived":  r.tracesReceived,
		"spansProcessed":  r.spansProcessed,
		"errorCount":      r.errorCount,
		"timestamp":       time.Now().Format(time.RFC3339),
	}
}

// Get OTLP configuration from environment
func GetOTLPConfig() OTLPConfig {
	enabled := GetEnvBool("OTLP_ENABLED", false)
	grpcPort := GetEnvInt("OTLP_GRPC_PORT", 4317)  // Standard OTLP GRPC port
	httpPort := GetEnvInt("OTLP_HTTP_PORT", 4318)  // Standard OTLP HTTP port
	
	return OTLPConfig{
		Enabled:  enabled,
		GRPCPort: grpcPort,
		HTTPPort: httpPort,
		GRPCAddr: fmt.Sprintf("0.0.0.0:%d", grpcPort),
		HTTPAddr: fmt.Sprintf("0.0.0.0:%d", httpPort),
	}
}

// Helper functions for environment variables
func GetEnvBool(key string, defaultValue bool) bool {
	if value := GetEnvString(key, ""); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func GetEnvInt(key string, defaultValue int) int {
	if value := GetEnvString(key, ""); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func GetEnvString(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}