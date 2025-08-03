package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/oschwald/geoip2-golang"
	"github.com/patrickmn/go-cache"
)

var (
	geoCache          *cache.Cache
	lastRequestTime   time.Time
	requestCount      int
	rateLimitMutex    sync.Mutex
	retryQueue        []string
	retryQueueMutex   sync.Mutex
	countryNameMap    map[string]string
	maxmindDB         *geoip2.Reader
	maxmindMutex      sync.RWMutex
	useMaxMind        bool
	maxmindPath       string
	fallbackToOnline  bool
)

const (
	RATE_LIMIT_WINDOW      = time.Minute
	MAX_REQUESTS_PER_MINUTE = 45
	MAX_RETRY_QUEUE_SIZE    = 1000 // Limit retry queue size
)

type GeoData struct {
	Country     string  `json:"country"`
	City        string  `json:"city"`
	CountryCode string  `json:"countryCode"`
	Lat         float64 `json:"lat"`
	Lon         float64 `json:"lon"`
	Region      string  `json:"region,omitempty"`
	Timezone    string  `json:"timezone,omitempty"`
	ISP         string  `json:"isp,omitempty"`
	Org         string  `json:"org,omitempty"`
	Source      string  `json:"source,omitempty"`
}

type IPAPIResponse struct {
	Status      string  `json:"status"`
	Message     string  `json:"message"`
	Country     string  `json:"country"`
	CountryCode string  `json:"countryCode"`
	Region      string  `json:"region"`
	RegionName  string  `json:"regionName"`
	City        string  `json:"city"`
	Lat         float64 `json:"lat"`
	Lon         float64 `json:"lon"`
	Timezone    string  `json:"timezone"`
	ISP         string  `json:"isp"`
	Org         string  `json:"org"`
	AS          string  `json:"as"`
	Query       string  `json:"query"`
}

type IPAPICoResponse struct {
	Country      string  `json:"country_name"`
	CountryCode  string  `json:"country_code"`
	City         string  `json:"city"`
	Region       string  `json:"region"`
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	Timezone     string  `json:"timezone"`
	Org          string  `json:"org"`
	Error        bool    `json:"error"`
	Reason       string  `json:"reason"`
}

type IPInfoResponse struct {
	IP       string `json:"ip"`
	City     string `json:"city"`
	Region   string `json:"region"`
	Country  string `json:"country"`
	Loc      string `json:"loc"`
	Org      string `json:"org"`
	Timezone string `json:"timezone"`
}

type MaxMindConfig struct {
	Enabled           bool   `json:"enabled"`
	DatabasePath      string `json:"databasePath"`
	FallbackToOnline  bool   `json:"fallbackToOnline"`
	DatabaseLoaded    bool   `json:"databaseLoaded"`
	DatabaseError     string `json:"databaseError,omitempty"`
}

var (
	retryProcessorTicker *time.Ticker
	retryProcessorStop   chan struct{}
)

func init() {
	geoCache = cache.New(7*24*time.Hour, 24*time.Hour) // 7 days cache, 24 hour cleanup
	lastRequestTime = time.Now()
	retryProcessorStop = make(chan struct{})
	
	// Initialize country name map
	initCountryNames()
	
	// Initialize MaxMind configuration from environment variables
	initMaxMind()
	
	// Start retry processing
	startRetryProcessor()
}

func initMaxMind() {
	maxmindPath = os.Getenv("MAXMIND_DB_PATH")
	useMaxMind = os.Getenv("USE_MAXMIND") == "true"
	fallbackToOnline = os.Getenv("MAXMIND_FALLBACK_ONLINE") != "false" // Default to true
	
	if useMaxMind && maxmindPath != "" {
		if err := loadMaxMindDatabase(maxmindPath); err != nil {
			log.Printf("Failed to load MaxMind database: %v", err)
			if !fallbackToOnline {
				log.Printf("MaxMind database failed to load and fallback is disabled")
			}
		}
	}
}

func loadMaxMindDatabase(dbPath string) error {
	maxmindMutex.Lock()
	defer maxmindMutex.Unlock()
	
	// Close existing database if open
	if maxmindDB != nil {
		maxmindDB.Close()
		maxmindDB = nil
	}
	
	// Check if file exists
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		return fmt.Errorf("MaxMind database file not found: %s", dbPath)
	}
	
	// Open MaxMind database
	db, err := geoip2.Open(dbPath)
	if err != nil {
		return fmt.Errorf("failed to open MaxMind database: %v", err)
	}
	
	maxmindDB = db
	log.Printf("MaxMind database loaded successfully from: %s", dbPath)
	return nil
}

