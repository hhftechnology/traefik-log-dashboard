FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Create logs directory
RUN mkdir -p /logs

# Expose port
EXPOSE 3001

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV TRAEFIK_LOG_FILE=/logs/traefik.log

# Run the application
CMD ["node", "src/index.js"]