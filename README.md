<div align="center">
    <h1 align="center"><a href="https://github.com/hhftechnology/traefik-log-dashboard">Traefik Log Dashboard</a></h1>
</div>

A comprehensive analytics platform for Traefik access logs with three deployment options: a Go-based API agent, a modern Next.js web dashboard, and a beautiful terminal-based CLI.

<div align="center">
    
[![Docker](https://img.shields.io/docker/pulls/hhftechnology/traefik-log-dashboard?style=flat-square)](https://hub.docker.com/r/hhftechnology/traefik-log-dashboard)
[![Docker](https://img.shields.io/docker/pulls/hhftechnology/traefik-log-dashboard-agent?style=flat-square)](https://hub.docker.com/r/hhftechnology/traefik-log-dashboard-agent)
![Stars](https://img.shields.io/github/stars/hhftechnology/traefik-log-dashboard?style=flat-square)
[![Discord](https://img.shields.io/discord/994247717368909884?logo=discord&style=flat-square)](https://discord.gg/HDCt9MjyMJ)

**A comprehensive real-time analytics platform for Traefik reverse proxy logs**

</div>

---

##  Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Quick Start](#quick-start)
- [Multi-Agent Setup](#multi-agent-setup)
- [Agent Database Management](#agent-database-management)
- [GeoIP Database Setup](#geoip-database-setup)
- [Dashboard Cards Explained](#dashboard-cards-explained)
- [Filter Logs & API Usage](#filter-logs--api-usage)
- [Configuration](#configuration)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)

---

## ** MIGRATION GUIDE from V1 to V2**: [./docs/MigrationV1toV2.md](./docs/MigrationV1toV2.md)

---

##  Overview

Traefik Log Dashboard is a powerful analytics platform that provides real-time insights into your Traefik reverse proxy traffic. It consists of three components that work together:

1. **Agent** - Go-based backend API that parses logs and exposes metrics
2. **Dashboard** - Next.js web UI with interactive charts and real-time updates
3. **CLI** - Beautiful terminal-based dashboard (optional)

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/7eb3bd6f-f195-4fbb-babc-140e4a37451f" />
---
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/cb97cf90-a670-4afc-8e92-17b39fb03c7b" />
---
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/1c534efa-bfaf-4603-9b87-d69a736a8a67" />
---
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/7e659846-db62-4825-bfe3-218081c66450" />
---
<img width="1735" height="1532" alt="image" src="https://github.com/user-attachments/assets/29a0df2a-3ff3-4204-ba06-7bc34f39f7c6" />
---
<img width="1735" height="810" alt="image" src="https://github.com/user-attachments/assets/94059cb8-dec7-49cc-9531-51270f314ba7" />

<img width="1877" height="7800" alt="image" src="https://github.com/user-attachments/assets/ba81077f-95b0-4a73-82ab-bb9e75d4c04a" />

### What's New in v2.x

- ✅ **Multi-Agent Architecture** - Manage multiple Traefik instances from a single dashboard
- ✅ **Persistent Agent Database** - SQLite-based storage for agent configurations
- ✅ **Environment-Protected Agents** - Agents defined in docker-compose.yml cannot be deleted from UI
- ✅ **Enhanced Error Handling** - Better error messages and user feedback
- ✅ **Improved Performance** - Parallel fetching and optimized state management
- ✅ **Fixed Date Handling** - Proper ISO string and Date object conversion
- ✅ **Better Agent Status Tracking** - lastSeen timestamp with proper persistence

---

##  Architecture

### Multi-Agent Architecture

The platform supports a **multi-agent architecture** where you can deploy multiple agent instances across different Traefik installations and aggregate their data through a single dashboard.

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard (Next.js)                       │
│           SQLite DB for Agent Configuration                  │
└─────────────────────────────────────────────────────────────┘
                    │
                    │ HTTP + Token Auth
                    │
        ┌───────────┴───────────┬──────────────┬──────────────┐
        │                       │              │              │
        ▼                       ▼              ▼              ▼
┌──────────────┐        ┌──────────────┐  ┌──────────────┐ ┌──────────────┐
│  Agent #1    │        │  Agent #2    │  │  Agent #3    │ │  Agent #N    │
│ (Datacenter) │        │ (Cloud)      │  │ (Edge)       │ │ ...          │
└──────────────┘        └──────────────┘  └──────────────┘ └──────────────┘
        │                       │              │              │
        ▼                       ▼              ▼              ▼
┌──────────────┐        ┌──────────────┐  ┌──────────────┐ ┌──────────────┐
│   Traefik    │        │   Traefik    │  │   Traefik    │ │   Traefik    │
│ access.log   │        │ access.log   │  │ access.log   │ │ access.log   │
└──────────────┘        └──────────────┘  └──────────────┘ └──────────────┘
```

**Key Architectural Components:**

1. **Dashboard** - Centralized web UI that communicates with multiple agents
2. **Agents** - Deployed alongside each Traefik instance to parse local logs
3. **SQLite Database** - Stores agent configurations, status, and metadata
4. **Token Authentication** - Secures communication between dashboard and agents

---

##  Features

### Dashboard Features
-  Real-time analytics and metrics visualization
-  GeoIP integration with country and city mapping
-  Request rate, response time, and error tracking
-  Advanced filtering by status code, method, service, router
-  Responsive design for desktop and mobile
-  Modern UI with dark mode support
-  Auto-refresh with configurable intervals
-  Persistent agent configuration with SQLite

### Multi-Agent Capabilities
-  Manage unlimited agent connections
-  Organize agents by location (on-site/off-site)
-  Real-time status monitoring with health checks
-  Tag and categorize agents
-  Individual authentication tokens per agent
-  Aggregate or individual agent views
-  Protected environment agents (cannot delete from UI)

### Agent Features
-  High-performance Go-based log parser
-  JSON and Common Log Format support
-  Position tracking for efficient log reading
-  MaxMind GeoIP database integration
-  System resource monitoring
-  Bearer token authentication
-  RESTful API with comprehensive endpoints

---

##  Quick Start

### Prerequisites

- Docker and Docker Compose
- Traefik configured with JSON access logs
- (Optional) MaxMind GeoIP databases for geolocation

### Single Agent Setup

1. **Create directory structure:**

```bash
mkdir -p traefik-dashboard/{data/{logs,geoip,positions,dashboard}}
cd traefik-dashboard
```

2. **Create `docker-compose.yml`:**

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
      - ./data/geoip:/geoip:ro  # MaxMind GeoIP databases
      - ./data/positions:/data
    environment:
      # Log Paths
      - TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/logs/access.log
      - TRAEFIK_LOG_DASHBOARD_ERROR_PATH=/logs/access.log
      
      # Authentication
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
      # Agent Configuration (Default/Environment Agent)
      - AGENT_API_URL=http://traefik-agent:5000
      - AGENT_API_TOKEN=d41d8cd98f00b204e9800998ecf8427e
      - AGENT_NAME=Default Agent  # Optional: Name for environment agent
      
      # Node Environment
      - NODE_ENV=production
      - PORT=3000
    depends_on:
      traefik-agent:
        condition: service_healthy
    networks:
      - traefik-network

networks:
  traefik-network:
    external: true
```

3. **Generate secure authentication token:**

```bash
# Generate a strong token
openssl rand -hex 32

# Update both TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN and AGENT_API_TOKEN with this value
```

4. **Start the services:**

```bash
docker compose up -d
```

5. **Access the dashboard:**

Open your browser to http://localhost:3000

---

##  Multi-Agent Setup

To monitor multiple Traefik instances, deploy additional agents and register them in the dashboard.

### Option 1: Additional Environment Agents

Add more agent services to your docker-compose.yml:

```yaml
services:
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
      - TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN=your_token_for_agent_2
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
      - TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN=your_token_for_agent_3
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
```

### Option 2: Register Agents via Dashboard UI

1. Navigate to **Settings → Agents** in the dashboard
2. Click **Add Agent**
3. Fill in agent details:
   - **Name**: Descriptive name (e.g., "Production Datacenter")
   - **URL**: Agent API endpoint (e.g., "http://agent-host:5000")
   - **Token**: Authentication token for this agent
   - **Location**: on-site or off-site
   - **Description**: Optional notes
   - **Tags**: Optional labels for organization

4. Click **Save** to register the agent

### Option 3: Remote Agents

Deploy agents on different servers:

**On Remote Server:**
```bash
docker run -d \
  --name traefik-agent \
  -p 5000:5000 \
  -v /path/to/traefik/logs:/logs:ro \
  -v /path/to/geoip:/geoip:ro \
  -v /path/to/positions:/data \
  -e TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/logs/access.log \
  -e TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN=your_secure_token \
  -e TRAEFIK_LOG_DASHBOARD_GEOIP_ENABLED=true \
  -e TRAEFIK_LOG_DASHBOARD_GEOIP_CITY_DB=/geoip/GeoLite2-City.mmdb \
  -e TRAEFIK_LOG_DASHBOARD_GEOIP_COUNTRY_DB=/geoip/GeoLite2-Country.mmdb \
  hhftechnology/traefik-log-dashboard-agent:dev-dashboard
```

**Register in Dashboard:**
- URL: `http://remote-server-ip:5000`
- Token: `your_secure_token`

---

##  Agent Database Management

### Database Schema

The dashboard uses SQLite to persist agent configurations:

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,              -- Auto-generated: agent-001, agent-002, etc.
  name TEXT NOT NULL,               -- Display name
  url TEXT NOT NULL,                -- Agent API URL
  token TEXT NOT NULL,              -- Authentication token
  location TEXT NOT NULL,           -- 'on-site' or 'off-site'
  number INTEGER NOT NULL,          -- Sequential number
  status TEXT,                      -- 'online', 'offline', 'checking'
  last_seen TEXT,                   -- ISO timestamp of last successful check
  description TEXT,                 -- Optional description
  tags TEXT,                        -- JSON array of tags
  source TEXT NOT NULL DEFAULT 'manual',  -- 'env' or 'manual'
  created_at TEXT NOT NULL,         -- Creation timestamp
  updated_at TEXT NOT NULL          -- Last update timestamp
);

CREATE TABLE selected_agent (
  id INTEGER PRIMARY KEY CHECK(id = 1),  -- Singleton table
  agent_id TEXT NOT NULL,                -- Currently selected agent
  updated_at TEXT NOT NULL               -- Selection timestamp
);
```

### Agent Sources

**Environment Agents (`source='env'`):**
- Automatically synced from docker-compose.yml environment variables
- Cannot be deleted from the dashboard UI
- Displayed with a 🔒 lock icon
- Updated on dashboard restart if environment changes

**Manual Agents (`source='manual'`):**
- Added through the dashboard UI
- Fully editable and deletable
- Stored persistently in SQLite database

### Environment Agent Configuration

Define agents in docker-compose.yml:

```yaml
traefik-dashboard:
  environment:
    # This creates a protected environment agent
    - AGENT_API_URL=http://traefik-agent:5000
    - AGENT_API_TOKEN=your_secure_token
    - AGENT_NAME=Production Agent  # Optional, defaults to "Environment Agent"
```

The dashboard will automatically:
1. Create/update agent with ID `agent-env-001`
2. Mark it as `source='env'`
3. Protect it from UI deletion
4. Sync changes on restart

### Database Location

By default: `./data/dashboard/agents.db`

Custom path:
```yaml
traefik-dashboard:
  environment:
    - DATABASE_PATH=/custom/path/agents.db
```

### Backup and Restore

**Backup:**
```bash
# Copy the database file
cp ./data/dashboard/agents.db ./backups/agents-$(date +%Y%m%d).db
```

**Restore:**
```bash
# Stop dashboard
docker compose stop traefik-dashboard

# Restore database
cp ./backups/agents-20250101.db ./data/dashboard/agents.db

# Start dashboard
docker compose start traefik-dashboard
```

---

##  GeoIP Database Setup

### Download MaxMind Databases

1. **Sign up for MaxMind account** (free):
   https://www.maxmind.com/en/geolite2/signup

2. **Generate license key**:
   - Login → Account → Manage License Keys
   - Create new license key

3. **Download databases manually**:
   ```bash
   cd data/geoip
   
   # Download GeoLite2-City
   wget "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=YOUR_LICENSE_KEY&suffix=tar.gz" -O GeoLite2-City.tar.gz
   
   # Download GeoLite2-Country
   wget "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=YOUR_LICENSE_KEY&suffix=tar.gz" -O GeoLite2-Country.tar.gz
   
   # Extract
   tar -xzf GeoLite2-City.tar.gz --strip-components=1
   tar -xzf GeoLite2-Country.tar.gz --strip-components=1
   
   # Clean up
   rm *.tar.gz
   ```

4. **Automated Updates** (using geoipupdate):
   ```bash
   docker run -d \
     --name geoipupdate \
     -v ./data/geoip:/usr/share/GeoIP \
     -e GEOIPUPDATE_ACCOUNT_ID=your_account_id \
     -e GEOIPUPDATE_LICENSE_KEY=your_license_key \
     -e GEOIPUPDATE_EDITION_IDS="GeoLite2-City GeoLite2-Country" \
     -e GEOIPUPDATE_FREQUENCY=168  # Update weekly
     maxmindinc/geoipupdate
   ```

### Verify GeoIP Setup

```bash
# Check files exist
ls -lh data/geoip/

# Should show:
# GeoLite2-City.mmdb
# GeoLite2-Country.mmdb

# Test agent GeoIP endpoint
curl -H "Authorization: Bearer your_token" \
  http://localhost:5000/api/location/status
```

---

##  Dashboard Cards Explained

### Overview Cards

**Total Requests**: Aggregate count of all HTTP requests processed

**Average Response Time**: Mean response time across all requests (in milliseconds)

**Error Rate**: Percentage of requests with 4xx or 5xx status codes

**Active Services**: Number of unique Traefik services handling traffic

### Geographic Cards

**Top Countries**: Requests grouped by country (requires GeoIP)

**Top Cities**: Requests grouped by city (requires GeoIP)

**Interactive Map**: Geographic heatmap visualization

### Traffic Analysis

**Requests by Status Code**: Distribution of 2xx, 3xx, 4xx, 5xx responses

**Top Services**: Most active Traefik services by request count

**Top Routers**: Most active Traefik routers by request count

**Methods Distribution**: HTTP methods (GET, POST, PUT, DELETE, etc.)

### Performance Metrics

**Response Time Chart**: Time-series graph of response times

**Request Rate**: Requests per second/minute/hour

**Slowest Endpoints**: Top 10 slowest routes by average response time

**Error Timeline**: Time-series of error occurrences

---

##  Filter Logs & API Usage

### Dashboard Filters

Available in the top toolbar:

- **Time Range**: Last 1h, 6h, 24h, 7d, 30d, or custom range
- **Status Codes**: Filter by 2xx, 3xx, 4xx, 5xx
- **HTTP Methods**: GET, POST, PUT, DELETE, PATCH, OPTIONS
- **Services**: Filter by Traefik service name
- **Routers**: Filter by Traefik router name
- **Search**: Free-text search across all fields

### API Endpoints

**Get Logs:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/logs/access?lines=100&status=200&method=GET"
```

**Get Status:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/logs/status"
```

**Get Metrics:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/logs/metrics?period=1h"
```

**GeoIP Lookup:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/location/lookup?ip=8.8.8.8"
```

**System Stats:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/system/stats"
```

---

##  Configuration

### Agent Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `TRAEFIK_LOG_DASHBOARD_ACCESS_PATH` | Path to Traefik access log | `/logs/access.log` | Yes |
| `TRAEFIK_LOG_DASHBOARD_ERROR_PATH` | Path to Traefik error log | - | No |
| `TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN` | Bearer token for authentication | - | Yes |
| `TRAEFIK_LOG_DASHBOARD_LOG_FORMAT` | Log format (json/common) | `json` | No |
| `TRAEFIK_LOG_DASHBOARD_SYSTEM_MONITORING` | Enable system monitoring | `true` | No |
| `TRAEFIK_LOG_DASHBOARD_GEOIP_ENABLED` | Enable GeoIP lookups | `false` | No |
| `TRAEFIK_LOG_DASHBOARD_GEOIP_CITY_DB` | Path to GeoLite2-City.mmdb | - | If GeoIP enabled |
| `TRAEFIK_LOG_DASHBOARD_GEOIP_COUNTRY_DB` | Path to GeoLite2-Country.mmdb | - | If GeoIP enabled |
| `PORT` | Agent listen port | `5000` | No |

### Dashboard Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AGENT_API_URL` | Default agent URL (for env agent) | - | Yes (for env agent) |
| `AGENT_API_TOKEN` | Default agent token (for env agent) | - | Yes (for env agent) |
| `AGENT_NAME` | Name for environment agent | `Environment Agent` | No |
| `NODE_ENV` | Node environment | `production` | No |
| `PORT` | Dashboard listen port | `3000` | No |
| `DATABASE_PATH` | SQLite database location | `./data/agents.db` | No |

### Traefik Configuration

Configure Traefik to output JSON access logs:

```yaml
# traefik.yml
accessLog:
  filePath: "/logs/access.log"
  format: json
  bufferingSize: 100
  
  fields:
    defaultMode: keep
    names:
      ClientUsername: drop
    headers:
      defaultMode: keep
      names:
        Authorization: drop
        Cookie: drop
```

---

##  Performance

### Optimizations in v2.x

- **Parallel Fetching**: Dashboard fetches agents and selected agent in parallel
- **Optimized State Management**: Direct state updates instead of full refreshes
- **Position Tracking**: Agents only read new log entries, not entire file
- **Database Indexing**: Indexes on `source` and `status` columns
- **Efficient Date Handling**: Proper ISO string and Date object conversion

### Resource Usage

**Agent:**
- CPU: ~5-10% (idle) / ~20-30% (heavy traffic)
- Memory: ~50-100 MB
- Disk: Minimal (position files < 1 KB)

**Dashboard:**
- CPU: ~5% (idle) / ~15% (active)
- Memory: ~150-200 MB
- Database: ~1-10 MB (depending on agent count)

### Scaling Recommendations

- **< 1000 req/sec**: Single agent sufficient
- **1000-10,000 req/sec**: Single agent with optimized log rotation
- **> 10,000 req/sec**: Consider multiple agents with load balancing
- **Multiple Locations**: Deploy agent per location for better latency

---

##  Troubleshooting

### Dashboard Shows "Connection Error"

**Symptoms:**
- Red connection error banner
- No data displayed

**Solutions:**
```bash
# Check agent is running
docker ps | grep traefik-agent

# Check agent logs
docker logs traefik-log-dashboard-agent

# Verify agent is accessible from dashboard
docker exec traefik-log-dashboard wget -O- http://traefik-agent:5000/api/logs/status

# Check authentication token matches
docker exec traefik-agent env | grep AUTH_TOKEN
docker exec traefik-dashboard env | grep AGENT_API_TOKEN
```

### Cannot Delete Agent

**Symptoms:**
- Delete button disabled or shows error
- Error: "Cannot delete environment-sourced agents"

**Cause:** Agent is defined in docker-compose.yml environment variables

**Solution:**
```bash
# Environment agents (source='env') are protected
# They can only be removed by:
# 1. Removing environment variables from docker-compose.yml
# 2. Restarting the dashboard

docker compose down
# Edit docker-compose.yml - remove AGENT_API_URL and AGENT_API_TOKEN
docker compose up -d
```

### GeoIP Not Working

**Symptoms:**
- Geographic cards show "No data"
- Countries show as empty

**Solutions:**
```bash
# Verify databases exist
ls -lh ./data/geoip/

# Check agent logs for GeoIP errors
docker logs traefik-log-dashboard-agent | grep -i geoip

# Verify environment variables
docker exec traefik-agent env | grep GEOIP

# Test GeoIP lookup
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/location/status"

# Re-download databases if corrupted
cd data/geoip
rm *.mmdb
# Follow GeoIP setup instructions above
```

### No Logs Appearing

**Symptoms:**
- Dashboard shows zero requests
- All cards empty

**Solutions:**
```bash
# Verify log file path is correct
docker exec traefik-agent ls -lh /logs/

# Check log file permissions (should be readable)
docker exec traefik-agent cat /logs/access.log | head -5

# Verify log format matches configuration
# Should be JSON format:
docker exec traefik-agent head -1 /logs/access.log

# Check Traefik is generating logs
tail -f /path/to/your/traefik/logs/access.log
```

### High Memory Usage

**Symptoms:**
- Agent consuming excessive memory
- Dashboard slow or unresponsive

**Solutions:**
```bash
# Enable log rotation in Traefik
# traefik.yml:
# accessLog:
#   filePath: "/logs/access.log"
#   maxSize: 100  # MB
#   maxBackups: 3
#   maxAge: 7     # days

# Reduce dashboard refresh interval
# In UI: Settings → Refresh Interval → 30s or 60s

# Check database size
du -sh data/dashboard/agents.db

# Vacuum database if large
docker exec traefik-dashboard sqlite3 /app/data/agents.db "VACUUM;"
```

### Agent Status Stuck on "Checking"

**Symptoms:**
- Agent status never changes from "checking"
- No lastSeen timestamp

**Solutions:**
```bash
# Manually check agent status
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://agent-url:5000/api/logs/status

# Check network connectivity
docker exec traefik-dashboard ping -c 3 traefik-agent

# Verify token is correct
# In Dashboard: Settings → Agents → Edit Agent → Update Token

# Force status refresh
# In Dashboard: Settings → Agents → Click refresh button
```

### Database Locked Error

**Symptoms:**
- Error: "database is locked"
- Agent operations fail

**Solutions:**
```bash
# Stop dashboard
docker compose stop traefik-dashboard

# Check for stale locks
ls -la data/dashboard/

# Remove lock files if present
rm data/dashboard/agents.db-shm
rm data/dashboard/agents.db-wal

# Restart dashboard
docker compose start traefik-dashboard
```

---

##  Additional Resources

- **Agent Documentation**: [./agent/README.md](./agent/README.md)
- **Dashboard Documentation**: [./dashboard/README.md](./dashboard/README.md)
- **CLI Documentation**: [./cli/README.md](./cli/README.md)
- **API Reference**: [./docs/API.md](./docs/API.md)
- **Architecture Guide**: [./docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Migration Guide V1→V2**: [./docs/MigrationV1toV2.md](./docs/MigrationV1toV2.md)

---

##  Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md).

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

##  License

This project is licensed under the GNU AFFERO GENERAL PUBLIC LICENSE - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ for the Traefik community**

⭐ Star this repo if you find it helpful!

[GitHub](https://github.com/hhftechnology/traefik-log-dashboard) • [Discord](https://discord.gg/HDCt9MjyMJ) • [Issues](https://github.com/hhftechnology/traefik-log-dashboard/issues)

</div>
