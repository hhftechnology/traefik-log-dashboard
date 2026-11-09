# Traefik Log Dashboard Agent

A lightweight Go service for parsing and streaming Traefik logs in real-time.

## Deployment Guide

```bash
git clone https://github.com/hhftechnology/traefik-log-dashboard.git
cd traefik-log-dashboard/agent

make
# or...
go build -o bin/agent ./cmd/agent

scp bin/agent user@yourserver:/usr/local/bin/
ssh user@yourserver
chmod +x /usr/local/bin/agent
```

> If your Traefik log path is different from the default `/var/log/traefik`, set the correct path as an environment variable within a `.env` file.
>
> ```env
> TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/path/to/access/logs
> TRAEFIK_LOG_DASHBOARD_ERROR_PATH=/path/to/error/logs
> ```

### Access Logs

By default, when `TRAEFIK_LOG_DASHBOARD_ACCESS_PATH` is set to a directory, all compressed (.gz) and uncompressed (.log) log files within the directory will be served. To target a single `access.log` file, use a full filepath instead.

```env
TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/path/to/traefik/access/logs
# or...
TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/path/to/traefik/access.log
```

### Error Logs

By default, any access log path provided will be checked for error logs if it is pointing to a directory. If your error logs are stored in a different path, or targeting a single log file instead, you can specify the location separately using `TRAEFIK_LOG_DASHBOARD_ERROR_PATH`.

```env
TRAEFIK_LOG_DASHBOARD_ERROR_PATH=/path/to/traefik/error/logs
# or...
TRAEFIK_LOG_DASHBOARD_ERROR_PATH=/path/to/traefik/traefik.log
```

### Port

The default port is 5000. If this is already in use, specify an alternative with the `PORT` environment variable, or with the `--port` command line argument.

### Locations

IP-location inference can be set up quickly, utilising <a href="https://www.maxmind.com/en/home">MaxMind's free GeoLite2 database</a>. Simply drop the `GeoLite2-Country.mmdb` or `GeoLite2-City.mmdb` file in the root folder of the agent deployment.

### System Monitoring

By default, system monitoring is disabled. To enable it, set the `TRAEFIK_LOG_DASHBOARD_SYSTEM_MONITORING` environment variable to `true`, or with the `--system-monitoring` command line argument.

### Authentication

Set the private environment variable `TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN` to the same value for both the agent (server) and the dashboard (client) deployment. The agent rejects protected requests when the token is empty.

The agent will verify that the auth token sent by the client matches the locally stored value before allowing access to the logs.

### Docker

```bash
docker build -t traefik-log-dashboard-agent .
docker run -d \
  -p 5000:5000 \
  -v /var/log/traefik:/var/log/traefik:ro \
  -e TRAEFIK_LOG_DASHBOARD_ACCESS_PATH=/var/log/traefik \
  -e TRAEFIK_LOG_DASHBOARD_AUTH_TOKEN=your-secret-token \
  traefik-log-dashboard-agent
```

#### HTTPS

Deploying over a secure HTTPS connection is always recommended. Without this, you risk exposing any personal information within your log files such as IP addresses.