func ReloadMaxMindDatabase() error {
	if maxmindPath == "" {
		return fmt.Errorf("no MaxMind database path configured")
	}
	return loadMaxMindDatabase(maxmindPath)
}

func GetMaxMindConfig() MaxMindConfig {
	maxmindMutex.RLock()
	defer maxmindMutex.RUnlock()
	
	config := MaxMindConfig{
		Enabled:          useMaxMind,
		DatabasePath:     maxmindPath,
		FallbackToOnline: fallbackToOnline,
		DatabaseLoaded:   maxmindDB != nil,
	}
	
	// Test database if loaded
	if maxmindDB != nil {
		testIP := net.ParseIP("8.8.8.8")
		if testIP != nil {
			if _, err := maxmindDB.City(testIP); err != nil {
				config.DatabaseError = err.Error()
			}
		}
	}
	
	return config
}

func getGeoFromMaxMind(ip string) *GeoData {
	maxmindMutex.RLock()
	defer maxmindMutex.RUnlock()
	
	if maxmindDB == nil {
		return nil
	}
	
	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return nil
	}
	
	record, err := maxmindDB.City(parsedIP)
	if err != nil {
		log.Printf("MaxMind lookup failed for IP %s: %v", ip, err)
		return nil
	}
	
	country := "Unknown"
	countryCode := "XX"
	city := "Unknown"
	region := ""
	timezone := ""
	
	if len(record.Country.Names) > 0 {
		if name, ok := record.Country.Names["en"]; ok {
			country = name
		}
	}
	
	if record.Country.IsoCode != "" {
		countryCode = record.Country.IsoCode
	}
	
	if len(record.City.Names) > 0 {
		if name, ok := record.City.Names["en"]; ok {
			city = name
		}
	}
	
	if len(record.Subdivisions) > 0 && len(record.Subdivisions[0].Names) > 0 {
		if name, ok := record.Subdivisions[0].Names["en"]; ok {
			region = name
		}
	}
	
	if record.Location.TimeZone != "" {
		timezone = record.Location.TimeZone
	}
	
	return &GeoData{
		Country:     country,
		City:        city,
		CountryCode: countryCode,
		Lat:         record.Location.Latitude,
		Lon:         record.Location.Longitude,
		Region:      region,
		Timezone:    timezone,
		Source:      "maxmind",
	}
}

// GetGeoLocationFromCache returns geo data from cache only (no API calls)
func GetGeoLocationFromCache(ip string) *GeoData {
	if cached, found := geoCache.Get(ip); found {
		if geoData, ok := cached.(*GeoData); ok {
			return geoData
		}
	}
	return nil
}

func GetGeoLocation(ip string) *GeoData {
	// Check if it's a private IP
	if isPrivateIP(ip) {
		return &GeoData{
			Country:     "Private Network",
			City:        "Local",
			CountryCode: "XX",
			Lat:         0,
			Lon:         0,
			Source:      "private",
		}
	}

	// Check cache first
	if cached, found := geoCache.Get(ip); found {
		if geoData, ok := cached.(*GeoData); ok {
			// Add source if not set (for backward compatibility)
			if geoData.Source == "" {
				geoData.Source = "cached"
			}
			return geoData
		}
	}

	// Try MaxMind first if enabled
	if useMaxMind {
		if geoData := getGeoFromMaxMind(ip); geoData != nil {
			geoCache.Set(ip, geoData, cache.DefaultExpiration)
			return geoData
		} else if !fallbackToOnline {
			// MaxMind failed and no fallback allowed
			failedData := &GeoData{
				Country:     "Unknown",
				City:        "Unknown",
				CountryCode: "XX",
				Lat:         0,
				Lon:         0,
				Source:      "maxmind_failed",
			}
			geoCache.Set(ip, failedData, 1*time.Hour)
			return failedData
		}
		// If MaxMind failed but fallback is enabled, continue to online APIs
		log.Printf("MaxMind lookup failed for %s, falling back to online APIs", ip)
	}

	// Rate limiting check for online APIs
	rateLimitMutex.Lock()
	now := time.Now()
	if now.Sub(lastRequestTime) > RATE_LIMIT_WINDOW {
		requestCount = 0
		lastRequestTime = now
	}

	if requestCount >= MAX_REQUESTS_PER_MINUTE {
		rateLimitMutex.Unlock()
		log.Printf("Rate limit reached for IP geolocation. Adding %s to retry queue", ip)
		addToRetryQueue(ip)
		return &GeoData{
			Country:     "Pending",
			City:        "Pending",
			CountryCode: "XX",
			Lat:         0,
			Lon:         0,
			Source:      "rate_limited",
		}
	}
	requestCount++
	rateLimitMutex.Unlock()

	// Try primary online service
	client := &http.Client{Timeout: 5 * time.Second}
	url := fmt.Sprintf("http://ip-api.com/json/%s?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,query", ip)
	
	resp, err := client.Get(url)
	if err == nil && resp.StatusCode == 200 {
		defer resp.Body.Close()
		
		var apiResp IPAPIResponse
		if err := json.NewDecoder(resp.Body).Decode(&apiResp); err == nil && apiResp.Status == "success" {
			geoData := &GeoData{
				Country:     apiResp.Country,
				City:        apiResp.City,
				CountryCode: apiResp.CountryCode,
				Lat:         apiResp.Lat,
				Lon:         apiResp.Lon,
				Region:      apiResp.RegionName,
				Timezone:    apiResp.Timezone,
				ISP:         apiResp.ISP,
				Org:         apiResp.Org,
				Source:      "online_primary",
			}
			
			if geoData.Country == "" {
				geoData.Country = "Unknown"
			}
			if geoData.City == "" && apiResp.RegionName != "" {
				geoData.City = apiResp.RegionName
			} else if geoData.City == "" {
				geoData.City = "Unknown"
			}
			if geoData.CountryCode == "" {
				geoData.CountryCode = "XX"
			}
			
			geoCache.Set(ip, geoData, cache.DefaultExpiration)
			return geoData
		}
	}

	// Try fallback services
	return tryFallbackService(ip)
}

