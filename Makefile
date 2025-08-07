# Traefik Log Dashboard - Makefile
# Convenient commands for development and deployment

.PHONY: help build up down restart logs clean dev prod test maxmind-download maxmind-download-country maxmind-test

# Default target
help: ## Show this help message
	@echo "Traefik Log Dashboard - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'
	@echo ""
	@echo "Environment Variables:"
	@echo "  MAXMIND_LICENSE_KEY    MaxMind license key for GeoIP database"
	@echo "  COMPOSE_FILE           Docker compose file to use (default: docker-compose.yml)"

# Docker Compose commands
build: ## Build Docker images
	docker compose build --no-cache

up: ## Start services (standard log file mode)
	docker compose up -d

up-otlp: ## Start services with OTLP support
	docker compose -f docker-compose-otlp.yml up -d

down: ## Stop and remove services
	docker compose down
	docker compose -f docker-compose-otlp.yml down 2>/dev/null || true

restart: down up ## Restart services

restart-otlp: down up-otlp ## Restart services with OTLP

logs: ## Show service logs
	docker compose logs -f --tail=100

logs-backend: ## Show backend logs only
	docker compose logs -f backend

logs-frontend: ## Show frontend logs only
	docker compose logs -f frontend

# Development commands
dev: ## Start development environment with debug logging
	docker compose -f docker-compose-otlp.yml -f docker-compose.dev.yml up -d

dev-logs: ## Show development logs
	docker compose -f docker-compose-otlp.yml -f docker-compose.dev.yml logs -f

# Production commands  
prod: ## Start production environment with optimizations
	docker compose -f docker-compose-otlp.yml -f docker-compose.prod.yml up -d

prod-logs: ## Show production logs
	docker compose -f docker-compose-otlp.yml -f docker-compose.prod.yml logs -f

# Testing commands
test: ## Start with sample applications for testing
	docker compose -f docker-compose-otlp.yml --profile testing up -d

test-traffic: ## Generate test traffic (requires test environment)
	@echo "Generating test traffic..."
	@for i in $$(seq 1 20); do \
		curl -s -H "Host: app.localhost" http://localhost/ >/dev/null 2>&1; \
		curl -s -H "Host: app.localhost" http://localhost/api/users >/dev/null 2>&1; \
		sleep 1; \
	done
	@echo "Test traffic generated!"

# MaxMind GeoIP commands
maxmind-download: ## Download MaxMind GeoLite2-City database
	@if [ -z "$(MAXMIND_LICENSE_KEY)" ]; then \
		echo "Error: MAXMIND_LICENSE_KEY environment variable is required"; \
		echo "Sign up at https://www.maxmind.com/en/geolite2/signup"; \
		exit 1; \
	fi
	@mkdir -p maxmind
	@echo "Downloading MaxMind GeoLite2-City database..."
	@wget -O maxmind/GeoLite2-City.tar.gz "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=$(MAXMIND_LICENSE_KEY)&suffix=tar.gz"
	@cd maxmind && tar -xzf GeoLite2-City.tar.gz --strip-components=1 "*/GeoLite2-City.mmdb"
	@rm -f maxmind/GeoLite2-City.tar.gz
	@echo "MaxMind GeoLite2-City database downloaded to maxmind/GeoLite2-City.mmdb"

maxmind-download-country: ## Download MaxMind GeoLite2-Country database (smaller)
	@if [ -z "$(MAXMIND_LICENSE_KEY)" ]; then \
		echo "Error: MAXMIND_LICENSE_KEY environment variable is required"; \
		exit 1; \
	fi
	@mkdir -p maxmind
	@echo "Downloading MaxMind GeoLite2-Country database..."
	@wget -O maxmind/GeoLite2-Country.tar.gz "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=$(MAXMIND_LICENSE_KEY)&suffix=tar.gz"
	@cd maxmind && tar -xzf GeoLite2-Country.tar.gz --strip-components=1 "*/GeoLite2-Country.mmdb"
	@rm -f maxmind/GeoLite2-Country.tar.gz
	@echo "MaxMind GeoLite2-Country database downloaded to maxmind/GeoLite2-Country.mmdb"

maxmind-test: ## Test MaxMind database functionality
	@echo "Testing MaxMind database..."
	@curl -X POST http://localhost:3001/api/maxmind/test \
		-H "Content-Type: application/json" \
		-d '{"testIP": "8.8.8.8"}' | jq .

# Health check commands
health: ## Check service health
	@echo "Checking backend health..."
	@curl -s http://localhost:3001/health | jq .
	@echo ""
	@echo "Checking frontend health..."
	@curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ && echo " - Frontend OK" || echo " - Frontend ERROR"

health-otlp: ## Check OTLP receiver health
	@echo "Checking OTLP receiver status..."
	@curl -s http://localhost:3001/api/otlp/status | jq .

# Cleanup commands
clean: ## Clean up containers, volumes, and images
	docker compose down -v --rmi all
	docker compose -f docker-compose-otlp.yml down -v --rmi all 2>/dev/null || true
	docker system prune -f

clean-logs: ## Clean up log files
	sudo rm -rf logs/*
	docker volume rm $$(docker volume ls -q | grep traefik.*logs) 2>/dev/null || true

# Development utilities
shell-backend: ## Open shell in backend container
	docker compose exec backend sh

shell-frontend: ## Open shell in frontend container  
	docker compose exec frontend sh

stats: ## Show current dashboard statistics
	@curl -s http://localhost:3001/api/stats | jq .

# Setup commands
setup: ## Initial setup - copy example env file
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env file from .env.example"; \
		echo "Please edit .env file with your configuration"; \
	else \
		echo ".env file already exists"; \
	fi

setup-dev: setup ## Setup for development with OTLP
	@sed -i 's/OTLP_ENABLED=false/OTLP_ENABLED=true/' .env
	@echo "Configured .env for development with OTLP enabled"

# Network commands
network-create: ## Create Docker networks
	docker network create traefik-network 2>/dev/null || true
	docker network create dashboard-network 2>/dev/null || true

network-clean: ## Remove Docker networks
	docker network rm traefik-network dashboard-network 2>/dev/null || true

# Status commands
ps: ## Show running containers
	docker compose ps
	docker compose -f docker-compose-otlp.yml ps 2>/dev/null || true

images: ## Show built images
	docker images | grep traefik.*dashboard

# Quick commands
quick-start: setup network-create up-otlp ## Quick start with OTLP (recommended)
	@echo ""
	@echo "🚀 Traefik Log Dashboard started!"
	@echo "📊 Dashboard: http://localhost:3000"
	@echo "🔧 Backend API: http://localhost:3001"
	@echo "📈 Health Check: make health"
	@echo ""

quick-dev: setup-dev network-create dev ## Quick development start
	@echo ""
	@echo "🚀 Development environment started!"
	@echo "📊 Dashboard: http://localhost:3000"
	@echo "🔧 Backend API: http://localhost:3001"
	@echo "📋 Logs: make dev-logs"
	@echo ""