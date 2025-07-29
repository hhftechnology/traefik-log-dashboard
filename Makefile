.PHONY: help build up down logs clean restart dev prod install

# Default target
help:
	@echo "Traefik Log Dashboard - Available commands:"
	@echo "  make install    - Install dependencies for local development"
	@echo "  make build      - Build Docker images"
	@echo "  make up         - Start services in background"
	@echo "  make down       - Stop services"
	@echo "  make logs       - View logs"
	@echo "  make clean      - Remove containers and images"
	@echo "  make restart    - Restart services"
	@echo "  make dev        - Start in development mode"
	@echo "  make prod       - Start in production mode"

# Install dependencies for local development
install:
	@echo "Installing backend dependencies..."
	cd backend && npm install
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Dependencies installed!"

# Build Docker images
build:
	@echo "Building Docker images..."
	docker-compose build --no-cache
	@echo "Build complete!"

# Start services
up:
	@echo "Starting services..."
	docker-compose up -d
	@echo "Services started! Dashboard available at http://localhost:3000"

# Stop services
down:
	@echo "Stopping services..."
	docker-compose down
	@echo "Services stopped!"

# View logs
logs:
	docker-compose logs -f

# Clean up
clean:
	@echo "Cleaning up..."
	docker-compose down -v --rmi all
	@echo "Cleanup complete!"

# Restart services
restart: down up

# Development mode
dev:
	@echo "Starting in development mode..."
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production mode
prod:
	@echo "Starting in production mode..."
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check service health
health:
	@echo "Checking service health..."
	@curl -s http://localhost:3001/health | jq . || echo "Backend not responding"
	@curl -s http://localhost:3000/ > /dev/null && echo "Frontend: OK" || echo "Frontend not responding"

# Quick setup
setup:
	@echo "Setting up Traefik Log Dashboard..."
	@test -f .env || cp .env.example .env
	@echo "Please edit .env file with your Traefik log path"
	@echo "Then run: make build && make up"