func tryFallbackService(ip string) *GeoData {
	client := &http.Client{Timeout: 5 * time.Second}
	
	// Try ipapi.co
	url := fmt.Sprintf("https://ipapi.co/%s/json/", ip)
	resp, err := client.Get(url)
	if err == nil && resp.StatusCode == 200 {
		defer resp.Body.Close()
		
		var apiResp IPAPICoResponse
		if err := json.NewDecoder(resp.Body).Decode(&apiResp); err == nil && !apiResp.Error {
			geoData := &GeoData{
				Country:     apiResp.Country,
				City:        apiResp.City,
				CountryCode: apiResp.CountryCode,
				Lat:         apiResp.Latitude,
				Lon:         apiResp.Longitude,
				Region:      apiResp.Region,
				Timezone:    apiResp.Timezone,
				ISP:         apiResp.Org,
				Source:      "online_fallback1",
			}
			
			if geoData.Country == "" {
				geoData.Country = "Unknown"
			}
			if geoData.City == "" {
				geoData.City = "Unknown"
			}
			if geoData.CountryCode == "" {
				geoData.CountryCode = "XX"
			}
			
			geoCache.Set(ip, geoData, cache.DefaultExpiration)
			return geoData
		}
	}

	// Try ipinfo.io
	url = fmt.Sprintf("https://ipinfo.io/%s/json", ip)
	resp, err = client.Get(url)
	if err == nil && resp.StatusCode == 200 {
		defer resp.Body.Close()
		
		var apiResp IPInfoResponse
		if err := json.NewDecoder(resp.Body).Decode(&apiResp); err == nil && apiResp.Country != "" {
			lat, lon := 0.0, 0.0
			if apiResp.Loc != "" {
				fmt.Sscanf(apiResp.Loc, "%f,%f", &lat, &lon)
			}
			
			geoData := &GeoData{
				Country:     getCountryName(apiResp.Country),
				City:        apiResp.City,
				CountryCode: apiResp.Country,
				Lat:         lat,
				Lon:         lon,
				Region:      apiResp.Region,
				Timezone:    apiResp.Timezone,
				ISP:         apiResp.Org,
				Source:      "online_fallback2",
			}
			
			if geoData.Country == "" {
				geoData.Country = "Unknown"
			}
			if geoData.City == "" {
				geoData.City = "Unknown"
			}
			if geoData.CountryCode == "" {
				geoData.CountryCode = "XX"
			}
			
			geoCache.Set(ip, geoData, cache.DefaultExpiration)
			return geoData
		}
	}

	// All services failed
	log.Printf("All geolocation services failed for IP %s", ip)
	failedData := &GeoData{
		Country:     "Unknown",
		City:        "Unknown",
		CountryCode: "XX",
		Lat:         0,
		Lon:         0,
		Source:      "failed",
	}
	geoCache.Set(ip, failedData, 1*time.Hour) // Cache failures for 1 hour
	return failedData
}

