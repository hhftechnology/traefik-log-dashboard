# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install build dependencies with retry for unstable networks
RUN apk add --no-cache git || (sleep 5 && apk add --no-cache git)

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Tidy modules to resolve internal paths
RUN go mod tidy

# Build the application with optimizations for target architecture
ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build \
    -ldflags="-w -s" \
    -a -installsuffix cgo \
    -o main ./cmd/agent

# Production stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /app/

# Copy the binary from builder
COPY --from=builder /app/main .


# Expose port
EXPOSE 5000

# Set default environment variables
ENV PORT=5000
ENV TRAEFIK_LOG_FILE=

# Set Go runtime environment variables for better memory management
ENV GOGC=50
ENV GOMEMLIMIT=500MiB


# Run the application
CMD ["./main"]