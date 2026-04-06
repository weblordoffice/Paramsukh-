# ==========================================
# Counseling System - Windows Task Scheduler Setup
# ==========================================
# Run this PowerShell script as Administrator to create scheduled tasks

$API_BASE_URL = "http://localhost:3000"
$ADMIN_TOKEN = "YOUR_ADMIN_TOKEN_HERE"  # Replace with actual admin token

Write-Host "Setting up counseling system scheduled tasks..." -ForegroundColor Green

# Task 1: Cleanup expired bookings every 10 minutes
$Action1 = New-ScheduledTaskAction -Execute "curl.exe" -Argument "-s -X POST ${API_BASE_URL}/api/counseling/admin/cleanup-expired -H 'Authorization: Bearer ${ADMIN_TOKEN}' -H 'Content-Type: application/json'"
$Trigger1 = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10)
$Settings1 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName "Counseling-Cleanup-Expired" `
                       -Action $Action1 `
                       -Trigger $Trigger1 `
                       -Settings $Settings1 `
                       -Description "Cleanup unpaid counseling bookings older than 30 minutes" `
                       -Force

# Task 2: Auto-complete past bookings daily at midnight
$Action2 = New-ScheduledTaskAction -Execute "curl.exe" -Argument "-s -X POST ${API_BASE_URL}/api/counseling/admin/auto-complete -H 'Authorization: Bearer ${ADMIN_TOKEN}' -H 'Content-Type: application/json'"
$Trigger2 = New-ScheduledTaskTrigger -Daily -At 12:00AM
$Settings2 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName "Counseling-Auto-Complete" `
                       -Action $Action2 `
                       -Trigger $Trigger2 `
                       -Settings $Settings2 `
                       -Description "Auto-complete past confirmed counseling bookings" `
                       -Force

Write-Host "Scheduled tasks created successfully!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Tasks:"
Write-Host "  - Counseling-Cleanup-Expired: Every 10 minutes"
Write-Host "  - Counseling-Auto-Complete: Daily at midnight"
Write-Host ""
Write-Host "To view tasks: Open Task Scheduler"
Write-Host "To remove tasks: Unregister-ScheduledTask -TaskName 'Counseling-Cleanup-Expired'"
