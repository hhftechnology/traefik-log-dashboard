#!/bin/bash

# Traefik Log Dashboard Setup Script
set -e

echo "================================================"
echo "  Traefik Log Dashboard - Setup Script"
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker found${NC}"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose found${NC}"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "\n${YELLOW}Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    
    # Ask for Traefik log path
    echo -e "\n${YELLOW}Please enter the path to your Traefik log file or directory:${NC}"
    read -p "Path (default: ./logs): " LOG_PATH
    LOG_PATH=${LOG_PATH:-./logs}
    
    # Update .env file
    sed -i.bak "s|TRAEFIK_LOG_PATH=.*|TRAEFIK_LOG_PATH=${LOG_PATH}|" .env
    rm -f .env.bak
    echo -e "${GREEN}✓ Log path configured: ${LOG_PATH}${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Ask for deployment mode
echo -e "\n${YELLOW}Select deployment mode:${NC}"
echo "1) Production (recommended)"
echo "2) Development"
read -p "Enter choice [1-2]: " DEPLOY_MODE

# Create sample log directory if it doesn't exist
if [ ! -d "logs" ]; then
    mkdir -p logs
    echo -e "${GREEN}✓ Created logs directory${NC}"
fi

# Build and deploy
echo -e "\n${YELLOW}Building Docker images...${NC}"
docker-compose build

if [ "$DEPLOY_MODE" = "2" ]; then
    echo -e "\n${YELLOW}Starting services in development mode...${NC}"
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
else
    echo -e "\n${YELLOW}Starting services in production mode...${NC}"
    docker-compose up -d
fi

# Wait for services to start
echo -e "\n${YELLOW}Waiting for services to start...${NC}"
sleep 5

# Check service health
echo -e "\n${YELLOW}Checking service health...${NC}"

# Check backend
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not responding${NC}"
fi

# Check frontend
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is running${NC}"
else
    echo -e "${RED}✗ Frontend is not responding${NC}"
fi

echo -e "\n================================================"
echo -e "${GREEN}Setup complete!${NC}"
echo -e "\nDashboard URL: ${GREEN}http://localhost:3000${NC}"
echo -e "\nUseful commands:"
echo -e "  ${YELLOW}docker-compose logs -f${NC}     - View logs"
echo -e "  ${YELLOW}docker-compose down${NC}        - Stop services"
echo -e "  ${YELLOW}docker-compose restart${NC}     - Restart services"
echo -e "  ${YELLOW}make help${NC}                  - Show all available commands"
echo -e "\n================================================"