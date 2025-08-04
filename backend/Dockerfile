# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY *.go ./

# Build the application with optimizations for target architecture
# Use TARGETARCH and TARGETOS from buildx automatically
ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build \
    -ldflags="-w -s" \
    -a -installsuffix cgo \
    -o main .

# Production stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from builder
COPY --from=builder /app/main .

# Create necessary directories
RUN mkdir -p /logs /maxmind

# Expose port
EXPOSE 3001

# Set default environment variables
ENV PORT=3001
ENV TRAEFIK_LOG_FILE=/logs/traefik.log
ENV USE_MAXMIND=false
ENV MAXMIND_DB_PATH=/maxmind/GeoLite2-City.mmdb
ENV MAXMIND_FALLBACK_ONLINE=true

# Set Go runtime environment variables for better memory management
ENV GOGC=50
ENV GOMEMLIMIT=500MiB

# Add MaxMind database volume
VOLUME ["/maxmind"]

# Run the application
CMD ["./main"]