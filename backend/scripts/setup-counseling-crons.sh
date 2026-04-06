#!/bin/bash

# ==========================================
# Counseling System Cron Jobs Setup
# ==========================================
# This script sets up automated cron jobs for the counseling system
# Run this on your server to automate booking cleanup and completion

# Configuration
API_BASE_URL="http://localhost:3000"
ADMIN_TOKEN="YOUR_ADMIN_TOKEN_HERE"  # Replace with actual admin token

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up counseling system cron jobs...${NC}"

# Create cron jobs
(crontab -l 2>/dev/null; echo "
# ==========================================
# Counseling System Automated Jobs
# ==========================================

# Cleanup expired unpaid bookings (every 10 minutes)
*/10 * * * * curl -s -X POST ${API_BASE_URL}/api/counseling/admin/cleanup-expired -H 'Authorization: Bearer ${ADMIN_TOKEN}' -H 'Content-Type: application/json' >> /var/log/counseling-cleanup.log 2>&1

# Auto-complete past bookings (daily at midnight)
0 0 * * * curl -s -X POST ${API_BASE_URL}/api/counseling/admin/auto-complete -H 'Authorization: Bearer ${ADMIN_TOKEN}' -H 'Content-Type: application/json' >> /var/log/counseling-autocomplete.log 2>&1
") | crontab -

echo -e "${YELLOW}Cron jobs installed successfully!${NC}"
echo ""
echo "Schedule:"
echo "  - Expired booking cleanup: Every 10 minutes"
echo "  - Auto-complete past bookings: Daily at midnight"
echo ""
echo "Logs:"
echo "  - Cleanup: /var/log/counseling-cleanup.log"
echo "  - Auto-complete: /var/log/counseling-autocomplete.log"
echo ""
echo -e "${GREEN}To view cron jobs: crontab -l${NC}"
echo -e "${GREEN}To remove cron jobs: crontab -r${NC}"
