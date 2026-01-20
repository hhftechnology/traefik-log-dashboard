#!/bin/sh
set -e

# Create data directory if it doesn't exist
mkdir -p /app/data 2>/dev/null || true

# Verify geolite2-redist directories exist and are writable
# Note: Main permission fix happens in Dockerfile with chown
# This is a fallback check for runtime issues
if [ -d "/app/node_modules/geolite2-redist" ]; then
  # Create required directories if they don't exist
  mkdir -p /app/node_modules/geolite2-redist/dbs-tmp 2>/dev/null || true
  mkdir -p /app/node_modules/geolite2-redist/dbs 2>/dev/null || true

  # Test write permission
  if ! touch /app/node_modules/geolite2-redist/dbs-tmp/.write-test 2>/dev/null; then
    echo "WARNING: geolite2-redist/dbs-tmp is not writable. GeoIP lookups may fail."
    echo "This is usually a Docker permission issue. Rebuild the image to fix."
  else
    rm -f /app/node_modules/geolite2-redist/dbs-tmp/.write-test
  fi
fi

# Execute the command
exec "$@"
