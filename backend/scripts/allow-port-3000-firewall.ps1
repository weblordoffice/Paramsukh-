# Run this script as Administrator (right-click PowerShell -> Run as administrator)
# Allows inbound TCP on port 3000 so your phone can reach the backend on the same Wi-Fi

$ruleName = "ParamSukh Backend (Port 3000)"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Rule '$ruleName' already exists." -ForegroundColor Yellow
  exit 0
}

New-NetFirewallRule -DisplayName $ruleName `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 3000 `
  -Action Allow `
  -Profile Private, Domain

Write-Host "Firewall rule added. Your phone can now reach http://YOUR_PC_IP:3000" -ForegroundColor Green
