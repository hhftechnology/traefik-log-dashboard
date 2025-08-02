.PHONY: build run dev test clean docker docker-dev

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

# Run Docker container
docker-run:
	docker run -p 3001:3001 -v /logs:/logs traefik-log-dashboard-backend

# Run development Docker container with hot reload
docker-run-dev:
	docker run -p 3001:3001 -v $(PWD):/app -v /logs:/logs traefik-log-dashboard-backend-dev

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