func isPrivateIP(ip string) bool {
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

func getCountryName(code string) string {
	if name, ok := countryNameMap[code]; ok {
		return name
	}
	return code
}

func addToRetryQueue(ip string) {
	retryQueueMutex.Lock()
	defer retryQueueMutex.Unlock()
	
	// Limit retry queue size to prevent unbounded growth
	if len(retryQueue) >= MAX_RETRY_QUEUE_SIZE {
		// Remove oldest entries
		retryQueue = retryQueue[100:]
	}
	
	// Check if IP already in queue
	for _, existingIP := range retryQueue {
		if existingIP == ip {
			return
		}
	}
	
	retryQueue = append(retryQueue, ip)
}

func ProcessRetryQueue() {
	retryQueueMutex.Lock()
	if len(retryQueue) == 0 {
		retryQueueMutex.Unlock()
		return
	}
	
	batchSize := 40
	if len(retryQueue) < batchSize {
		batchSize = len(retryQueue)
	}
	
	batch := make([]string, batchSize)
	copy(batch, retryQueue[:batchSize])
	retryQueue = retryQueue[batchSize:]
	retryQueueMutex.Unlock()
	
	log.Printf("Processing %d IPs from retry queue", len(batch))
	
	for _, ip := range batch {
		GetGeoLocation(ip)
	}
}

type GeoCacheStats struct {
	Keys             int            `json:"keys"`
	Stats            map[string]int `json:"stats"`
	RetryQueueLength int            `json:"retryQueueLength"`
	MaxMindConfig    MaxMindConfig  `json:"maxmindConfig"`
}

func GetGeoCacheStats() GeoCacheStats {
	retryQueueMutex.Lock()
	queueLen := len(retryQueue)
	retryQueueMutex.Unlock()
	
	return GeoCacheStats{
		Keys: geoCache.ItemCount(),
		Stats: map[string]int{
			"items": geoCache.ItemCount(),
		},
		RetryQueueLength: queueLen,
		MaxMindConfig:    GetMaxMindConfig(),
	}
}

func ClearGeoCache() {
	geoCache.Flush()
}

func CloseMaxMindDatabase() {
	maxmindMutex.Lock()
	defer maxmindMutex.Unlock()
	
	if maxmindDB != nil {
		maxmindDB.Close()
		maxmindDB = nil
		log.Println("MaxMind database closed")
	}
}

func startRetryProcessor() {
	// Start retry processing every 2 minutes
	retryProcessorTicker = time.NewTicker(2 * time.Minute)
	
	go func() {
		for {
			select {
			case <-retryProcessorTicker.C:
				ProcessRetryQueue()
			case <-retryProcessorStop:
				retryProcessorTicker.Stop()
				return
			}
		}
	}()
}

func StopRetryProcessor() {
	close(retryProcessorStop)
}

func initCountryNames() {
	countryNameMap = map[string]string{
		"AF": "Afghanistan",
		"AL": "Albania",
		"DZ": "Algeria",
		"AD": "Andorra",
		"AO": "Angola",
		"AG": "Antigua and Barbuda",
		"AR": "Argentina",
		"AM": "Armenia",
		"AU": "Australia",
		"AT": "Austria",
		"AZ": "Azerbaijan",
		"BS": "Bahamas",
		"BH": "Bahrain",
		"BD": "Bangladesh",
		"BB": "Barbados",
		"BY": "Belarus",
		"BE": "Belgium",
		"BZ": "Belize",
		"BJ": "Benin",
		"BT": "Bhutan",
		"BO": "Bolivia",
		"BA": "Bosnia and Herzegovina",
		"BW": "Botswana",
		"BR": "Brazil",
		"BN": "Brunei",
		"BG": "Bulgaria",
		"BF": "Burkina Faso",
		"BI": "Burundi",
		"CV": "Cabo Verde",
		"KH": "Cambodia",
		"CM": "Cameroon",
		"CA": "Canada",
		"CF": "Central African Republic",
		"TD": "Chad",
		"CL": "Chile",
		"CN": "China",
		"CO": "Colombia",
		"KM": "Comoros",
		"CG": "Congo",
		"CD": "Democratic Republic of the Congo",
		"CR": "Costa Rica",
		"CI": "Côte d'Ivoire",
		"HR": "Croatia",
		"CU": "Cuba",
		"CY": "Cyprus",
		"CZ": "Czech Republic",
		"DK": "Denmark",
		"DJ": "Djibouti",
		"DM": "Dominica",
		"DO": "Dominican Republic",
		"EC": "Ecuador",
		"EG": "Egypt",
		"SV": "El Salvador",
		"GQ": "Equatorial Guinea",
		"ER": "Eritrea",
		"EE": "Estonia",
		"SZ": "Eswatini",
		"ET": "Ethiopia",
		"FJ": "Fiji",
		"FI": "Finland",
		"FR": "France",
		"GA": "Gabon",
		"GM": "Gambia",
		"GE": "Georgia",
		"DE": "Germany",
		"GH": "Ghana",
		"GR": "Greece",
		"GD": "Grenada",
		"GT": "Guatemala",
		"GN": "Guinea",
		"GW": "Guinea-Bissau",
		"GY": "Guyana",
		"HT": "Haiti",
		"VA": "Vatican City",
		"HN": "Honduras",
		"HU": "Hungary",
		"IS": "Iceland",
		"IN": "India",
		"ID": "Indonesia",
		"IR": "Iran",
		"IQ": "Iraq",
		"IE": "Ireland",
		"IL": "Israel",
		"IT": "Italy",
		"JM": "Jamaica",
		"JP": "Japan",
		"JO": "Jordan",
		"KZ": "Kazakhstan",
		"KE": "Kenya",
		"KI": "Kiribati",
		"KP": "North Korea",
		"KR": "South Korea",
		"KW": "Kuwait",
		"KG": "Kyrgyzstan",
		"LA": "Laos",
		"LV": "Latvia",
		"LB": "Lebanon",
		"LS": "Lesotho",
		"LR": "Liberia",
		"LY": "Libya",
		"LI": "Liechtenstein",
		"LT": "Lithuania",
		"LU": "Luxembourg",
		"MG": "Madagascar",
		"MW": "Malawi",
		"MY": "Malaysia",
		"MV": "Maldives",
		"ML": "Mali",
		"MT": "Malta",
		"MH": "Marshall Islands",
		"MR": "Mauritania",
		"MU": "Mauritius",
		"MX": "Mexico",
		"FM": "Micronesia",
		"MD": "Moldova",
		"MC": "Monaco",
		"MN": "Mongolia",
		"ME": "Montenegro",
		"MA": "Morocco",
		"MZ": "Mozambique",
		"MM": "Myanmar",
		"NA": "Namibia",
		"NR": "Nauru",
		"NP": "Nepal",
		"NL": "Netherlands",
		"NZ": "New Zealand",
		"NI": "Nicaragua",
		"NE": "Niger",
		"NG": "Nigeria",
		"MK": "North Macedonia",
		"NO": "Norway",
		"OM": "Oman",
		"PK": "Pakistan",
		"PW": "Palau",
		"PS": "Palestine",
		"PA": "Panama",
		"PG": "Papua New Guinea",
		"PY": "Paraguay",
		"PE": "Peru",
		"PH": "Philippines",
		"PL": "Poland",
		"PT": "Portugal",
		"QA": "Qatar",
		"RO": "Romania",
		"RU": "Russia",
		"RW": "Rwanda",
		"KN": "Saint Kitts and Nevis",
		"LC": "Saint Lucia",
		"VC": "Saint Vincent and the Grenadines",
		"WS": "Samoa",
		"SM": "San Marino",
		"ST": "Sao Tome and Principe",
		"SA": "Saudi Arabia",
		"SN": "Senegal",
		"RS": "Serbia",
		"SC": "Seychelles",
		"SL": "Sierra Leone",
		"SG": "Singapore",
		"SK": "Slovakia",
		"SI": "Slovenia",
		"SB": "Solomon Islands",
		"SO": "Somalia",
		"ZA": "South Africa",
		"SS": "South Sudan",
		"ES": "Spain",
		"LK": "Sri Lanka",
		"SD": "Sudan",
		"SR": "Suriname",
		"SE": "Sweden",
		"CH": "Switzerland",
		"SY": "Syria",
		"TJ": "Tajikistan",
		"TZ": "Tanzania",
		"TH": "Thailand",
		"TL": "Timor-Leste",
		"TG": "Togo",
		"TO": "Tonga",
		"TT": "Trinidad and Tobago",
		"TN": "Tunisia",
		"TR": "Turkey",
		"TM": "Turkmenistan",
		"TV": "Tuvalu",
		"UG": "Uganda",
		"UA": "Ukraine",
		"AE": "United Arab Emirates",
		"GB": "United Kingdom",
		"US": "United States",
		"UY": "Uruguay",
		"UZ": "Uzbekistan",
		"VU": "Vanuatu",
		"VE": "Venezuela",
		"VN": "Vietnam",
		"YE": "Yemen",
		"ZM": "Zambia",
		"ZW": "Zimbabwe",
	}
}