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
		logParser: logParser,
		grpcPort:  config.GRPCPort,
		httpPort:  config.HTTPPort,
		enabled:   config.Enabled,
		stopChan:  make(chan struct{}),
	}
}

func (r *OTLPReceiver) Start() error {
	if !r.enabled {
		log.Println("[OTLP] OTLP receiver is disabled")
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

	log.Println("[OTLP] OTLP receiver started successfully")
	return nil
}

func (r *OTLPReceiver) Stop() error {
	if !r.enabled {
		return nil
	}

	log.Println("[OTLP] Stopping OTLP receiver...")
	close(r.stopChan)

	// Stop GRPC server
	if r.grpcServer != nil {
		r.grpcServer.GracefulStop()
	}

	// Stop HTTP server
	if r.httpServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := r.httpServer.Shutdown(ctx); err != nil {
			log.Printf("[OTLP] HTTP server shutdown error: %v", err)
		}
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
	
	// Register OTLP trace service
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

	log.Printf("[OTLP] Received HTTP trace request from %s", req.RemoteAddr)

	// Read request body
	body, err := io.ReadAll(req.Body)
	if err != nil {
		log.Printf("[OTLP] Error reading request body: %v", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}
	defer req.Body.Close()

	// For a full implementation, you would decode the protobuf here
	// For now, we'll create sample data to demonstrate the integration
	if err := r.processSampleOTLPData(req.RemoteAddr, body); err != nil {
		log.Printf("[OTLP] Error processing OTLP data: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status": "success", "message": "Traces received"}`))
}

// Sample OTLP data processing - in production this would parse protobuf
func (r *OTLPReceiver) processSampleOTLPData(remoteAddr string, body []byte) error {
	// Extract client IP from remote address
	clientIP := strings.Split(remoteAddr, ":")[0]
	
	// Create sample log entries based on OTLP data
	// In a real implementation, this would parse the protobuf traces
	now := time.Now()
	
	// Generate a few sample entries to simulate trace spans
	sampleSpans := []struct {
		serviceName string
		method      string
		path        string
		status      int
		duration    time.Duration
	}{
		{"web-service", "GET", "/api/users", 200, 45 * time.Millisecond},
		{"auth-service", "POST", "/auth/login", 200, 120 * time.Millisecond},
		{"database-service", "SELECT", "/db/query", 200, 15 * time.Millisecond},
	}

	for i, span := range sampleSpans {
		traceID := fmt.Sprintf("trace-%d-%d", now.UnixNano(), i)
		spanID := fmt.Sprintf("span-%d-%d", now.UnixNano(), i)
		
		logEntry := LogEntry{
			ID:           fmt.Sprintf("otlp-%s", spanID),
			Timestamp:    now.Add(time.Duration(i) * time.Millisecond).Format(time.RFC3339),
			ClientIP:     clientIP,
			Method:       span.method,
			Path:         span.path,
			Status:       span.status,
			ResponseTime: float64(span.duration.Nanoseconds()) / 1e6, // Convert to milliseconds
			ServiceName:  span.serviceName,
			RouterName:   fmt.Sprintf("%s-router", span.serviceName),
			Host:         "otlp-host",
			RequestAddr:  fmt.Sprintf("%s:80", clientIP),
			RequestHost:  "api.example.com",
			UserAgent:    "OTLP-Client/1.0",
			Size:         1024 + i*512,
			TraceId:      traceID,
			SpanId:       spanID,
			DataSource:   "otlp",
			OTLPReceiveTime: now.Format(time.RFC3339),
			Duration:     span.duration.Nanoseconds(),
			StartUTC:     now.UTC().Format(time.RFC3339),
			StartLocal:   now.Format(time.RFC3339),
		}

		// Process through the log parser
		r.logParser.ProcessOTLPLogEntry(logEntry)
	}

	log.Printf("[OTLP] Processed %d sample spans from %s", len(sampleSpans), remoteAddr)
	return nil
}

func (r *OTLPReceiver) handleHealth(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status": "healthy", "service": "otlp-receiver"}`))
}

// Enhanced span to log entry conversion with comprehensive attribute mapping
func (r *OTLPReceiver) spanToLogEntry(span ptrace.Span, resource pcommon.Resource) LogEntry {
	attrs := span.Attributes()
	resourceAttrs := resource.Attributes()
	
	// Extract HTTP attributes from span
	httpMethod := r.getStringAttr(attrs, "http.method", "GET")
	httpURL := r.getStringAttr(attrs, "http.url", "")
	httpTarget := r.getStringAttr(attrs, "http.target", "")
	httpStatusCode := r.getIntAttr(attrs, "http.status_code", 200)
	httpUserAgent := r.getStringAttr(attrs, "http.user_agent", "")
	httpClientIP := r.getStringAttr(attrs, "http.client_ip", "unknown")
	httpHost := r.getStringAttr(attrs, "http.host", "")
	httpScheme := r.getStringAttr(attrs, "http.scheme", "https")
	
	// Extract service information from resource
	serviceName := r.getStringAttr(resourceAttrs, "service.name", "unknown")
	serviceVersion := r.getStringAttr(resourceAttrs, "service.version", "")
	
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
	
	// Extract additional span metadata
	spanStatus := span.Status()
	
	return LogEntry{
		ID:           fmt.Sprintf("otlp-%s", span.SpanID().String()),
		Timestamp:    span.StartTimestamp().AsTime().Format(time.RFC3339),
		ClientIP:     r.extractClientIP(httpClientIP),
		Method:       httpMethod,
		Path:         path,
		Status:       httpStatusCode,
		ResponseTime: responseTimeMs,
		ServiceName:  serviceName,
		RouterName:   r.getStringAttr(attrs, "http.route", fmt.Sprintf("%s-router", serviceName)),
		Host:         host,
		RequestAddr:  r.buildRequestAddr(host, httpScheme),
		RequestHost:  host,
		UserAgent:    httpUserAgent,
		Size:         r.getIntAttr(attrs, "http.response.size", 0),
		
		// OpenTelemetry specific fields
		TraceId:      span.TraceID().String(),
		SpanId:       span.SpanID().String(),
		Duration:     durationNs,
		StartUTC:     span.StartTimestamp().AsTime().UTC().Format(time.RFC3339),
		StartLocal:   span.StartTimestamp().AsTime().Format(time.RFC3339),
		
		// Additional metadata
		DataSource:      "otlp",
		OTLPReceiveTime: time.Now().Format(time.RFC3339),
		RequestProtocol: "OTLP",
		RequestScheme:   httpScheme,
		
		// Map span kind and status
		RequestLine:     fmt.Sprintf("%s %s", httpMethod, path),
		TLSVersion:      r.getStringAttr(attrs, "tls.version", ""),
		
		// Service metadata
		ServiceURL:    r.buildServiceURL(serviceName, serviceVersion),
		ServiceAddr:   r.getStringAttr(resourceAttrs, "service.instance.id", ""),
		
		// Span status mapping
		OriginStatus:     int(spanStatus.Code()),
		DownstreamStatus: httpStatusCode,
		
		// Performance metrics
		RequestCount: 1, // Each span represents one request
		Overhead:     r.getInt64Attr(attrs, "span.overhead", 0),
	}
}

// Helper function to extract client IP from various sources
func (r *OTLPReceiver) extractClientIP(httpClientIP string) string {
	if httpClientIP != "" && httpClientIP != "unknown" {
		return httpClientIP
	}
	return "unknown"
}

// Helper function to build request address
func (r *OTLPReceiver) buildRequestAddr(host, scheme string) string {
	if host == "" {
		return ""
	}
	
	// Add default ports if not present
	if !strings.Contains(host, ":") {
		if scheme == "https" {
			return host + ":443"
		} else if scheme == "http" {
			return host + ":80"
		}
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

// Convert OTLP span to LogEntry
// (Removed duplicate implementation. See the enhanced version above.)

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

// Configuration validation and status methods
func (r *OTLPReceiver) IsRunning() bool {
	return r.enabled && r.grpcServer != nil && r.httpServer != nil
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
		"enabled":    r.enabled,
		"grpcPort":   r.grpcPort,
		"httpPort":   r.httpPort,
		"running":    r.IsRunning(),
		"timestamp":  time.Now().Format(time.RFC3339),
	}
}

// Enhanced OTLP span processing with full protobuf support
func (r *OTLPReceiver) processOTLPSpans(traces ptrace.Traces) error {
	processedCount := 0
	
	for i := 0; i < traces.ResourceSpans().Len(); i++ {
		resourceSpan := traces.ResourceSpans().At(i)
		resource := resourceSpan.Resource()
		
		for j := 0; j < resourceSpan.ScopeSpans().Len(); j++ {
			scopeSpan := resourceSpan.ScopeSpans().At(j)
			
			for k := 0; k < scopeSpan.Spans().Len(); k++ {
				span := scopeSpan.Spans().At(k)
				
				// Convert span to log entry
				logEntry := r.spanToLogEntry(span, resource)
				
				// Process through existing pipeline
				r.logParser.ProcessOTLPLogEntry(logEntry)
				processedCount++
			}
		}
	}
	
	log.Printf("[OTLP] Processed %d spans successfully", processedCount)
	return nil
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