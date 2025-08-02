# Traefik Log Dashboard

A real-time dashboard for analyzing Traefik logs with IP geolocation, status code analysis, and service metrics. Built with React (Shadcn UI) and Node.js.

![Dashboard Preview-Light](scripts/dashboard-light.png)
![Dashboard Preview-Dark](scripts/dashboard-dark.png)

## Features

  - **Real-time Log Monitoring**: Live updates via WebSocket.
  - **IP Geolocation**: Track requests by country and city.
  - **Comprehensive Analytics**:
      - Request rate and response times.
      - Status code distribution.
      - Service and router statistics.
      - Error rate monitoring.
  - **Modern UI**: Built with Shadcn UI components.
  - **Containerized**: Easy deployment with Docker.
  - **Auto-refresh**: Stats update every 5 seconds.
  - **Log Filtering**: Filter out unknown router/service names and private IPs.
  - **Pagination**: Paginated log table for better performance.
  - **Configurable Backend Service Name**: No more hardcoded "backend" service name.
  - **IPv6 Address Support**: Proper handling of IPv6 addresses.
  - **Multiple Log Paths Support**: Monitor multiple Traefik instances simultaneously.

## New Features in v1.0.3

### 1. Filter Unknown Service/Router Names
When using Traefik with strict SNI, bot traffic accessing services by IP address results in entries with "unknown" service/router names. You can now filter these out:
- A checkbox in the log table allows hiding entries with unknown service/router names
- The filter persists across page changes and is applied server-side for better performance

### 2. Paginated Log Table
Replaced infinite scroll with traditional pagination:
- Select between 50, 100, or 150 entries per page
- Navigate with page numbers, previous/next buttons
- Shows total entries and current viewing range
- Much better performance with large log files

### 3. IPv6 Support
Fixed IPv6 address truncation issue:
- Properly handles IPv6 addresses with brackets: `[2001:db8::1]:80`
- Correctly extracts IPv6 addresses without truncating at colons
- Supports both IPv4 and IPv6 with or without ports

### 4. Configurable Backend Service Name
The nginx configuration is no longer hardcoded:
- Set custom backend service name via `BACKEND_SERVICE_NAME` environment variable
- Useful when running multiple instances or custom Docker network configurations
- Frontend container automatically uses the configured service name

### 5. Multiple Log Files Support
Monitor logs from multiple Traefik instances:
- Comma-separated list of paths in `TRAEFIK_LOG_PATH`
- Can mix files and directories
- Automatically discovers `.log` files in directories
- Aggregates logs from all sources in real-time

## Prerequisites

  - Docker and Docker Compose
  - Traefik configured with JSON logging
  - Access to Traefik log files

## Quick Start

1.  **Clone the repository**

    ```bash
    git clone https://github.com/hhftechnology/traefik-log-dashboard.git
    cd traefik-log-dashboard
    ```

2.  **Configure log file path**

    Create a `.env` file from the example:

    ```bash
    cp .env.example .env
    ```

    Update your `.env` file with your custom configurations:

    ```env
    # Multiple log paths (comma-separated)
    TRAEFIK_LOG_PATH=/logs/traefik1/,/logs/traefik2/,/var/log/traefik.log

    # Custom backend service name
    BACKEND_SERVICE_NAME=my-backend

    # Container names
    BACKEND_CONTAINER_NAME=my-traefik-backend
    FRONTEND_CONTAINER_NAME=my-traefik-frontend
    ```

3.  **Build and run**

    ```bash
    docker compose down
    docker compose build --no-cache
    docker compose up -d
    ```

4.  **Access the dashboard**

    Open http://localhost:3000 in your browser.

## Configuration

### Traefik Configuration

Ensure Traefik is configured to output JSON logs:

```yaml
# traefik.yml
accessLog:
  filePath: /logs/traefik.log
  format: json
  fields:
    defaultMode: keep
    headers:
      defaultMode: keep
```

### Environment Variables

| Variable | Description | Default | Example |
|---|---|---|---|
| `TRAEFIK_LOG_PATH` | Path to Traefik logs | `/logs` | `/var/log/traefik/access.log` |
| `PORT` | Backend API port | `3001` | `3001` |
| `FRONTEND_PORT` | Frontend port | `3000` | `8080` |
| `NODE_ENV` | Environment | `production` | `development` |
| `BACKEND_SERVICE_NAME` | Backend service name for Docker networking | `backend` | `my-traefik-backend`|
| `BACKEND_CONTAINER_NAME` | Backend container name | `traefik-dashboard-backend` | `my-traefik-backend` |
| `FRONTEND_CONTAINER_NAME`| Frontend container name | `traefik-dashboard-frontend`| `my-traefik-frontend`|

