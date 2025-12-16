#!/bin/sh
set -e

# Fix ownership of data directory for mounted volumes
# This runs as root before dropping privileges
if [ -d "/app/data" ]; then
    chown -R nodejs:nodejs /app/data
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
