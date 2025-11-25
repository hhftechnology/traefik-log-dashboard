# Docker Compose Examples for Traefik Log Dashboard V2

This file contains various docker-compose.yml configurations for different deployment scenarios.

---

##  Table of Contents

1. [Single Agent Setup (Basic)](#single-agent-setup-basic)
2. [Single Agent with GeoIP](#single-agent-with-geoip)
3. [Multi-Agent Setup (5 Agents)](#multi-agent-setup-5-agents)
4. [Production Setup with Resources Limits](#production-setup-with-resource-limits)
5. [Remote Agent Setup](#remote-agent-setup)

---

## 1. Single Agent Setup (Basic)

Minimal configuration for monitoring a single Traefik instance.

```yaml
services:
  # Traefik Log Dashboard Agent
  traefik-agent:
    image: hhftechnology/traefik-log-dashboard-agent:dev-dashboard
    container_name: traefik-log-dashboard-agent
    restart: unless-stopped
    ports:
      - "5000:5000"
    volumes:
      - ./data/logs:/logs:ro
      - ./data/positions:/data
    environment:
      # Log Paths
      - TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/logs/access.log
      
      # Authentication - REPLACE WITH YOUR TOKEN
      - TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN=d41d8cd98f00b204e9800998ecf8427e
      
      # Log Format
      - TRAEFIK_LOG_DASHBOARD_LOG_FORMAT=json
      
      # Server Port
      - PORT=5000
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/api/logs/status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - traefik-network

  # Traefik Log Dashboard - Next.js web UI
  traefik-dashboard:
    image: hhftechnology/traefik-log-dashboard:dev-dashboard
    container_name: traefik-log-dashboard
    restart: unless-stopped
    user: "1001:1001"
    ports:
      - "3000:3000"
    volumes:
      - ./data/dashboard:/app/data
    environment:
      # Agent Configuration - REPLACE WITH YOUR TOKEN
      - AGENT_API_URL=http://traefik-agent:5000
      - AGENT_API_TOKEN=d41d8cd98f00b204e9800998ecf8427e
      
      # Node Environment
      - NODE_ENV=production
      - PORT=3000

      # Display Configuration
      - NEXT_PUBLIC_SHOW_DEMO_PAGE=true
      - NEXT_PUBLIC_MAX_LOGS_DISPLAY=500
    depends_on:
      traefik-agent:
        condition: service_healthy
    networks:
      - traefik-network

networks:
  traefik-network:
    external: true
```

**Directory Structure Required:**
```bash
mkdir -p data/{logs,positions,dashboard}
chmod 755 data/*
chown -R 1001:1001 ./data/dashboard
```

---

## 2. Single Agent with GeoIP

Configuration with MaxMind GeoIP databases for geographic analytics.

```yaml
services:
  # Traefik Log Dashboard Agent
  traefik-agent:
    image: hhftechnology/traefik-log-dashboard-agent:dev-dashboard
    container_name: traefik-log-dashboard-agent
    restart: unless-stopped
    ports:
      - "5000:5000"
    volumes:
      - ./data/logs:/logs:ro
      - ./data/geoip:/geoip:ro  # GeoIP databases
      - ./data/positions:/data
    environment:
      # Log Paths
      - TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/logs/access.log
      - TRAEFIK_LOG_DASHBOARD_ERROR_PATH=/logs/access.log
      
      # Authentication - REPLACE WITH YOUR TOKEN
      - TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN=d41d8cd98f00b204e9800998ecf8427e
      
      # System Monitoring
      - TRAEFIK_LOG_DASHBOARD_SYSTEM_MONITORING=true
      
      # GeoIP Configuration
      - TRAEFIK_LOG_DASHBOARD_GEOIP_ENABLED=true
      - TRAEFIK_LOG_DASHBOARD_GEOIP_CITY_DB=/geoip/GeoLite2-City.mmdb
      - TRAEFIK_LOG_DASHBOARD_GEOIP_COUNTRY_DB=/geoip/GeoLite2-Country.mmdb
      
      # Log Format
      - TRAEFIK_LOG_DASHBOARD_LOG_FORMAT=json
      
      # Server Port
      - PORT=5000
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/api/logs/status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - traefik-network

  # Traefik Log Dashboard - Next.js web UI
  traefik-dashboard:
    image: hhftechnology/traefik-log-dashboard:dev-dashboard
    container_name: traefik-log-dashboard
    restart: unless-stopped
    user: "1001:1001"
    ports:
      - "3000:3000"
    volumes:
      - ./data/dashboard:/app/data
    environment:
      # Agent Configuration - REPLACE WITH YOUR TOKEN
      - AGENT_API_URL=http://traefik-agent:5000
      - AGENT_API_TOKEN=d41d8cd98f00b204e9800998ecf8427e
      - AGENT_NAME=Default Agent
      
      # Node Environment
      - NODE_ENV=production
      - PORT=3000

      # Display Configuration
      - NEXT_PUBLIC_SHOW_DEMO_PAGE=true
      - NEXT_PUBLIC_MAX_LOGS_DISPLAY=500
    depends_on:
      traefik-agent:
        condition: service_healthy
    networks:
      - traefik-network

networks:
  traefik-network:
    external: true
```

**Directory Structure Required:**
```bash
mkdir -p data/{logs,geoip,positions,dashboard}
chmod 755 data/*
chown -R 1001:1001 ./data/dashboard

# Download GeoIP databases
cd data/geoip
# Follow instructions in README.md for downloading MaxMind databases
```

---

## 3. Multi-Agent Setup (5 Agents)

Configuration for monitoring 5 different Traefik instances from a single dashboard.

```yaml
services:
  # ============================================
  # DASHBOARD - Central Management Interface
  # ============================================
  traefik-dashboard:
    image: hhftechnology/traefik-log-dashboard:dev-dashboard
    container_name: traefik-log-dashboard
    restart: unless-stopped
    user: "1001:1001"
    ports:
      - "3000:3000"
    volumes:
      - ./data/dashboard:/app/data
    environment:
      # Primary Agent (Environment Agent - Protected from UI deletion)
      - AGENT_API_URL=http://traefik-agent:5000
      - AGENT_API_TOKEN=d41d8cd98f00b204e9800998ecf8427e
      - AGENT_NAME=Primary Agent
      
      # Node Environment
      - NODE_ENV=production
      - PORT=3000

      # Display Configuration
      - NEXT_PUBLIC_SHOW_DEMO_PAGE=true
      - NEXT_PUBLIC_MAX_LOGS_DISPLAY=500
    depends_on:
      - traefik-agent
      - traefik-agent-2
      - traefik-agent-3
      - traefik-agent-4
      - traefik-agent-5
    networks:
      - traefik-network

  # ============================================
  # AGENT 1 - Primary/Default Agent
  # ============================================
  traefik-agent:
    image: hhftechnology/traefik-log-dashboard-agent:dev-dashboard
    container_name: traefik-log-dashboard-agent
    restart: unless-stopped
    ports:
      - "5000:5000"
    volumes:
      - ./data/logs:/logs:ro
      - ./data/geoip:/geoip:ro
      - ./data/positions:/data
    environment:
      - TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/logs/access.log
      - TRAEFIK_LOG_DASHBOARD_ERROR_PATH=/logs/access.log
      - TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN=d41d8cd98f00b204e9800998ecf8427e
      - TRAEFIK_LOG_DASHBOARD_SYSTEM_MONITORING=true
      - TRAEFIK_LOG_DASHBOARD_GEOIP_ENABLED=true
      - TRAEFIK_LOG_DASHBOARD_GEOIP_CITY_DB=/geoip/GeoLite2-City.mmdb
      - TRAEFIK_LOG_DASHBOARD_GEOIP_COUNTRY_DB=/geoip/GeoLite2-Country.mmdb
      - TRAEFIK_LOG_DASHBOARD_LOG_FORMAT=json
      - PORT=5000
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/api/logs/status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - traefik-network

  # ============================================
  # AGENT 2 - Secondary Location/Server
  # ============================================
  traefik-agent-2:
    image: hhftechnology/traefik-log-dashboard-agent:dev-dashboard
    container_name: traefik-log-dashboard-agent-2
    restart: unless-stopped
    ports:
      - "5001:5000"
    volumes:
      - ./data/logs2:/logs:ro
      - ./data/geoip:/geoip:ro
      - ./data/positions2:/data
    environment:
      - TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/logs/access.log
      - TRAEFIK_LOG_DASHBOARD_ERROR_PATH=/logs/access.log
      - TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN=token_for_agent_2_replace_me
      - TRAEFIK_LOG_DASHBOARD_SYSTEM_MONITORING=true
      - TRAEFIK_LOG_DASHBOARD_GEOIP_ENABLED=true
      - TRAEFIK_LOG_DASHBOARD_GEOIP_CITY_DB=/geoip/GeoLite2-City.mmdb
      - TRAEFIK_LOG_DASHBOARD_GEOIP_COUNTRY_DB=/geoip/GeoLite2-Country.mmdb
      - TRAEFIK_LOG_DASHBOARD_LOG_FORMAT=json
      - PORT=5000
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/api/logs/status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - traefik-network

  # ============================================
  # AGENT 3 - Third Location/Server
  # ============================================
  traefik-agent-3:
    image: hhftechnology/traefik-log-dashboard-agent:dev-dashboard
    container_name: traefik-log-dashboard-agent-3
    restart: unless-stopped
    ports:
      - "5002:5000"
    volumes:
      - ./data/logs3:/logs:ro
      - ./data/geoip:/geoip:ro
      - ./data/positions3:/data
    environment:
      - TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/logs/access.log
      - TRAEFIK_LOG_DASHBOARD_ERROR_PATH=/logs/access.log
      - TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN=token_for_agent_3_replace_me
      - TRAEFIK_LOG_DASHBOARD_SYSTEM_MONITORING=true
      - TRAEFIK_LOG_DASHBOARD_GEOIP_ENABLED=true
      - TRAEFIK_LOG_DASHBOARD_GEOIP_CITY_DB=/geoip/GeoLite2-City.mmdb
      - TRAEFIK_LOG_DASHBOARD_GEOIP_COUNTRY_DB=/geoip/GeoLite2-Country.mmdb
      - TRAEFIK_LOG_DASHBOARD_LOG_FORMAT=json
      - PORT=5000
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/api/logs/status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - traefik-network

  # ============================================
  # AGENT 4 - Fourth Location/Server
  # ============================================
  traefik-agent-4:
    image: hhftechnology/traefik-log-dashboard-agent:dev-dashboard
    container_name: traefik-log-dashboard-agent-4
    restart: unless-stopped
    ports:
      - "5003:5000"
    volumes:
      - ./data/logs4:/logs:ro
      - ./data/geoip:/geoip:ro
      - ./data/positions4:/data
    environment:
      - TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/logs/access.log
      - TRAEFIK_LOG_DASHBOARD_ERROR_PATH=/logs/access.log
      - TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN=token_for_agent_4_replace_me
      - TRAEFIK_LOG_DASHBOARD_SYSTEM_MONITORING=true
      - TRAEFIK_LOG_DASHBOARD_GEOIP_ENABLED=true
      - TRAEFIK_LOG_DASHBOARD_GEOIP_CITY_DB=/geoip/GeoLite2-City.mmdb
      - TRAEFIK_LOG_DASHBOARD_GEOIP_COUNTRY_DB=/geoip/GeoLite2-Country.mmdb
      - TRAEFIK_LOG_DASHBOARD_LOG_FORMAT=json
      - PORT=5000
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/api/logs/status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - traefik-network

  # ============================================
  # AGENT 5 - Fifth Location/Server
  # ============================================
  traefik-agent-5:
    image: hhftechnology/traefik-log-dashboard-agent:dev-dashboard
    container_name: traefik-log-dashboard-agent-5
    restart: unless-stopped
    ports:
      - "5004:5000"
    volumes:
      - ./data/logs5:/logs:ro
      - ./data/geoip:/geoip:ro
      - ./data/positions5:/data
    environment:
      - TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/logs/access.log
      - TRAEFIK_LOG_DASHBOARD_ERROR_PATH=/logs/access.log
      - TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN=token_for_agent_5_replace_me
      - TRAEFIK_LOG_DASHBOARD_SYSTEM_MONITORING=true
      - TRAEFIK_LOG_DASHBOARD_GEOIP_ENABLED=true
      - TRAEFIK_LOG_DASHBOARD_GEOIP_CITY_DB=/geoip/GeoLite2-City.mmdb
      - TRAEFIK_LOG_DASHBOARD_GEOIP_COUNTRY_DB=/geoip/GeoLite2-Country.mmdb
      - TRAEFIK_LOG_DASHBOARD_LOG_FORMAT=json
      - PORT=5000
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/api/logs/status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - traefik-network

networks:
  traefik-network:
    external: true
```

**Directory Structure Required:**
```bash
mkdir -p data/{logs,logs2,logs3,logs4,logs5,geoip,positions,positions2,positions3,positions4,positions5,dashboard}
chmod 755 data/*
chown -R 1001:1001 ./data/dashboard
```

**Generate Unique Tokens:**
```bash
# Generate 5 unique tokens for each agent
for i in {1..5}; do
  echo "Agent $i token: $(openssl rand -hex 32)"
done

# Replace token_for_agent_X_replace_me with generated tokens
```

**Register Additional Agents in Dashboard:**
After starting services, navigate to Settings → Agents in the dashboard and the environment agent (Agent 1) will be automatically registered. Agent 2-5 can be added manually or left to be discovered.

---

## 4. Production Setup with Resource Limits

Configuration with resource limits and best practices for production deployment.

```yaml
services:
  traefik-agent:
    image: hhftechnology/traefik-log-dashboard-agent:dev-dashboard
    container_name: traefik-log-dashboard-agent
    restart: unless-stopped
    ports:
      - "5000:5000"
    volumes:
      - ./data/logs:/logs:ro
      - ./data/geoip:/geoip:ro
      - ./data/positions:/data
    environment:
      - TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/logs/access.log
      - TRAEFIK_LOG_DASHBOARD_ERROR_PATH=/logs/error.log
      - TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN=${AGENT_AUTH_TOKEN}  # Use env file
      - TRAEFIK_LOG_DASHBOARD_SYSTEM_MONITORING=true
      - TRAEFIK_LOG_DASHBOARD_GEOIP_ENABLED=true
      - TRAEFIK_LOG_DASHBOARD_GEOIP_CITY_DB=/geoip/GeoLite2-City.mmdb
      - TRAEFIK_LOG_DASHBOARD_GEOIP_COUNTRY_DB=/geoip/GeoLite2-Country.mmdb
      - TRAEFIK_LOG_DASHBOARD_LOG_FORMAT=json
      - PORT=5000
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/api/logs/status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    networks:
      - traefik-network

  traefik-dashboard:
    image: hhftechnology/traefik-log-dashboard:dev-dashboard
    container_name: traefik-log-dashboard
    restart: unless-stopped
    user: "1001:1001"
    ports:
      - "3000:3000"
    volumes:
      - ./data/dashboard:/app/data
    environment:
      - AGENT_API_URL=http://traefik-agent:5000
      - AGENT_API_TOKEN=${AGENT_AUTH_TOKEN}  # Use env file
      - AGENT_NAME=Production Agent
      - NODE_ENV=production
      - PORT=3000
      - NEXT_PUBLIC_SHOW_DEMO_PAGE=true
      - NEXT_PUBLIC_MAX_LOGS_DISPLAY=500
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    depends_on:
      traefik-agent:
        condition: service_healthy
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    networks:
      - traefik-network

networks:
  traefik-network:
    external: true
```

**Create .env file:**
```bash
cat > .env << 'EOF'
# Agent Authentication Token
AGENT_AUTH_TOKEN=your_secure_token_here
EOF

chmod 600 .env
```

**Production Best Practices:**
- ✅ Use environment variables for sensitive data
- ✅ Set resource limits to prevent resource exhaustion
- ✅ Configure log rotation for container logs
- ✅ Use specific image tags instead of `:latest`
- ✅ Regular backups of SQLite database
- ✅ Monitor health check status

---

## 5. Remote Agent Setup

Configuration for agents running on different servers.

**On Remote Server (Agent Host):**

```yaml
# docker-compose-remote-agent.yml
services:
  traefik-agent:
    image: hhftechnology/traefik-log-dashboard-agent:dev-dashboard
    container_name: traefik-log-dashboard-agent
    restart: unless-stopped
    ports:
      - "5000:5000"
    volumes:
      - /path/to/traefik/logs:/logs:ro
      - ./geoip:/geoip:ro
      - ./positions:/data
    environment:
      - TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/logs/access.log
      - TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN=unique_token_for_this_remote_agent
      - TRAEFIK_LOG_DASHBOARD_SYSTEM_MONITORING=true
      - TRAEFIK_LOG_DASHBOARD_GEOIP_ENABLED=true
      - TRAEFIK_LOG_DASHBOARD_GEOIP_CITY_DB=/geoip/GeoLite2-City.mmdb
      - TRAEFIK_LOG_DASHBOARD_GEOIP_COUNTRY_DB=/geoip/GeoLite2-Country.mmdb
      - TRAEFIK_LOG_DASHBOARD_LOG_FORMAT=json
      - PORT=5000
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/api/logs/status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

**Start Remote Agent:**
```bash
docker compose -f docker-compose-remote-agent.yml up -d
```

**On Central Dashboard Server:**

```yaml
# docker-compose.yml
services:
  traefik-dashboard:
    image: hhftechnology/traefik-log-dashboard:dev-dashboard
    container_name: traefik-log-dashboard
    restart: unless-stopped
    user: "1001:1001"
    ports:
      - "3000:3000"
    volumes:
      - ./data/dashboard:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3000
      # Display Configuration
      - NEXT_PUBLIC_SHOW_DEMO_PAGE=true
      - NEXT_PUBLIC_MAX_LOGS_DISPLAY=500
      # No default agent defined - will add via UI
```

**Register Remote Agent in Dashboard:**
1. Open dashboard at http://dashboard-server:3000
2. Navigate to Settings → Agents
3. Click "Add Agent"
4. Fill in:
   - Name: "Remote Server 1"
   - URL: `http://remote-server-ip:5000`
   - Token: `unique_token_for_this_remote_agent`
   - Location: off-site
5. Click Save

**Security Considerations for Remote Agents:**
- ⚠️ Use HTTPS/TLS for production
- ⚠️ Configure firewall rules (allow only dashboard IP)
- ⚠️ Use VPN or private network when possible
- ⚠️ Rotate tokens regularly
- ⚠️ Monitor agent access logs

---

##  Security Best Practices

### 1. Token Generation
```bash
# Generate cryptographically secure tokens
openssl rand -hex 32

# Or use multiple tokens for different agents
for i in {1..5}; do
  echo "Agent $i: $(openssl rand -hex 32)"
done
```

### 2. Use Environment Files
```yaml
# .env
AGENT_AUTH_TOKEN=your_secure_token_here

# docker-compose.yml
environment:
  - TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN=${AGENT_AUTH_TOKEN}
```

### 3. Read-Only Volumes
```yaml
volumes:
  - ./logs:/logs:ro  # Read-only mount
```

### 4. Network Isolation
```yaml
networks:
  traefik-network:
    external: true  # Use existing network
    # OR
    # internal: true  # No external access
```

### 5. Resource Limits
```yaml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 512M
```

---

##  Quick Start Commands

### Start Services
```bash
# Pull latest images
docker compose pull

# Start in foreground (see logs)
docker compose up

# Start in background
docker compose up -d

# View logs
docker compose logs -f
```

### Stop Services
```bash
# Stop services
docker compose stop

# Stop and remove containers
docker compose down

# Stop, remove containers, and remove volumes
docker compose down -v
```

### Manage Services
```bash
# Restart a specific service
docker compose restart traefik-agent

# View service status
docker compose ps

# Execute command in container
docker compose exec traefik-agent sh
```

### Debugging
```bash
# View logs for specific service
docker compose logs -f traefik-agent

# Check health status
docker compose ps

# Test agent endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/logs/status
```

---

##  Additional Resources

- **Main README**: [../README.md](../README.md)
- **Migration Guide**: [./docs/MigrationV1toV2.md](./docs/MigrationV1toV2.md)
- **Troubleshooting**: See README.md Troubleshooting section

---

**Made with ❤️ by the HHF Technology Team**