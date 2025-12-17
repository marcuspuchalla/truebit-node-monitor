#!/bin/sh
set -e

# Fix ownership of data directory for mounted volumes
# This runs as root before dropping privileges
if [ -d "/app/data" ]; then
    chown -R nodejs:nodejs /app/data
fi

# Fix Docker socket permissions for nodejs user
# The socket is mounted read-only but we need read access
if [ -S "/var/run/docker.sock" ]; then
    # Get the GID of the docker socket
    DOCKER_GID=$(stat -c '%g' /var/run/docker.sock 2>/dev/null || stat -f '%g' /var/run/docker.sock 2>/dev/null)
    # Add nodejs to a group with that GID (create if needed)
    if [ -n "$DOCKER_GID" ]; then
        # Check if group with this GID exists
        if ! getent group "$DOCKER_GID" > /dev/null 2>&1; then
            addgroup -g "$DOCKER_GID" docker 2>/dev/null || true
        fi
        # Add nodejs to the docker group
        addgroup nodejs "$(getent group "$DOCKER_GID" | cut -d: -f1)" 2>/dev/null || true
    fi
fi

# Inject analytics script if ANALYTICS_URL and ANALYTICS_WEBSITE_ID are set
if [ -n "$ANALYTICS_URL" ] && [ -n "$ANALYTICS_WEBSITE_ID" ]; then
    echo "Injecting analytics script..."
    ANALYTICS_SCRIPT="<script defer src=\"${ANALYTICS_URL}/script.js\" data-website-id=\"${ANALYTICS_WEBSITE_ID}\"></script>"

    # Replace placeholder in index.html
    sed -i "s|<!--ANALYTICS_PLACEHOLDER-->|${ANALYTICS_SCRIPT}|g" /app/public/index.html
    echo "Analytics enabled: $ANALYTICS_URL"
else
    # Remove placeholder if no analytics configured
    sed -i "s|<!--ANALYTICS_PLACEHOLDER-->||g" /app/public/index.html
fi

# Drop privileges and execute the main command as nodejs user
exec su-exec nodejs "$@"
