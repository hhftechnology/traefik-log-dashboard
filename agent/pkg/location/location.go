package location

import (
	"net"
	"sync"

	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logger"
	"github.com/oschwald/geoip2-golang"
)

// Location represents geolocation information for an IP address
type Location struct {
	IPAddress string  `json:"ipAddress"`
	Country   string  `json:"country,omitempty"`
	City      string  `json:"city,omitempty"`
	Latitude  float64 `json:"latitude,omitempty"`
	Longitude float64 `json:"longitude,omitempty"`
}

var (
	cityReader    *geoip2.Reader
	countryReader *geoip2.Reader
	initOnce      sync.Once
	initErr       error
	initDone      = make(chan struct{})
	cityDBPath    string
	countryDBPath string
)

// SetDatabasePaths sets the paths for the GeoIP databases
func SetDatabasePaths(cityPath, countryPath string) {
	cityDBPath = cityPath
	countryDBPath = countryPath
}

// LocationsEnabled checks if location lookups are available
func LocationsEnabled() bool {
	err := InitializeLookups()
	return err == nil && (cityReader != nil || countryReader != nil)
}

// InitializeLookups ensures the MaxMind databases are loaded
func InitializeLookups() error {
	initOnce.Do(func() {
		// Try to open the city database first
		if cityDBPath != "" {
			var cityErr error
			cityReader, cityErr = geoip2.Open(cityDBPath)
			if cityErr != nil {
				logger.Log.Printf("Failed to load GeoLite2 City database from %s: %v", cityDBPath, cityErr)
			} else {
				logger.Log.Println("GeoLite2 City database loaded successfully")
			}
		}

		// Try to open the country database if city failed or as fallback
		if cityReader == nil && countryDBPath != "" {
			var countryErr error
			countryReader, countryErr = geoip2.Open(countryDBPath)
			if countryErr != nil {
				logger.Log.Printf("Failed to load GeoLite2 Country database from %s: %v", countryDBPath, countryErr)
				initErr = countryErr
			} else {
				logger.Log.Println("GeoLite2 Country database loaded successfully")
			}
		}

		// If we have at least one database, consider it successful
		if cityReader != nil || countryReader != nil {
			initErr = nil
		}

		close(initDone)
	})

	// Wait for initialization to complete
	<-initDone
	return initErr
}

// LocationLookup returns geolocation information for a single IP address
func LocationLookup(ipAddress string) (Location, error) {
	// Ensure databases are initialized
	if err := InitializeLookups(); err != nil && cityReader == nil && countryReader == nil {
		return Location{
			IPAddress: ipAddress,
			Country:   "",
			City:      "",
		}, nil
	}

	// Parse the IP address
	ip := net.ParseIP(ipAddress)
	if ip == nil {
		return Location{
			IPAddress: ipAddress,
			Country:   "",
			City:      "",
		}, nil
	}

	// Check if it's a private IP
	if isPrivateIP(ip) {
		return Location{
			IPAddress: ipAddress,
			Country:   "Private",
			City:      "",
		}, nil
	}

	location := Location{
		IPAddress: ipAddress,
	}

	// Try city lookup first if available
	if cityReader != nil {
		city, err := cityReader.City(ip)
		if err == nil {
			location.Country = city.Country.IsoCode
			if city.City.Names != nil {
				location.City = city.City.Names["en"]
			}
			location.Latitude = city.Location.Latitude
			location.Longitude = city.Location.Longitude
			return location, nil
		}
	}

	// Fall back to country lookup if available
	if countryReader != nil {
		country, err := countryReader.Country(ip)
		if err == nil {
			location.Country = country.Country.IsoCode
			return location, nil
		}
	}

	// Return empty location if no lookup was successful
	return location, nil
}

// ResolveLocations performs geolocation lookups for multiple IP addresses in parallel
func ResolveLocations(ipAddresses []string) ([]Location, error) {
	// Ensure databases are initialized
	if err := InitializeLookups(); err != nil && cityReader == nil && countryReader == nil {
		// Return empty locations if neither database is available
		locations := make([]Location, len(ipAddresses))
		for i, ip := range ipAddresses {
			locations[i] = Location{
				IPAddress: ip,
				Country:   "",
				City:      "",
			}
		}
		return locations, nil
	}

	// Use a wait group to track parallel lookups
	var wg sync.WaitGroup
	locations := make([]Location, len(ipAddresses))

	// Perform lookups in parallel
	for i, ip := range ipAddresses {
		wg.Add(1)
		go func(idx int, ipAddr string) {
			defer wg.Done()
			location, _ := LocationLookup(ipAddr)
			locations[idx] = location
		}(i, ip)
	}

	// Wait for all lookups to complete
	wg.Wait()
	return locations, nil
}

// isPrivateIP checks if an IP address is private/internal
func isPrivateIP(ip net.IP) bool {
	// Check for IPv4 private ranges
	if ip4 := ip.To4(); ip4 != nil {
		return ip4[0] == 10 ||
			ip4[0] == 11 || // Added 11.0.0.0/8
			(ip4[0] == 172 && ip4[1] >= 16 && ip4[1] <= 31) ||
			(ip4[0] == 192 && ip4[1] == 168) ||
			ip4[0] == 127 // localhost
	}

	// Check for IPv6 private ranges
	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsPrivate() {
		return true
	}

	return false
}

// Close releases resources used by MaxMind readers
func Close() {
	if cityReader != nil {
		cityReader.Close()
	}
	if countryReader != nil {
		countryReader.Close()
	}
}