.PHONY: build run dev test clean docker docker-dev maxmind-download

# Build the application
build:
	go build -o main .

# Run the application
run: build
	./main

# Run in development mode with air
dev:
	air

# Run tests
test:
	go test -v ./...

# Clean build artifacts
clean:
	rm -f main
	rm -rf tmp/

# Build Docker image
docker:
	docker build -t traefik-log-dashboard-backend .

# Build development Docker image
docker-dev:
	docker build -f Dockerfile.dev -t traefik-log-dashboard-backend-dev .

# Run Docker container with MaxMind support
docker-run:
	docker run -p 3001:3001 \
		-v /logs:/logs \
		-v $(PWD)/maxmind:/maxmind \
		-e USE_MAXMIND=true \
		-e MAXMIND_DB_PATH=/maxmind/GeoLite2-City.mmdb \
		traefik-log-dashboard-backend

# Run Docker container without MaxMind (online APIs only)
docker-run-online:
	docker run -p 3001:3001 \
		-v /logs:/logs \
		-e USE_MAXMIND=false \
		traefik-log-dashboard-backend

# Run development Docker container with hot reload and MaxMind support
docker-run-dev:
	docker run -p 3001:3001 \
		-v $(PWD):/app \
		-v /logs:/logs \
		-v $(PWD)/maxmind:/maxmind \
		-e USE_MAXMIND=true \
		-e MAXMIND_DB_PATH=/maxmind/GeoLite2-City.mmdb \
		traefik-log-dashboard-backend-dev

# Download MaxMind GeoLite2 database (requires account and license key)
# Set MAXMIND_LICENSE_KEY environment variable before running
maxmind-download:
	@if [ -z "$(MAXMIND_LICENSE_KEY)" ]; then \
		echo "Error: MAXMIND_LICENSE_KEY environment variable is required"; \
		echo "Sign up at https://www.maxmind.com/en/geolite2/signup"; \
		echo "Then set: export MAXMIND_LICENSE_KEY=your_license_key"; \
		exit 1; \
	fi
	@mkdir -p maxmind
	@echo "Downloading MaxMind GeoLite2-City database..."
	@curl -L "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=$(MAXMIND_LICENSE_KEY)&suffix=tar.gz" \
		-o maxmind/GeoLite2-City.tar.gz
	@cd maxmind && tar -xzf GeoLite2-City.tar.gz --strip-components=1 "*/GeoLite2-City.mmdb"
	@rm -f maxmind/GeoLite2-City.tar.gz
	@echo "MaxMind database downloaded to maxmind/GeoLite2-City.mmdb"

# Download MaxMind GeoLite2 Country database
maxmind-download-country:
	@if [ -z "$(MAXMIND_LICENSE_KEY)" ]; then \
		echo "Error: MAXMIND_LICENSE_KEY environment variable is required"; \
		echo "Sign up at https://www.maxmind.com/en/geolite2/signup"; \
		echo "Then set: export MAXMIND_LICENSE_KEY=your_license_key"; \
		exit 1; \
	fi
	@mkdir -p maxmind
	@echo "Downloading MaxMind GeoLite2-Country database..."
	@curl -L "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=$(MAXMIND_LICENSE_KEY)&suffix=tar.gz" \
		-o maxmind/GeoLite2-Country.tar.gz
	@cd maxmind && tar -xzf GeoLite2-Country.tar.gz --strip-components=1 "*/GeoLite2-Country.mmdb"
	@rm -f maxmind/GeoLite2-Country.tar.gz
	@echo "MaxMind Country database downloaded to maxmind/GeoLite2-Country.mmdb"

# Test MaxMind database
maxmind-test:
	@if [ ! -f "maxmind/GeoLite2-City.mmdb" ]; then \
		echo "Error: MaxMind database not found at maxmind/GeoLite2-City.mmdb"; \
		echo "Run 'make maxmind-download' first"; \
		exit 1; \
	fi
	@echo "Testing MaxMind database..."
	@USE_MAXMIND=true MAXMIND_DB_PATH=maxmind/GeoLite2-City.mmdb go run *.go &
	@sleep 3
	@curl -s http://localhost:3001/api/maxmind/test | jq .
	@pkill -f "go run"

# Download dependencies
deps:
	go mod download

# Tidy dependencies
tidy:
	go mod tidy

# Format code
fmt:
	go fmt ./...

# Lint code
lint:
	golangci-lint run

# Install development tools
install-tools:
	go install github.com/cosmtrek/air@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Show MaxMind configuration help
maxmind-help:
	@echo "MaxMind GeoIP2 Database Setup:"
	@echo ""
	@echo "1. Sign up for a free MaxMind account:"
	@echo "   https://www.maxmind.com/en/geolite2/signup"
	@echo ""
	@echo "2. Get your license key from your account"
	@echo ""
	@echo "3. Set your license key:"
	@echo "   export MAXMIND_LICENSE_KEY=your_license_key_here"
	@echo ""
	@echo "4. Download the database:"
	@echo "   make maxmind-download"
	@echo ""
	@echo "5. Run with MaxMind enabled:"
	@echo "   USE_MAXMIND=true MAXMIND_DB_PATH=maxmind/GeoLite2-City.mmdb make run"
	@echo ""
	@echo "Environment Variables:"
	@echo "  USE_MAXMIND=true                    - Enable MaxMind database"
	@echo "  MAXMIND_DB_PATH=path/to/db.mmdb     - Path to MaxMind database"
	@echo "  MAXMIND_FALLBACK_ONLINE=true       - Fallback to online APIs if MaxMind fails"