### Docker Compose Options

The `docker-compose.yml` file supports several deployment scenarios:

1.  **Single log file**:
    ```yaml
    volumes:
      - /path/to/traefik.log:/logs/traefik.log:ro
    ```
2.  **Log directory**:
    ```yaml
    volumes:
      - /path/to/log/directory:/logs:ro
    ```
3.  **Named volume** (if using Traefik in Docker):
    ```yaml
    volumes:
      - traefik-logs:/logs:ro
    ```
    
# MaxMind GeoIP2 Integration

Our application now supports offline IP geolocation using MaxMind's GeoIP2 databases, providing faster and more reliable geolocation without relying on external APIs.

## Overview

The MaxMind integration provides:
- **Offline geolocation** - No internet required for IP lookups
- **Better performance** - Local database queries are much faster
- **Rate limit free** - No API rate limits or quotas
- **Privacy** - IP addresses are not sent to external services
- **Reliability** - No dependency on external API availability
- **Fallback support** - Can fallback to online APIs if needed

## Quick Start

### 1. Get MaxMind License Key

1. Sign up for a free MaxMind account: https://www.maxmind.com/en/geolite2/signup
2. Go to your account page and generate a license key
3. Set the license key as an environment variable:
   ```bash
   export MAXMIND_LICENSE_KEY=your_license_key_here
   ```

### 2. Download Database

```bash
# Download the GeoLite2-City database
make maxmind-download

# Or download the Country database (smaller, less detailed)
make maxmind-download-country
```

### 3. Run with MaxMind Enabled

```bash
# Using make
USE_MAXMIND=true MAXMIND_DB_PATH=maxmind/GeoLite2-City.mmdb make run

# Or directly
USE_MAXMIND=true MAXMIND_DB_PATH=maxmind/GeoLite2-City.mmdb ./main
```

### 4. Run with Docker

```bash
# Build and run with MaxMind support
make docker
make docker-run

# Or manually
docker run -p 3001:3001 \
  -v /logs:/logs \
  -v $(PWD)/maxmind:/maxmind \
  -e USE_MAXMIND=true \
  -e MAXMIND_DB_PATH=/maxmind/GeoLite2-City.mmdb \
  traefik-log-dashboard-backend
```

## Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `USE_MAXMIND` | Enable MaxMind database | `false` | `true` |
| `MAXMIND_DB_PATH` | Path to MaxMind database file | `/maxmind/GeoLite2-City.mmdb` | `./maxmind/GeoLite2-City.mmdb` |
| `MAXMIND_FALLBACK_ONLINE` | Fallback to online APIs if MaxMind fails | `true` | `false` |

## Database Types

### GeoLite2-City
- **Size**: ~70MB
- **Data**: Country, region, city, coordinates, timezone
- **Accuracy**: City-level
- **Best for**: Detailed geolocation with city information

### GeoLite2-Country  
- **Size**: ~6MB
- **Data**: Country and coordinates only
- **Accuracy**: Country-level
- **Best for**: Basic geolocation, smaller memory footprint

## API Endpoints

### Get MaxMind Configuration
```http
GET /api/maxmind/config
```

Response:
```json
{
  "enabled": true,
  "databasePath": "/maxmind/GeoLite2-City.mmdb",
  "fallbackToOnline": true,
  "databaseLoaded": true,
  "databaseError": ""
}
```

### Reload MaxMind Database
```http
POST /api/maxmind/reload
```

Useful when you've updated the database file.

### Test MaxMind Database
```http
POST /api/maxmind/test
Content-Type: application/json

{
  "testIP": "8.8.8.8"
}
```

Response:
```json
{
  "success": true,
  "testIP": "8.8.8.8",
  "geoData": {
    "country": "United States",
    "city": "Mountain View",
    "countryCode": "US",
    "lat": 37.4223,
    "lon": -122.084,
    "source": "maxmind"
  }
}
```

## How It Works

