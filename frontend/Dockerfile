# Build stage
FROM 11notes/node:22.14.0 AS builder

WORKDIR /app

# Copy package files and postcss config
COPY package*.json ./
COPY postcss.config.js ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM 11notes/nginx:1.28.0

# Install envsubst for template processing
RUN apk add --no-cache gettext

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx template configuration
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Set default environment variables
ENV BACKEND_SERVICE=backend
ENV BACKEND_PORT=3001

# Expose port
EXPOSE 80

# Start nginx with envsubst
CMD ["/bin/sh", "-c", "envsubst '$$BACKEND_SERVICE $$BACKEND_PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
