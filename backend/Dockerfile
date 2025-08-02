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

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Production stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from builder
COPY --from=builder /app/main .

# Create logs directory
RUN mkdir -p /logs

# Expose port
EXPOSE 3001

# Set default environment variables
ENV PORT=3001
ENV TRAEFIK_LOG_FILE=/logs/traefik.log

# Run the application
CMD ["./main"]