### Lookup Priority
1. **Cache**: Check if IP is already cached
2. **MaxMind**: Query local MaxMind database (if enabled)
3. **Online APIs**: Fallback to online services (if fallback enabled)
4. **Cache failures**: Cache failed lookups to avoid repeated attempts

### Source Tracking
Each geolocation result includes a `source` field indicating where the data came from:
- `maxmind` - MaxMind database
- `online_primary` - Primary online API (ip-api.com)
- `online_fallback1` - Secondary online API (ipapi.co)
- `online_fallback2` - Tertiary online API (ipinfo.io)
- `cached` - Previously cached result
- `private` - Private IP address
- `failed` - All lookup methods failed

## Performance Comparison

| Method | Latency | Rate Limits | Privacy | Offline |
|--------|---------|-------------|---------|---------|
| MaxMind | <1ms | None | Full | Yes |
| Online APIs | 50-200ms | Yes (45/min) | Partial | No |

## Deployment Scenarios

### Production with MaxMind Only
```bash
# Disable fallback for maximum privacy
docker run -p 3001:3001 \
  -v /logs:/logs \
  -v /path/to/maxmind:/maxmind \
  -e USE_MAXMIND=true \
  -e MAXMIND_FALLBACK_ONLINE=false \
  traefik-log-dashboard-backend
```

### Hybrid Mode (Recommended)
```bash
# Use MaxMind with online fallback
docker run -p 3001:3001 \
  -v /logs:/logs \
  -v /path/to/maxmind:/maxmind \
  -e USE_MAXMIND=true \
  -e MAXMIND_FALLBACK_ONLINE=true \
  traefik-log-dashboard-backend
```

### Online Only (Original behavior)
```bash
# Disable MaxMind completely
docker run -p 3001:3001 \
  -v /logs:/logs \
  -e USE_MAXMIND=false \
  traefik-log-dashboard-backend
```

## Database Updates

MaxMind releases updated databases regularly. To update:

1. Download the latest database:
   ```bash
   make maxmind-download
   ```

2. Reload the database (without restarting the application):
   ```bash
   curl -X POST http://localhost:3001/api/maxmind/reload
   ```

## Troubleshooting

### Database Not Loading
- Check file path: `ls -la /path/to/maxmind/GeoLite2-City.mmdb`
- Check permissions: Database file must be readable by the application
- Check logs for specific error messages

### Poor Geolocation Accuracy
- Ensure you're using the City database for detailed location data
- Update to the latest database version
- Some IP ranges may have limited location data

### Memory Usage
- GeoLite2-City: ~100MB RAM usage
- GeoLite2-Country: ~20MB RAM usage
- Consider using Country database for memory-constrained environments

### Testing MaxMind Database
```bash
# Test the database locally
make maxmind-test

# Or manually
curl -X POST http://localhost:3001/api/maxmind/test \
  -H "Content-Type: application/json" \
  -d '{"testIP": "8.8.8.8"}'
```

## License and Terms

- **GeoLite2 Database**: Free with attribution required
- **Commercial Use**: Consider MaxMind's paid GeoIP2 databases for commercial applications
- **Attribution**: Include MaxMind attribution in your application if required
- **Updates**: Free databases are updated weekly, paid databases more frequently

## Security Considerations

- Database files should be stored securely and backed up
- Consider encrypting database files at rest
- Regularly update databases for security patches
- Monitor access to the database files
- In high-security environments, disable online fallback

## Support

For MaxMind-specific issues:
- MaxMind Documentation: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
- MaxMind Support: https://support.maxmind.com/

For application-specific issues:
- Check application logs
- Use the test endpoint to verify configuration
- Check the configuration endpoint for database status


## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │
│  Frontend       │────▶│  Backend API    │
│  (React/Vite)   │ WS  │  (Node.js)      │
│                 │     │                 │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │  Traefik Logs   │
                        │  (JSON Format)  │
                        │                 │
                        └─────────────────┘
```

## API Endpoints

  - `GET /api/stats` - Get aggregated statistics
  - `GET /api/logs` - Get paginated logs with filters
  - `GET /api/services` - List all services
  - `GET /api/routers` - List all routers
  - `GET /api/geo-stats` - Geographic statistics
  - `POST /api/set-log-file` - Change log file location
  - `WebSocket /` - Real-time log streaming

## Development

### Local Development

1.  **Backend**:
    ```bash
    cd backend
    npm install
    npm run dev
    ```
2.  **Frontend**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

### Building from Source

```bash
# Build backend
cd backend
docker build -t traefik-dashboard-backend .

