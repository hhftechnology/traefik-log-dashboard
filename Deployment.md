# Deployment Guide

## Quick Deployment Steps

### 1. Create Project Directory

```bash
mkdir traefik-log-dashboard
cd traefik-log-dashboard
```

### 2. Create Directory Structure

```bash
mkdir -p backend/src frontend/src/{components/ui,hooks,lib}
```

### 3. Copy All Files

Copy all the provided files to their respective directories as shown in the project structure.

### 4. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your Traefik log path
nano .env
```

Set `TRAEFIK_LOG_PATH` to your actual Traefik log location:
- Single file: `/var/log/traefik/access.log`
- Directory: `/var/log/traefik/`
- Docker volume: Use volume name

### 5. Build and Run

```bash
# Build and start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Verify services are running
docker-compose ps
```

### 6. Access Dashboard

Open http://localhost:3000 in your browser.

## Production Deployment

### Using Traefik as Reverse Proxy

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    build: ./backend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard-api.rule=Host(`dashboard.example.com`) && PathPrefix(`/api`)"
      - "traefik.http.services.dashboard-api.loadbalancer.server.port=3001"
    volumes:
      - ${TRAEFIK_LOG_PATH}:/logs:ro
    networks:
      - traefik-network

  frontend:
    build: ./frontend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`dashboard.example.com`)"
      - "traefik.http.services.dashboard.loadbalancer.server.port=80"
      - "traefik.http.routers.dashboard.tls=true"
      - "traefik.http.routers.dashboard.tls.certresolver=letsencrypt"
    networks:
      - traefik-network

networks:
  traefik-network:
    external: true
```

### Adding Authentication

Use Traefik's BasicAuth middleware:

```yaml
labels:
  - "traefik.http.routers.dashboard.middlewares=auth"
  - "traefik.http.middlewares.auth.basicauth.users=admin:$$2y$$10$$..."
```

Generate password hash:
```bash
echo $(htpasswd -nb admin your-password) | sed -e s/\\$/\\$\\$/g
```

### SSL/TLS Configuration

For production, always use HTTPS:

```yaml
labels:
  - "traefik.http.routers.dashboard.tls=true"
  - "traefik.http.routers.dashboard.tls.certresolver=letsencrypt"
  - "traefik.http.routers.dashboard.entrypoints=websecure"
```

## Kubernetes Deployment

### ConfigMap for Frontend

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
data:
  default.conf: |
    server {
      listen 80;
      # ... nginx configuration from nginx.conf
    }
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: traefik-dashboard
spec:
  replicas: 1
  selector:
    matchLabels:
      app: traefik-dashboard
  template:
    metadata:
      labels:
        app: traefik-dashboard
    spec:
      containers:
      - name: backend
        image: your-registry/traefik-dashboard-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: TRAEFIK_LOG_FILE
          value: "/logs/traefik.log"
        volumeMounts:
        - name: logs
          mountPath: /logs
          readOnly: true
      
      - name: frontend
        image: your-registry/traefik-dashboard-frontend:latest
        ports:
        - containerPort: 80
        volumeMounts:
        - name: nginx-config
          mountPath: /etc/nginx/conf.d/
      
      volumes:
      - name: logs
        hostPath:
          path: /var/log/traefik
      - name: nginx-config
        configMap:
          name: nginx-config
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: traefik-dashboard
spec:
  selector:
    app: traefik-dashboard
  ports:
  - name: frontend
    port: 80
    targetPort: 80
  - name: backend
    port: 3001
    targetPort: 3001
```

## Performance Tuning

### For High Traffic Sites

1. **Increase memory limits** in docker-compose.yml:
   ```yaml
   deploy:
     resources:
       limits:
         memory: 512M
   ```

2. **Adjust log retention** in backend/src/logParser.js:
   ```javascript
   this.maxLogs = 50000; // Increase from 10000
   ```

3. **Use external geolocation service** with higher rate limits

### Database Storage (Optional)

For long-term storage, modify the backend to use a database:

1. Add PostgreSQL/MongoDB to docker-compose.yml
2. Modify logParser.js to store logs in database
3. Add data retention policies

## Monitoring

### Health Checks

Both services expose health endpoints:
- Backend: http://localhost:3001/health
- Frontend: http://localhost:3000/

### Prometheus Metrics (Optional)

Add Prometheus metrics endpoint to backend:

```javascript
// backend/src/metrics.js
import promClient from 'prom-client';

const register = new promClient.Registry();
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code']
});

register.registerMetric(httpRequestDuration);
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Verify file permissions
ls -la /path/to/traefik/logs
```

### High memory usage

```bash
# Check resource usage
docker stats

# Limit memory in docker-compose.yml
```

### WebSocket issues behind proxy

Ensure proxy passes WebSocket headers:
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```