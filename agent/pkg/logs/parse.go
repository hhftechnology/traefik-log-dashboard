package logs

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

type TraefikLog struct {
	ClientAddr          string    `json:"ClientAddr"`
	ClientHost          string    `json:"ClientHost"`
	ClientPort          string    `json:"ClientPort"`
	ClientUsername      string    `json:"ClientUsername"`
	DownstreamContentSize int64   `json:"DownstreamContentSize"`
	DownstreamStatus    int       `json:"DownstreamStatus"`
	Duration            int64     `json:"Duration"`
	OriginContentSize   int64     `json:"OriginContentSize"`
	OriginDuration      int64     `json:"OriginDuration"`
	OriginStatus        int       `json:"OriginStatus"`
	Overhead            int64     `json:"Overhead"`
	RequestAddr         string    `json:"RequestAddr"`
	RequestContentSize  int64     `json:"RequestContentSize"`
	RequestCount        int       `json:"RequestCount"`
	RequestHost         string    `json:"RequestHost"`
	RequestMethod       string    `json:"RequestMethod"`
	RequestPath         string    `json:"RequestPath"`
	RequestPort         string    `json:"RequestPort"`
	RequestProtocol     string    `json:"RequestProtocol"`
	RequestScheme       string    `json:"RequestScheme"`
	RetryAttempts       int       `json:"RetryAttempts"`
	RouterName          string    `json:"RouterName"`
	ServiceAddr         string    `json:"ServiceAddr"`
	ServiceName         string    `json:"ServiceName"`
	ServiceURL          string    `json:"ServiceURL"`
	StartLocal          time.Time `json:"StartLocal"`
	StartUTC            time.Time `json:"StartUTC"`
	EntryPointName      string    `json:"entryPointName"`
	RequestReferer      string    `json:"RequestReferer"`
	RequestUserAgent    string    `json:"RequestUserAgent"`
}

// OPTIMIZATION: Compile regex once at package initialization
var clfRegex = regexp.MustCompile(`^(\S+) - (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+) "([^"]*)" "([^"]*)" (\d+) "([^"]*)" "([^"]*)" (\d+)ms`)

// OPTIMIZED: ParseTraefikLog with early validation
func ParseTraefikLog(logLine string) (*TraefikLog, error) {
	// OPTIMIZATION: Avoid TrimSpace if possible, check length first
	if len(logLine) == 0 {
		return nil, nil
	}

	logLine = strings.TrimSpace(logLine)

	if logLine == "" {
		return nil, nil
	}

	// OPTIMIZATION: Direct byte check instead of HasPrefix for better performance
	if logLine[0] == '{' {
		return parseJSONLog(logLine)
	}

	return parseCLFLog(logLine)
}

func parseJSONLog(logLine string) (*TraefikLog, error) {
	var log TraefikLog
	err := json.Unmarshal([]byte(logLine), &log)
	if err != nil {
		return nil, err
	}
	return &log, nil
}

func parseCLFLog(logLine string) (*TraefikLog, error) {
	matches := clfRegex.FindStringSubmatch(logLine)
	if matches == nil {
		return nil, nil
	}

	timestamp, _ := time.Parse("02/Jan/2006:15:04:05 -0700", matches[3])
	status, _ := strconv.Atoi(matches[7])
	contentSize, _ := strconv.ParseInt(matches[8], 10, 64)
	requestCount, _ := strconv.Atoi(matches[11])
	duration, _ := strconv.ParseInt(matches[14], 10, 64)

	log := &TraefikLog{
		ClientHost:            matches[1],
		ClientUsername:        matches[2],
		RequestMethod:         matches[4],
		RequestPath:           matches[5],
		RequestProtocol:       matches[6],
		OriginStatus:          status,
		DownstreamStatus:      status,
		OriginContentSize:     contentSize,
		DownstreamContentSize: contentSize,
		RequestReferer:        matches[9],
		RequestUserAgent:      matches[10],
		RequestCount:          requestCount,
		RouterName:            matches[12],
		ServiceURL:            matches[13],
		Duration:              duration * 1000000,
		StartUTC:              timestamp,
		StartLocal:            timestamp,
	}

	return log, nil
}

// OPTIMIZED: ParseTraefikLogs with pre-allocation
func ParseTraefikLogs(logLines []string) []*TraefikLog {
	// OPTIMIZATION: Pre-allocate slice with capacity to reduce reallocations
	logs := make([]*TraefikLog, 0, len(logLines))

	for _, line := range logLines {
		log, err := ParseTraefikLog(line)
		if err == nil && log != nil {
			logs = append(logs, log)
		}
	}
	return logs
}

func ParseTraefikLogsBatched(logLines []string, batchSize int) []*TraefikLog {
	if batchSize <= 0 {
		batchSize = 1000
	}

	numBatches := (len(logLines) + batchSize - 1) / batchSize
	results := make([][]*TraefikLog, numBatches)

	var wg sync.WaitGroup

	for i := 0; i < numBatches; i++ {
		wg.Add(1)
		go func(batchIdx int) {
			defer wg.Done()

			start := batchIdx * batchSize
			end := start + batchSize
			if end > len(logLines) {
				end = len(logLines)
			}

			batch := logLines[start:end]
			batchResults := make([]*TraefikLog, 0, len(batch))

			for _, line := range batch {
				log, err := ParseTraefikLog(line)
				if err == nil && log != nil {
					batchResults = append(batchResults, log)
				}
			}

			results[batchIdx] = batchResults
		}(i)
	}

	wg.Wait()

	// Merge results
	totalLogs := 0
	for _, batch := range results {
		totalLogs += len(batch)
	}

	merged := make([]*TraefikLog, 0, totalLogs)
	for _, batch := range results {
		merged = append(merged, batch...)
	}

	return merged
}
