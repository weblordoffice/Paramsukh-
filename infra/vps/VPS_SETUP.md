# VPS Setup Guide

This guide configures one VPS for backend, admin, Docker Compose, Nginx, and SSL.

## 1) Install Docker and Nginx

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release nginx certbot python3-certbot-nginx
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release; echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and log in again after adding docker group.

## 2) Clone project on VPS

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone https://github.com/neerajk001/paramsukh.git saas-native
cd /var/www/saas-native
```

## 3) Prepare runtime env files

```bash
cp infra/vps/backend.env.example backend/.env
cp infra/vps/admin.env.production.example admin/.env.production
cp infra/vps/compose.env.example .env
```

Edit values with production credentials and domains.

Important for admin auth:
- In `.env` (project root), set `NEXT_PUBLIC_ADMIN_API_KEY` and keep it exactly the same as `ADMIN_API_KEY` in `backend/.env`.
- If this key changes, rebuild admin image before restart so the new key is baked into the frontend bundle.

## 4) First local container start

```bash
docker compose build backend admin
docker compose up -d backend admin
docker compose ps
curl http://127.0.0.1:3000/health
```

## 5) Configure Nginx vhosts

```bash
sudo cp infra/vps/nginx/api.example.com.conf /etc/nginx/sites-available/api.example.com
sudo cp infra/vps/nginx/admin.example.com.conf /etc/nginx/sites-available/admin.example.com
```

Open both files and replace domains:
- api.example.com -> your API domain
- admin.example.com -> your admin domain

Enable sites:

```bash
sudo ln -s /etc/nginx/sites-available/api.example.com /etc/nginx/sites-enabled/api.example.com
sudo ln -s /etc/nginx/sites-available/admin.example.com /etc/nginx/sites-enabled/admin.example.com
sudo nginx -t
sudo systemctl reload nginx
```

## 6) Issue SSL certificates

```bash
sudo certbot --nginx -d api.example.com -d admin.example.com
sudo systemctl status certbot.timer
```

## 7) GitHub Actions deploy prerequisites

Your repository secrets should include:
- VPS_HOST
- VPS_USER
- VPS_SSH_KEY
- VPS_PROJECT_PATH
- GHCR_USERNAME
- GHCR_TOKEN
- EXPO_TOKEN

Set VPS_PROJECT_PATH to:

```text
/var/www/saas-native
```

## 8) Mobile production API URL

Set mobile API URL in app config:
- mobile/app.json -> expo.extra.apiUrl = https://api.your-domain.com

Then build via workflow tag:

```bash
git tag mobile-v1.0.0
git push origin mobile-v1.0.0
```

## 9) Rotate exposed credentials

If any secrets were committed during development, rotate them before production:
- Google OAuth client secret
- JWT secret
- Admin API key
- Any API keys in .env files
