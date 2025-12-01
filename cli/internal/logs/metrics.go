package logs

import (
	"math"
	"sort"
)

// Metrics represents calculated metrics from logs
type Metrics struct {
	TotalRequests    int
	RequestsPerSec   float64
	AvgResponseTime  float64
	P95ResponseTime  float64
	P99ResponseTime  float64
	Status2xx        int
	Status3xx        int
	Status4xx        int
	Status5xx        int
	ErrorRate        float64
	TopRoutes        []RouteMetric
	TopServices      []ServiceMetric
	TopRouters       []RouterMetric
}

// RouteMetric represents metrics for a route
type RouteMetric struct {
	Path        string
	Method      string
	Count       int
	AvgDuration float64
}

// ServiceMetric represents metrics for a service
type ServiceMetric struct {
	Name        string
	Count       int
	AvgDuration float64
	ErrorRate   float64
}

// RouterMetric represents metrics for a router
type RouterMetric struct {
	Name        string
	Count       int
	AvgDuration float64
}

// CalculateMetrics calculates metrics from log entries
func CalculateMetrics(logs []TraefikLog) *Metrics {
	if len(logs) == 0 {
		return &Metrics{}
	}

	metrics := &Metrics{
		TotalRequests: len(logs),
	}

	// Calculate status code distribution
	durations := make([]float64, 0, len(logs))
	for _, log := range logs {
		status := log.DownstreamStatus
		if status >= 200 && status < 300 {
			metrics.Status2xx++
		} else if status >= 300 && status < 400 {
			metrics.Status3xx++
		} else if status >= 400 && status < 500 {
			metrics.Status4xx++
		} else if status >= 500 && status < 600 {
			metrics.Status5xx++
		}

		// Exclude logs with status 0
		if(log.DownstreamStatus != 0) {
			// Collect durations (convert ns to ms)
			durations = append(durations, float64(log.Duration)/1000000)
		}	
	}

	// Calculate error rate
	if metrics.TotalRequests > 0 {
		metrics.ErrorRate = float64(metrics.Status4xx+metrics.Status5xx) / float64(metrics.TotalRequests) * 100
	}

	// Calculate response time metrics
	metrics.AvgResponseTime = average(durations)
	metrics.P95ResponseTime = percentile(durations, 95)
	metrics.P99ResponseTime = percentile(durations, 99)

	// Calculate top routes
	metrics.TopRoutes = calculateTopRoutes(logs, 10)

	// Calculate top services
	metrics.TopServices = calculateTopServices(logs, 10)

	// Calculate top routers
	metrics.TopRouters = calculateTopRouters(logs, 10)

	return metrics
}

// calculateTopRoutes calculates top routes by request count
func calculateTopRoutes(logs []TraefikLog, limit int) []RouteMetric {
	routeMap := make(map[string]*RouteMetric)

	for _, log := range logs {
		key := log.RequestMethod + " " + log.RequestPath
		if rm, exists := routeMap[key]; exists {
			rm.Count++
			rm.AvgDuration = (rm.AvgDuration*float64(rm.Count-1) + float64(log.Duration)/1000000) / float64(rm.Count)
		} else {
			routeMap[key] = &RouteMetric{
				Path:        log.RequestPath,
				Method:      log.RequestMethod,
				Count:       1,
				AvgDuration: float64(log.Duration) / 1000000,
			}
		}
	}

	routes := make([]RouteMetric, 0, len(routeMap))
	for _, rm := range routeMap {
		routes = append(routes, *rm)
	}

	sort.Slice(routes, func(i, j int) bool {
		return routes[i].Count > routes[j].Count
	})

	if len(routes) > limit {
		routes = routes[:limit]
	}

	return routes
}

// calculateTopServices calculates top services by request count
func calculateTopServices(logs []TraefikLog, limit int) []ServiceMetric {
	serviceMap := make(map[string]*ServiceMetric)

	for _, log := range logs {
		if log.ServiceName == "" {
			continue
		}

		if sm, exists := serviceMap[log.ServiceName]; exists {
			sm.Count++
			sm.AvgDuration = (sm.AvgDuration*float64(sm.Count-1) + float64(log.Duration)/1000000) / float64(sm.Count)
			if log.DownstreamStatus >= 400 {
				sm.ErrorRate = (sm.ErrorRate*float64(sm.Count-1) + 1) / float64(sm.Count)
			}
		} else {
			errorRate := 0.0
			if log.DownstreamStatus >= 400 {
				errorRate = 1.0
			}
			serviceMap[log.ServiceName] = &ServiceMetric{
				Name:        log.ServiceName,
				Count:       1,
				AvgDuration: float64(log.Duration) / 1000000,
				ErrorRate:   errorRate * 100,
			}
		}
	}

	services := make([]ServiceMetric, 0, len(serviceMap))
	for _, sm := range serviceMap {
		services = append(services, *sm)
	}

	sort.Slice(services, func(i, j int) bool {
		return services[i].Count > services[j].Count
	})

	if len(services) > limit {
		services = services[:limit]
	}

	return services
}

// calculateTopRouters calculates top routers by request count
func calculateTopRouters(logs []TraefikLog, limit int) []RouterMetric {
	routerMap := make(map[string]*RouterMetric)

	for _, log := range logs {
		if log.RouterName == "" {
			continue
		}

		if rm, exists := routerMap[log.RouterName]; exists {
			rm.Count++
			rm.AvgDuration = (rm.AvgDuration*float64(rm.Count-1) + float64(log.Duration)/1000000) / float64(rm.Count)
		} else {
			routerMap[log.RouterName] = &RouterMetric{
				Name:        log.RouterName,
				Count:       1,
				AvgDuration: float64(log.Duration) / 1000000,
			}
		}
	}

	routers := make([]RouterMetric, 0, len(routerMap))
	for _, rm := range routerMap {
		routers = append(routers, *rm)
	}

	sort.Slice(routers, func(i, j int) bool {
		return routers[i].Count > routers[j].Count
	})

	if len(routers) > limit {
		routers = routers[:limit]
	}

	return routers
}

// average calculates the average of a slice of float64
func average(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}

	sum := 0.0
	for _, v := range values {
		sum += v
	}

	return sum / float64(len(values))
}

// percentile calculates the nth percentile of a slice of float64
func percentile(values []float64, p float64) float64 {
	if len(values) == 0 {
		return 0
	}

	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	index := (p / 100) * float64(len(sorted)-1)
	lower := int(math.Floor(index))
	upper := int(math.Ceil(index))

	if lower == upper {
		return sorted[lower]
	}

	weight := index - float64(lower)
	return sorted[lower]*(1-weight) + sorted[upper]*weight
}