# Build frontend
cd frontend
docker build -t traefik-dashboard-frontend .
```

## Customization

### Adding Custom Metrics

1.  Edit `backend/src/logParser.js` to extract additional fields
2.  Update `frontend/src/components/StatsCards.tsx` to display new metrics

### Modifying UI Theme

Edit `frontend/src/index.css` to customize colors and styling.

## Performance Considerations

  - The backend keeps the last 10,000 logs in memory.
  - IP geolocation results are cached for 24 hours.
  - Stats are calculated incrementally for efficiency.
  - WebSocket connections automatically reconnect.

## Troubleshooting

### Dashboard shows "No logs found"

1.  Check Traefik log file path in `.env`.
2.  Ensure Traefik is outputting JSON format.
3.  Check container logs: `docker compose logs backend`.

### WebSocket connection fails

1.  Check if backend is running: `curl http://localhost:3001/health`.
2.  Ensure ports 3000 and 3001 are not in use.
3.  Check browser console for errors.

### Geolocation not working

  - The dashboard uses ip-api.com (free tier: 45 requests/minute).
  - Private IPs show as "Private Network".
  - Rate limits may apply for high-traffic sites.

## Development

### Local Development

1. **Backend**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Building from Source

```bash
# Build backend
cd backend
docker build -t traefik-dashboard-backend .

# Build frontend
cd frontend
docker build -t traefik-dashboard-frontend .
```

## Customization

### Adding Custom Metrics

1. Edit `backend/src/logParser.js` to extract additional fields
2. Update `frontend/src/components/StatsCards.tsx` to display new metrics

### Modifying UI Theme

Edit `frontend/src/index.css` to customize colors and styling.

## Performance Considerations

- The backend keeps the last 10,000 logs in memory
- IP geolocation results are cached for 24 hours
- Stats are calculated incrementally for efficiency
- WebSocket connections automatically reconnect

## Dev SetUp

### Step 1: Create all directories

```bash
mkdir -p traefik-log-dashboard/{backend/src,frontend/src/{components/ui,hooks,lib},monitoring,scripts,.github/workflows}
cd traefik-log-dashboard
```

### Step 2: Copy all files

Copy each file from the artifacts to its corresponding location in the directory structure.

### Step 3: Configure environment

```bash
cp .env.example .env
# Edit .env and set TRAEFIK_LOG_PATH to your log location
```

### Step 4: Build and run

```bash
# Using Make
make build
make up

# Or using Docker Compose directly
docker compose build
docker compose up -d
```

## Configuration Options

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `TRAEFIK_LOG_PATH` | Path to Traefik logs | `/logs` | `/var/log/traefik/access.log` |
| `PORT` | Backend API port | `3001` | `3001` |
| `FRONTEND_PORT` | Frontend port | `3000` | `8080` |
| `NODE_ENV` | Environment | `production` | `development` |

### Traefik Log Format

The dashboard expects Traefik logs in JSON format. Configure Traefik:

```yaml
# traefik.yml
accessLog:
  filePath: "/path/to/access.log"
  format: json
```

## Features Overview

### Real-time Monitoring
- Live log streaming via WebSocket
- Auto-reconnect on connection loss
- Updates every 5 seconds

### Analytics
- Total requests & requests/second
- Average response time
- Status code distribution
- Error rates (4xx, 5xx)
- Service & router statistics
- Geographic distribution

### Log Analysis
- Searchable log table
- Filter by service, status, router
- IP geolocation with country/city
- Response time color coding
- Request method badges

## Docker Deployment Options

### Basic Deployment
```bash
docker compose up -d
```

### Development Mode
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Production Mode
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### With Monitoring
```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

## Testing

### Generate Sample Logs
```bash
# Generate 1000 sample logs
node scripts/generate-sample-logs.js logs/traefik.log 1000

# Generate continuous logs
node scripts/generate-sample-logs.js logs/traefik.log 0 --continuous
```

### Health Checks
```bash
# Check backend health
curl http://localhost:3001/health

