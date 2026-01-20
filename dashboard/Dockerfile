# ==============================================================================
# Stage 1: Dependencies
# ==============================================================================
FROM node:22-alpine AS deps

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# ==============================================================================
# Stage 2: Builder
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ==============================================================================
# Stage 3: Runner (Production)
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install only runtime dependencies
RUN apk add --no-cache ca-certificates

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy ONLY the standalone build (includes all dependencies)
COPY --from=builder --chown=nodejs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nodejs:nodejs /app/public ./public

# GeoIP: geolite2-redist downloads databases on first use (lazy loading)
# Create geoip directory for runtime database storage
RUN mkdir -p /app/geoip && chown nodejs:nodejs /app/geoip

# CRITICAL: Copy geolite2-redist package from builder since standalone doesn't include it fully
# This package needs its full structure to download GeoLite2 databases at runtime
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/geolite2-redist ./node_modules/geolite2-redist

# Create the directories geolite2-redist needs for database downloads
RUN mkdir -p /app/node_modules/geolite2-redist/dbs-tmp && \
    mkdir -p /app/node_modules/geolite2-redist/dbs && \
    chown -R nodejs:nodejs /app/node_modules/geolite2-redist

# Copy entrypoint script
COPY --chown=nodejs:nodejs docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

USER nodejs

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
