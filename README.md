# Traefik Log Dashboard

A real-time dashboard for analyzing Traefik logs with IP geolocation, status code analysis, and service metrics. Built with React (Shadcn UI) and Node.js.

![Dashboard Preview](https://raw.githubusercontent.com/hhftechnology/traefik-log-dashboard/main/scripts/dashboard.png)

## 🚀 New Features in v2

### 1. Filter Unknown Service/Router Names
When using Traefik with strict SNI, bot traffic accessing services by IP address results in entries with "unknown" service/router names. You can now filter these out:
- A checkbox in the log table allows hiding entries with unknown service/router names.
- The filter persists across page changes and is applied server-side for better performance.

### 2. Paginated Log Table
Replaced infinite scroll with traditional pagination for significantly better performance with large log files:
- Select between 50, 100, or 150 entries per page.
- Navigate with page numbers and previous/next buttons.
- Shows total entries and the current viewing range.

### 3. IPv6 Support
Fixed an issue where IPv6 addresses were truncated:
- Properly handles IPv6 addresses with brackets (e.g., `[2001:db8::1]:80`).
- Correctly extracts IPv6 addresses without truncating at colons.

### 4. Configurable Backend Service Name
The Nginx configuration is no longer hardcoded, allowing for more flexible setups:
- Set a custom backend service name via the `BACKEND_SERVICE_NAME` environment variable.
- Useful when running multiple instances or using custom Docker network configurations.

### 5. Multiple Log Files Support
Monitor logs from multiple Traefik instances or log files simultaneously:
- Provide a comma-separated list of paths in the `TRAEFIK_LOG_PATH` environment variable.
- Supports mixing file and directory paths.
- Automatically discovers `.log` files in specified directories.
- Aggregates logs from all sources in real-time.

---

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

---

## migrating to v2

If you are upgrading from a previous version, please follow these steps.

### 1. Update Environment Variables

Update your `.env` file with the new and updated options. You can copy from `.env.example` or modify your existing file:

Path to your Traefik log file(s) or directory(s)Now supports a comma-separated listTRAEFIK_LOG_PATH=/path/to/your/logs/,/path/to/another/access.logNew: Backend service name for Docker networking (must match docker-compose service name)BACKEND_SERVICE_NAME=backendOptional: Customize container namesBACKEND_CONTAINER_NAME=traefik-dashboard-backendFRONTEND_CONTAINER_NAME=traefik-dashboard-frontend
### 2. Rebuild Docker Containers

The frontend Dockerfile has changed to support the dynamic Nginx configuration. You must rebuild your containers:

docker-compose downdocker-compose build --no-cachedocker-compose up -d
### 3. Update Frontend Dependencies (if running locally)

If you are running the frontend outside of Docker for development, you'll need to install the new dependencies:

cd frontendnpm install
### 4. Clear Browser Cache

The LogTable component has been completely rewritten. It's highly recommended to clear your browser cache to ensure you get the latest version of the UI.

---

## 🏁 Quick Start

1. **Clone the repository:**

git clone https://github.com/hhftechnology/traefik-log-dashboard.gitcd traefik-log-dashboard
2. **Configure your environment:**
Create a `.env` file by copying the example:

cp .env.example .env
Now, edit the `.env` file and set `TRAEFIK_LOG_PATH` to the location of your Traefik logs.

3. **Create** a **`docker-compose.yml` file:**

version: '3.8'services:backend:image: ghcr.io/hhftechnology/traefik-log-dashboard-backend:latestcontainer_name: BACKEND_CONTAINER_NAME:−traefik−dashboard−backendrestart:unless−stoppedvolumes:#MountyourTraefiklogfile(s)ordirectory(s)here#Thismustmatchthepath(s)yousetinthe.envfile\-/path/to/your/logs:/logs:ro\-/path/to/another/access.log:/another/access.log:roenvironment:\-NODE_ENV=production\-TRAEFIK_LOG_PATH={TRAEFIK_LOG_PATH}networks:- traefik-dashboard-net frontend:
   image: ghcr.io/hhftechnology/traefik-log-dashboard-frontend:latest
   container_name: ${FRONTEND_CONTAINER_NAME:-traefik-dashboard-frontend}
   restart: unless-stopped
   ports:
     - "3000:80"
   environment:
     # This must match the service name of the backend container
     - BACKEND_SERVICE_NAME=${BACKEND_SERVICE_NAME:-backend}
   depends_on:
     - backend
   networks:
     - traefik-dashboard-net
networks:traefik-dashboard-net:driver: bridge
4. **Build and run:**

docker-compose up -d
5. **Access the dashboard:**
Open `http://localhost:3000` in your browser.

---

## ⚙️ Configuration

### Traefik JSON Logging

Ensure your Traefik instance is configured to output access logs in JSON format. Add this to your static configuration (`traefik.yml`):

accessLog:filePath: "/logs/traefik.log"format: json
### Environment Variables

| Variable | Description | Default | Example | 
 | ----- | ----- | ----- | ----- | 
| `TRAEFIK_LOG_PATH` | **Required.** Comma-separated path(s) to Traefik logs inside the container. | `/logs` | `/logs/main/,/logs/staging/access.log` | 
| `BACKEND_SERVICE_NAME` | The service name of the backend container for Nginx proxying. | `backend` | `traefik_dashboard_backend` | 
| `BACKEND_CONTAINER_NAME` | The name for the backend Docker container. | `traefik-dashboard-backend` | `tdb_backend` | 
| `FRONTEND_CONTAINER_NAME` | The name for the frontend Docker container. | `traefik-dashboard-frontend` | `tdb_frontend` | 
| `PORT` | Backend API port. | `3001` | `3001` | 

### Docker Compose Examples

#### Single Log Directory

Mount the entire directory where Traefik stores its logs. The dashboard will automatically find any `.log` files.

**.env**

TRAEFIK_LOG_PATH=/logs/
**docker-compose.yml `volumes` section for backend:**

volumes:/var/log/traefik:/logs:ro
#### Multiple Log Paths

Monitor multiple directories and specific files from different Traefik instances.

**.env**

TRAEFIK_LOG_PATH=/traefik1_logs/,/traefik2_logs/access.log
**docker-compose.yml** `volumes` section **for backend:**

volumes:/path/to/traefik1/logs:/traefik1_logs:ro/path/to/traefik2/access.log:/traefik2_logs/access.log:ro
---

## 🏗️ Architecture

┌─────────────────┐     ┌─────────────────┐│                 │     │                 ││  Frontend       │────▶│  Backend API    ││  (React/Vite)   │ WS  │  (Node.js)      ││                 │     │                 │└─────────────────┘     └────────┬────────┘│▼┌─────────────────┐│                 ││  Traefik Logs   ││  (JSON Format)  ││                 │└─────────────────┘
---

## 💡 Troubleshooting

### "Backend not found" error

If you get Nginx errors after changing `BACKEND_SERVICE_NAME`:

1. Ensure the service name in `docker-compose.yml` (e.g., `services: backend:`) matches the value in your `.env` file.

2. Rebuild the frontend container: `docker-compose build frontend`.

3. Check that both containers are on the same Docker network.

### IPv6 addresses still truncated

1. Check backend logs (`docker-compose logs backend`) to verify the new `extractIP` function is being used.

2. Ensure you've rebuilt the backend container after pulling the latest image or code.

3. Look for entries like `[::1]:80` being properly parsed to `::1`.

### Multiple log files not working

1. Verify paths in `TRAEFIK_LOG_PATH` are comma-separated with **no spaces**.

2. Check backend logs for a "Monitoring log paths:" message on startup.

3. Ensure all paths are correctly mounted as volumes and are accessible from within the container.

4. For clarity, directory paths should end with a `/`.

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
