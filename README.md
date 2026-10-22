<div align="center">
    <h1>Traefik Log Dashboard</h1>
    <p>Comprehensive real-time analytics platform for Traefik reverse proxy logs</p>

[![Docker](https://img.shields.io/docker/pulls/hhftechnology/traefik-log-dashboard?style=flat-square)](https://hub.docker.com/r/hhftechnology/traefik-log-dashboard)
[![Docker](https://img.shields.io/docker/pulls/hhftechnology/traefik-log-dashboard-agent?style=flat-square)](https://hub.docker.com/r/hhftechnology/traefik-log-dashboard-agent)
![Stars](https://img.shields.io/github/stars/hhftechnology/traefik-log-dashboard?style=flat-square)
[![Discord](https://img.shields.io/discord/994247717368909884?logo=discord&style=flat-square)](https://discord.gg/HDCt9MjyMJ)
</div>

## Components

| Component | Description | Image Size (linux/amd64) |
|-----------|-------------|------------------------|
| **Agent** | Lightweight Go service that parses Traefik logs and exposes metrics via REST API | <!-- AGENT_IMAGE_SIZE_START -->15MB<!-- AGENT_IMAGE_SIZE_END --> |
| **Dashboard** | Vite web UI with real-time analytics, charts, and geographic visualization | <!-- DASHBOARD_IMAGE_SIZE_START -->151MB<!-- DASHBOARD_IMAGE_SIZE_END --> |
| **CLI** | Terminal-based dashboard using Bubble Tea (optional) | N/A |

---
### Traefik Dashboard mobile app.

<div align="center">
<a href="https://apps.apple.com/us/app/#"><img width="135" height="39" alt="appstore" src="https://github.com/user-attachments/assets/45e31a11-cf6b-40a2-a083-6dc8d1f01291" /></a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href="https://play.google.com/store/apps/details?id=com.traefik.logdashboard"><img width="135" height="39" alt="googleplay" src="https://github.com/user-attachments/assets/acbba639-858f-4c74-85c7-92a4096efbf5" /></a>
</div>

### All apps are Pangolin and Basis auth supported.
---
<img width="1920" height="1440" alt="dashboard" src="https://github.com/user-attachments/assets/711a026b-c779-4b56-8be6-8471b9a7c144" />
<img width="1920" height="1440" alt="client_dashboard" src="https://github.com/user-attachments/assets/8b3e9c85-00bb-473d-a0d8-695829b8e7d0" />
<img width="1920" height="1440" alt="traffic_dashboard" src="https://github.com/user-attachments/assets/0077490c-4677-4c5a-87d2-d1ea25c42899" />
<img width="1920" height="1440" alt="system_dashboard" src="https://github.com/user-attachments/assets/d769d9be-5232-4360-9d40-605ead33a7e4" />
<img width="1920" height="1440" alt="overview_dashboard" src="https://github.com/user-attachments/assets/e9abfc8b-cea3-4913-86db-e8efdd8879e8" />
<img width="1920" height="1440" alt="maps_dashboard" src="https://github.com/user-attachments/assets/1ddfa5fd-eb15-43fd-a36a-39341d8c22ae" />
<img width="1920" height="1440" alt="logs_dashboard" src="https://github.com/user-attachments/assets/ad535e44-d0f7-491e-be2f-de0a409597f6" />
<img width="1920" height="1440" alt="filter_dashboard" src="https://github.com/user-attachments/assets/8412d9ce-e7df-404a-be66-d8639be0115d" />

image.png

## Quick Start

Get started in under 5 minutes with Docker Compose:

### 1. Create Project Structure

```bash
mkdir -p traefik-dashboard/data/{logs,positions,dashboard}
cd traefik-dashboard
```

### 2. Create docker-compose.yml

```yaml
services:
  traefik-agent:
    image: hhftechnology/traefik-log-dashboard-agent:latest
    container_name: traefik-log-dashboard-agent
    restart: unless-stopped
    ports:
      - "5000:5000"
    volumes:
      - ./data/logs:/logs:ro
      - ./data/positions:/data
    environment:
      - TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/logs/access.log
      - TRAEFIK_LOG_DASHBOARD_ERROR_PATH=/logs/traefik.log
      - TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN=your_secure_token_here
      - TRAEFIK_LOG_DASHBOARD_SYSTEM_MONITORING=true
      - TRAEFIK_LOG_DASHBOARD_LOG_FORMAT=json
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/api/logs/status"]
      interval: 2m
      timeout: 10s
      retries: 3
      start_period: 30s
    networks:
      - pangolin

  traefik-dashboard:
    image: hhftechnology/traefik-log-dashboard:latest
    container_name: traefik-log-dashboard
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data/dashboard:/app/data
      - ./data/positions:/data
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
      - pangolin

networks:
  pangolin:
    external: true
```

### 3. Generate Secure Token

```bash
openssl rand -hex 32
```

Update both `TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN` and `AGENT_API_TOKEN` with this value.

### 4. Start Services

```bash
# Create network if it doesn't exist

[![Discuss on the HHF forum](https://img.shields.io/badge/discuss-forum.hhf.technology-AD1457?logo=discourse&logoColor=white)](https://forum.hhf.technology/c/traefik-plugins-tools/traefik-log-dashboard)
docker network create traefik-network 2>/dev/null || true

# Start services
docker compose up -d
```

### 5. Access Dashboard

Open http://localhost:3000 in your browser.

---

## Key Features

- **Multi-Agent Architecture** - Manage multiple Traefik instances from a single dashboard
- **Interactive 3D Globe** - Geographic visualization with smooth map transitions
- **Automatic GeoIP** - IP geolocation works out of the box (no setup required)
- **Advanced Filtering** - Include/exclude modes, geographic and custom filters
- **Background Alerting** - Discord webhooks, daily summaries, threshold alerts
- **High Performance** - Go-based agent, optimized log parsing, position tracking
- **Terminal Dashboard** - Beautiful CLI with Bubble Tea (optional)

---

## Environment Variables

### Agent

| Variable | Description | Default |
|----------|-------------|---------|
| `TRAEFIK_LOG_DASHBOARD_ACCESS_PATH` | Path to access log file/directory | `/var/log/traefik/access.log` |
| `TRAEFIK_LOG_DASHBOARD_ERROR_PATH` | Path to error log file/directory | `/var/log/traefik/traefik.log` |
| `TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN` | Authentication token | Required |
| `TRAEFIK_LOG_DASHBOARD_SYSTEM_MONITORING` | Enable system monitoring | `true` |
| `TRAEFIK_LOG_DASHBOARD_LOG_FORMAT` | Log format (`json` or `common`) | `json` |
| `PORT` | Agent listen port | `5000` |

### Dashboard

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_1_URL` | First environment agent URL | Required (or `DASHBOARD_AGENTS_JSON`) |
| `AGENT_1_TOKEN` | First environment agent token | Optional |
| `AGENT_1_NAME` | First environment agent name | `Agent 1` |
| `AGENT_2_URL`, `AGENT_3_URL`, ... | Additional environment agents | Optional |
| `DASHBOARD_AGENTS_ENV_ONLY` | Disable UI/API agent mutations | `false` |
| `DASHBOARD_REFRESH_INTERVAL_MS` | Refresh interval | `5000` |
| `DASHBOARD_MAX_LOGS_DISPLAY` | Max logs retained in dashboard state | `1000` |
| `DASHBOARD_TRAFFIC_TOP_ITEMS_LIMIT` | Top-N shown in Traffic lists | `10` |
| `DASHBOARD_PARSER_TREND_WINDOW_MINUTES` | Parser sparkline trend window (15-30) | `30` |
| `SHOW_DEMO_PAGE` | Show demo mode link | `true` |
| `GEOIP_LOOKUP_ENABLED` | Enable dashboard GeoIP lookup API | `true` |
| `GEOIP_PROVIDER_BASE_URL` | GeoIP provider base URL | `https://ipwho.is` |
| `GEOIP_PROVIDER_URLS` | Comma-separated GeoIP provider fallback list | Uses `GEOIP_PROVIDER_BASE_URL` |
| `GEOIP_LOCAL_DB_PATH` | Optional local MaxMind MMDB path | `""` (disabled) |
| `GEOIP_UNKNOWN_CACHE_TTL_MS` | Cache TTL for unresolved lookups | `300000` |

Legacy fallback (still supported): `AGENT_API_URL`, `AGENT_API_TOKEN`, `AGENT_NAME`.

> **GeoIP mode**: The dashboard uses a hybrid resolver chain:
> 1) Optional local MMDB (`GEOIP_LOCAL_DB_PATH`)
> 2) HTTP provider fallback (`GEOIP_PROVIDER_URLS` / `GEOIP_PROVIDER_BASE_URL`)

Example production GeoIP configuration:

```yaml
services:
  traefik-dashboard:
    volumes:
      - ./data/geoip:/geoip:ro
    environment:
      - GEOIP_LOCAL_DB_PATH=/geoip/GeoLite2-City.mmdb
      - GEOIP_PROVIDER_URLS=https://ipwho.is,https://ip-api.com/json
      - GEOIP_UNKNOWN_CACHE_TTL_MS=300000
```

---

## Documentation

Full documentation available at: **[https://traefik-log-dashboard.hhf.technology](https://traefik-log-dashboard.hhf.technology)**

Or run locally:
```bash
cd docs && npm install && npm run dev
```

---

## Community & Support

- **Documentation**: [https://traefik-log-dashboard.hhf.technology](https://traefik-log-dashboard.hhf.technology)
- **Discord**: [Join our community](https://discord.gg/HDCt9MjyMJ)
- **GitHub Issues**: [Report bugs](https://github.com/hhftechnology/traefik-log-dashboard/issues)
- **Docker Hub**: [Agent](https://hub.docker.com/r/hhftechnology/traefik-log-dashboard-agent) | [Dashboard](https://hub.docker.com/r/hhftechnology/traefik-log-dashboard)

---

## License

This project is licensed under the GNU AFFERO GENERAL PUBLIC LICENSE - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ for the Traefik community**

⭐ Star this repo if you find it helpful!

[GitHub](https://github.com/hhftechnology/traefik-log-dashboard) | [Discord](https://discord.gg/HDCt9MjyMJ) | [Documentation](https://traefik-log-dashboard.hhf.technology)

</div>
