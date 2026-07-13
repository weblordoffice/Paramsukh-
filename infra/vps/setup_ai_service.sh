#!/bin/bash
set -e

echo "============================================="
echo "   ParamSukh AI Service Setup & Deploy       "
echo "============================================="

# Directories
PROJECT_DIR="/var/www/saas-native"
AI_DIR="$PROJECT_DIR/ai-service"

# Navigate to AI service
if [ -d "$AI_DIR" ]; then
  cd "$AI_DIR"
else
  echo "Error: Directory $AI_DIR does not exist."
  exit 1
fi

# Alert if .env is missing
if [ ! -f .env ]; then
  echo "⚠️ WARNING: .env file is missing in $AI_DIR!"
  echo "Make sure to create .env before using the service."
fi

# Ensure Python 3 Venv packages are installed
if ! dpkg -s python3-venv >/dev/null 2>&1; then
  echo "📦 Installing python3-venv and python3-pip..."
  sudo apt-get update && sudo apt-get install -y python3-venv python3-pip
fi

# Create Virtual Environment
echo "🐍 Creating Python Virtual Environment..."
python3 -m venv venv

# Install requirements
echo "📥 Installing dependencies from requirements.txt..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create systemd service configuration
echo "⚙️ Creating systemd service file (/etc/systemd/system/paramsukh-ai.service)..."
SERVICE_FILE="/etc/systemd/system/paramsukh-ai.service"

sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=ParamSukh AI Service FastAPI
After=network.target

[Service]
User=$USER
WorkingDirectory=$AI_DIR
ExecStart=$AI_DIR/venv/bin/python run.py
Restart=always
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOL

# Load and start the system service
echo "🚀 Starting and enabling paramsukh-ai service..."
sudo systemctl daemon-reload
sudo systemctl enable paramsukh-ai
sudo systemctl restart paramsukh-ai

echo "============================================="
echo "✅ Setup completed successfully!"
echo "View service logs with: sudo journalctl -u paramsukh-ai -f"
echo "Check service status with: sudo systemctl status paramsukh-ai"
echo "============================================="