# Check frontend
curl http://localhost:3000
```

## Troubleshooting

### Dashboard shows "No logs found"

1. Check log file path:
   ```bash
   docker compose exec backend ls -la /logs
   ```

2. Verify log format is JSON:
   ```bash
   docker compose exec backend head -n 1 /logs/traefik.log
   ```

3. Check backend logs:
   ```bash
   docker compose logs backend
   ```

### WebSocket disconnects frequently

1. Check nginx configuration in frontend container
2. Ensure firewall allows WebSocket connections
3. Check for proxy/load balancer WebSocket support

### High memory usage

1. Reduce `maxLogs` in `backend/src/logParser.js`
2. Add memory limits in `docker-compose.prod.yml`
3. Enable log rotation in Traefik

## Production Deployment

### With SSL/TLS

1. Use Traefik as reverse proxy:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.dashboard.rule=Host(`dashboard.example.com`)"
  - "traefik.http.routers.dashboard.tls=true"
  - "traefik.http.routers.dashboard.tls.certresolver=letsencrypt"
```

2. Or use nginx with Let's Encrypt:
```bash
# Install certbot and obtain certificate
certbot certonly --webroot -w /var/www/html -d dashboard.example.com
```

### Authentication

Add basic auth with Traefik:
```yaml
labels:
  - "traefik.http.routers.dashboard.middlewares=auth"
  - "traefik.http.middlewares.auth.basicauth.users=admin:$$2y$$10$$..."
```

### Monitoring

Access monitoring tools:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

## API Reference

### REST Endpoints

```bash
# Get statistics
curl http://localhost:3001/api/stats

# Get logs with pagination
curl http://localhost:3001/api/logs?page=1&limit=50

# Filter logs
curl http://localhost:3001/api/logs?service=api-gateway&status=200

# Get services list
curl http://localhost:3001/api/services

# Get geographic stats
curl http://localhost:3001/api/geo-stats
```

### WebSocket Events

Connect to `ws://localhost:3001` and receive:
- `newLog` - Individual log entries
- `stats` - Updated statistics
- `logs` - Batch of logs


For more help, create an issue on GitHub or check the logs:
```bash
docker compose logs -f --tail=100
```
# Traefik Log Dashboard - Quick Reference

## Quick Commands

```bash
# Start
./setup.sh                    # First time setup
docker compose up -d          # Start services
make up                       # Alternative: using Makefile

# Stop
docker compose down           # Stop services
make down                     # Alternative: using Makefile

# Logs
docker compose logs -f        # View all logs
docker compose logs backend   # Backend logs only
docker compose logs frontend  # Frontend logs only

# Restart
docker compose restart        # Restart all services
make restart                  # Alternative: using Makefile

# Update
git pull                      # Get latest code
docker compose build --no-cache  # Rebuild images
docker compose up -d          # Restart with new images
```

## 🔍 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| No logs showing | Check `TRAEFIK_LOG_PATH` in `.env` |
| Can't connect | Ensure ports 3000 & 3001 are free |
| High memory | Reduce log retention in `logParser.js` |
| WebSocket fails | Check firewall/proxy settings |

## 📊 API Quick Test

```bash
# Test backend health
curl http://localhost:3001/health

# Get current stats
curl http://localhost:3001/api/stats | jq .

# Get recent logs
curl http://localhost:3001/api/logs?limit=10 | jq .
```

## Docker Commands

```bash
# View running containers
docker compose ps

# Enter backend container
docker compose exec backend sh

# Enter frontend container
docker compose exec frontend sh

# View resource usage
docker stats

# Clean up everything
docker compose down -v --rmi all
```

## Important Files

- `.env` - Configuration
- `docker-compose.yml` - Service definitions
- `backend/src/logParser.js` - Log parsing logic
- `frontend/src/components/Dashboard.tsx` - Main UI

## URLs

- Dashboard: http://localhost:3000
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

## Development

```bash
# Start dev mode with hot reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Generate test logs
node scripts/generate-sample-logs.js logs/traefik.log 100

# Continuous test logs
node scripts/generate-sample-logs.js logs/traefik.log 0 --continuous
```

## Monitoring (Optional)

```bash
# Start with monitoring
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Access
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3001 (admin/admin)
```

---
Need help? Check logs first: `docker compose logs -f`

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## License

MIT License - feel free to use in personal and commercial projects.

## Credits

- Built with React + TypeScript
- UI components from Shadcn UI
- Charts by Recharts
- IP geolocation by ip-api.com
- Icons by Lucide

---
