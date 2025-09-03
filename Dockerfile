# Dockerfile for Autonomous Web Framework
# Multi-stage build for production deployment

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Generate templates
RUN npm run build:templates

# Production stage
FROM node:18-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S framework && \
    adduser -S framework -u 1001 -G framework

# Install system dependencies
RUN apk add --no-cache \
    tini \
    dumb-init \
    curl \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=framework:framework /app/dist ./dist
COPY --from=builder --chown=framework:framework /app/src/templates ./src/templates

# Create necessary directories
RUN mkdir -p workspace logs && \
    chown -R framework:framework workspace logs

# Copy configuration files
COPY --chown=framework:framework .env.example ./.env.example

# Switch to non-root user
USER framework

# Expose framework dashboard port
EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3100/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV FRAMEWORK_WORKSPACE_DIR=/app/workspace
ENV FRAMEWORK_LOG_LEVEL=info

# Use tini as init process for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the framework
CMD ["node", "dist/index.js"]

# Labels for metadata
LABEL org.opencontainers.image.title="Autonomous Web Framework"
LABEL org.opencontainers.image.description="AI-powered autonomous web application development framework"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.authors="Autonomous Web Framework Team"
LABEL org.opencontainers.image.url="https://github.com/autonomous-web-framework/autonomous-web-framework"
LABEL org.opencontainers.image.documentation="https://docs.autonomous-web-framework.com"
LABEL org.opencontainers.image.source="https://github.com/autonomous-web-framework/autonomous-web-framework"
LABEL org.opencontainers.image.licenses="MIT"