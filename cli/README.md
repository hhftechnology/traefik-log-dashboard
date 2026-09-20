# Traefik Log Dashboard CLI (Experimental)

A beautiful terminal-based dashboard for analyzing Traefik access logs in real-time. Built with [Bubble Tea](https://github.com/charmbracelet/bubbletea) for an interactive TUI experience.

![Traefik Log CLI Dashboard](https://placeholder.photo/800x400/1a1b26/a9b1d6?text=Traefik+Log+Dashboard+CLI)

## Features

-  **Real-time Dashboard** - Interactive terminal UI with multiple visualization cards
-  **Multiple Data Sources** - Read from log files, connect to Traefik Analytics Agent, or use demo data
-  **Rich Metrics** - Request rates, response times, status codes, error rates, and more
-  **Beautiful UI** - Clean, modern interface with color-coded indicators and progress bars
-  **Fast & Efficient** - Optimized log parsing with incremental reading and gzip support
-  **GeoIP Support** - Geographic distribution of requests (when GeoIP database available)
-  **System Monitoring** - CPU, memory, and disk usage statistics
-  **Responsive Layout** - Adapts to terminal size with intelligent card arrangement

## Installation

### Using Go

```bash
go install github.com/hhftechnology/traefik-log-dashboard/cmd/traefik-log-dashboard@latest
```

### From Source

```bash
git clone https://github.com/hhftechnology/traefik-log-dashboard.git
cd traefik-log-dashboard/cli
make install
```

### Binary Releases

Download pre-built binaries for your platform from the [releases page](https://github.com/hhftechnology/traefik-log-dashboard/releases).

## Usage

### Quick Start with Demo Data

```bash
traefik-log-dashboard --demo
```

### Read from Log File

```bash
traefik-log-dashboard --file /var/log/traefik/access.log
```

### Connect to Traefik Analytics Agent

```bash
traefik-log-dashboard --url http://localhost:8080
```

### All Options

```bash
traefik-log-dashboard [OPTIONS]

Options:
  --file PATH         Path to Traefik access log file
  --url URL           URL of Traefik Log Dashboard Agent (default: http://localhost:8080)
  --demo              Run with demo data
  --period DURATION   Time period to analyze (default: 1h)
                      Examples: 5m, 1h, 24h, 7d
  --refresh DURATION  Dashboard refresh interval (default: 5s)
  --help              Show help message
  --version           Show version information
```

## Dashboard Cards

The CLI dashboard includes the following cards:

### Request Metrics

- Total requests in the selected period
- Requests per second
- Trends and sparklines

###  Response Time

- Average response time
- P95 and P99 percentiles
- Response time distribution

### Status Codes

- 2xx, 3xx, 4xx, 5xx breakdown
- Visual pie chart representation
- Percentage distribution

### Top Routes

- Most requested routes
- Request counts and percentages
- Average response times

### Backends/Services

- Service performance metrics
- Request counts and error rates
- Average response times

### Routers

- Router performance metrics
- Traffic distribution
- Error rates

### Recent Errors

- Latest error entries (4xx, 5xx)
- Timestamp, status code, and request details
- Router and service information

### Request Timeline

- Visual sparkline of request activity
- Time-based request distribution
- Peak and average rates

### System Resources

- CPU usage
- Memory usage
- Disk usage
- Health recommendations

### Geographic Distribution

- Request origins by country (requires GeoIP database)
- Top countries by request count

## Keyboard Controls

- `q` or `Ctrl+C` - Quit the application
- `r` - Refresh data
- `↑`/`↓` or `j`/`k` - Scroll through logs (when in detail view)
- `h` - Show help
- `1-9` - Switch between different time periods

## Configuration

### Environment Variables

```bash
# Agent URL
export TRAEFIK_AGENT_URL=http://localhost:8080

# Log file path
export TRAEFIK_LOG_FILE=/var/log/traefik/access.log

# GeoIP database path
export GEOIP_DB=/usr/share/GeoIP/GeoLite2-City.mmdb

# Refresh interval
export REFRESH_INTERVAL=5s
```

### Log Format Support

The CLI supports both JSON and Common Log Format (CLF) Traefik logs:

**JSON Format** (recommended):

```json
{
  "ClientAddr": "192.168.1.100:54321",
  "RequestMethod": "GET",
  "RequestPath": "/api/users",
  "DownstreamStatus": 200,
  "Duration": 1234567,
  "RouterName": "api-router",
  "ServiceName": "api-service"
}
```

**Common Log Format**:

```
192.168.1.100 - - [10/Oct/2025:13:55:36 +0000] "GET /api/users HTTP/1.1" 200 1234
```

## Integration with Traefik Log Dashboard Agent

For the best experience, connect the CLI to the Traefik Log Dashboard Agent:

1. Start the agent:

```bash
cd agent
make run
```

2. Connect the CLI:

```bash
traefik-log-dashboard --url http://localhost:8080
```

The agent provides additional features:

- System resource monitoring
- Real-time log streaming
- GeoIP lookups
- Compressed log support

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/hhftechnology/traefik-log-dashboard.git
cd traefik-log-dashboard/cli

# Install dependencies
make deps

# Build
make build

# Run tests
make test

# Run with demo data
make run
```

### Project Structure

```
cli/
├── cmd/
│   └── traefik-log-dashboard/
│       └── main.go              # Entry point
├── internal/
│   ├── config/                  # Configuration
│   ├── env/                     # Environment variables
│   ├── logs/                    # Log parsing and metrics
│   │   ├── logs.go
│   │   ├── metrics.go
│   │   ├── demo.go
│   │   ├── traefik/            # Traefik-specific parsers
│   │   └── period/             # Time period handling
│   ├── model/                   # Bubble Tea model
│   │   ├── model.go
│   │   ├── service.go
│   │   ├── update.go
│   │   └── view.go
│   └── ui/                      # UI components
│       ├── styles/              # Lipgloss styles
│       └── dashboard/           # Dashboard components
│           ├── dashboard.go
│           ├── grid.go
│           └── cards/           # Individual cards
│               ├── requests.go
│               ├── response_time.go
│               ├── status_codes.go
│               ├── top_routes.go
│               ├── backends.go
│               ├── routers.go
│               ├── errors.go
│               ├── timeline.go
│               └── system.go
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

## Requirements

- Go 1.22 or later
- Terminal with 256 color support
- Minimum terminal size: 80x24

## Performance

The CLI is optimized for performance:

- **Log Parsing**: ~100,000 lines/second
- **Memory Usage**: ~50MB for 1M log entries
- **Update Latency**: <10ms UI refresh
- **CPU Usage**: <5% during normal operation

## Troubleshooting

### Dashboard not updating

- Check that the log file path is correct
- Ensure the agent is running (if using agent mode)
- Verify log file permissions
- Check that logs are being written to the file

### Colors not displaying

- Ensure your terminal supports 256 colors
- Set `TERM=xterm-256color` if needed
- Try a different terminal emulator

### High CPU usage

- Increase the refresh interval: `--refresh 10s`
- Reduce the time period: `--period 15m`
- Check for very large log files (>1GB)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](../LICENSE) for details

## Credits

Built with:

- [Bubble Tea](https://github.com/charmbracelet/bubbletea) - TUI framework
- [Bubbles](https://github.com/charmbracelet/bubbles) - TUI components
- [Lipgloss](https://github.com/charmbracelet/lipgloss) - Style definitions
- [gopsutil](https://github.com/shirou/gopsutil) - System monitoring

## Related Projects

- [Traefik Log Dashboard Agent](../agent) - Backend API service
- [Traefik Log Dashboard](../dashboard) - Web-based dashboard
- [Traefik](https://traefik.io/) - Cloud Native Application Proxy

---

Made with ❤️ for the Traefik community
