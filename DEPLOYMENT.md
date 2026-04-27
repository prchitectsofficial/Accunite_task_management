# DigitalOcean Deployment Guide

This guide will walk you through deploying the Accunite Task Management system to DigitalOcean.

## Option 1: DigitalOcean App Platform (Recommended - Easiest)

### Prerequisites

1. A DigitalOcean account ([Sign up here](https://cloud.digitalocean.com/registrations/new))
2. Your code in a GitHub repository
3. Node.js installed locally for testing

### Step 1: Prepare Your Code

1. **Update CORS settings** for production:

   - The backend already has CORS enabled, but you may need to restrict it to your domain in production

2. **Build and test locally**:

```bash
npm run build
```

3. **Push your code to GitHub**:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/accunite-task-management.git
git push -u origin main
```

### Step 2: Deploy to DigitalOcean App Platform

1. **Log into DigitalOcean** and go to the App Platform section

2. **Create a New App**:

   - Click "Create App"
   - Select your GitHub repository
   - Choose the branch (usually `main`)

3. **Configure Backend Service**:

   - **Name**: `api`
   - **Source Directory**: `/backend`
   - **Build Command**: `npm install && npm run build`
   - **Run Command**: `npm start`
   - **HTTP Port**: `5000`
   - **Environment**: Node.js
   - **Instance Size**: Basic ($5/month) or Professional ($12/month)

4. **Configure Frontend Service**:

   - **Name**: `frontend`
   - **Source Directory**: `/frontend`
   - **Build Command**: `npm install && npm run build`
   - **Run Command**: `npm run preview`
   - **HTTP Port**: `3000`
   - **Environment**: Node.js
   - **Instance Size**: Basic ($5/month)

5. **Set Environment Variables** for the backend:

   - `JWT_SECRET`: A secure random string (use a password generator)
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `DATABASE_PATH`: `/app/data/database.sqlite`
   - `APP_URL`: Your app's public URL (e.g., `https://your-app.ondigitalocean.app`) - required for welcome emails
   - `EMAIL_HOST`: Your email SMTP host (required for email features)
   - `EMAIL_PORT`: `587` (optional, default: 587)
   - `EMAIL_USER`: Your email (required for email features)
   - `EMAIL_PASS`: Your email password/app password (required for email features)
   - `EMAIL_FROM`: `Accunite Task Management <noreply@accunite.com>` (optional)

6. **Configure Routes**:

   - Backend: `/api/*` → `api` service
   - Frontend: `/*` → `frontend` service

7. **Review and Deploy**:

   - Review your configuration
   - Click "Create Resources"
   - Wait for deployment (5-10 minutes)

8. **Access Your App**:
   - Once deployed, you'll get a URL like: `https://accunite-task-management-xxxxx.ondigitalocean.app`
   - The frontend will be at the root URL
   - The backend API will be at `/api`

### Step 3: Update Frontend API Base URL

After deployment, update the frontend to use the production API:

1. The frontend currently uses a proxy (`/api`), which works if both services are on the same domain
2. If you need to use a different backend URL, update `frontend/src/services/api.ts`:

```typescript
const api = axios.create({
  baseURL: process.env.VITE_API_URL || "/api",
  // ...
});
```

Then add `VITE_API_URL` as an environment variable in App Platform.

## Option 2: DigitalOcean Droplet (More Control)

### Prerequisites

1. A DigitalOcean account
2. SSH access to your droplet
3. Basic knowledge of Linux commands

### Step 1: Create a Droplet

1. Create a new Droplet:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic ($6/month minimum, recommend $12/month for better performance)
   - **Region**: Choose closest to your users
   - **Authentication**: SSH keys (recommended) or password
   - **Hostname**: `accunite-task-management`

### Step 2: Initial Server Setup

SSH into your droplet:

```bash
ssh root@your-droplet-ip
```

Update the system:

```bash
apt update && apt upgrade -y
```

Install Node.js (v18 or later):

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
```

Install PM2 (process manager):

```bash
npm install -g pm2
```

Install Nginx:

```bash
apt install -y nginx
```

### Step 3: Clone and Build Your Application

```bash
# Clone your repository
cd /var/www
git clone https://github.com/your-username/accunite-task-management.git
cd accunite-task-management

# Install dependencies
npm run install:all

# Build the application
npm run build

# Create data directory for database
mkdir -p /var/www/accunite-task-management/backend/data
chmod 755 /var/www/accunite-task-management/backend/data
```

### Step 4: Configure Environment Variables

```bash
cd /var/www/accunite-task-management/backend
nano .env
```

Add your production environment variables:

```env
PORT=5000
NODE_ENV=production
JWT_SECRET=your-very-secure-secret-key-here
DATABASE_PATH=/var/www/accunite-task-management/backend/data/database.sqlite
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=Accunite Task Management <noreply@accunite.com>
```

### Step 5: Set Up Nginx Reverse Proxy

Create Nginx configuration:

```bash
nano /etc/nginx/sites-available/accunite-task-management
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/accunite-task-management /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Step 6: Set Up PM2

Create PM2 ecosystem file:

```bash
cd /var/www/accunite-task-management
nano ecosystem.config.js
```

Add:

```javascript
module.exports = {
  apps: [
    {
      name: "accunite-backend",
      cwd: "/var/www/accunite-task-management/backend",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      error_file: "/var/log/pm2/backend-error.log",
      out_file: "/var/log/pm2/backend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
    {
      name: "accunite-frontend",
      cwd: "/var/www/accunite-task-management/frontend",
      script: "npm",
      args: "run preview",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/var/log/pm2/frontend-error.log",
      out_file: "/var/log/pm2/frontend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
```

Start applications with PM2:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Step 7: Set Up SSL with Let's Encrypt

Install Certbot:

```bash
apt install -y certbot python3-certbot-nginx
```

Get SSL certificate:

```bash
certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow the prompts. Certbot will automatically configure Nginx for HTTPS.

### Step 8: Set Up Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### Step 9: Monitor Your Application

Check application status:

```bash
pm2 status
pm2 logs
```

## Post-Deployment

### 1. Test Your Deployment

- Visit your domain
- Login with default credentials: `admin@accunite.com` / `admin123`
- Create test tasks and users
- Verify all features work

### 2. Security Recommendations

- Change the default admin password immediately
- Use strong JWT_SECRET (generate with: `openssl rand -base64 32`)
- Enable firewall (already done if using droplet)
- Keep your server updated: `apt update && apt upgrade`

### 3. Backup Strategy

For SQLite database:

```bash
# Create a backup script
nano /usr/local/bin/backup-database.sh
```

Add:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/accunite"
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)
cp /var/www/accunite-task-management/backend/data/database.sqlite $BACKUP_DIR/database_$DATE.sqlite
# Keep only last 7 days of backups
find $BACKUP_DIR -name "database_*.sqlite" -mtime +7 -delete
```

Make executable:

```bash
chmod +x /usr/local/bin/backup-database.sh
```

Add to crontab (daily at 2 AM):

```bash
crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-database.sh
```

### 4. Monitoring

- Set up PM2 monitoring: `pm2 install pm2-logrotate`
- Configure log rotation
- Consider setting up alerts for downtime

## Troubleshooting

### Backend won't start

- Check logs: `pm2 logs accunite-backend`
- Verify environment variables
- Check database path permissions

### Frontend can't connect to backend

- Verify Nginx configuration
- Check backend is running: `pm2 status`
- Verify CORS settings in backend

### Database errors

- Check file permissions: `chmod 644 database.sqlite`
- Verify DATABASE_PATH in .env
- Ensure data directory exists

## Cost Estimate

**App Platform:**

- Backend: $5-12/month
- Frontend: $5/month
- **Total: ~$10-17/month**

**Droplet:**

- Droplet: $6-12/month
- **Total: ~$6-12/month** (more control, requires management)

## Need Help?

- Check DigitalOcean documentation
- Review application logs
- Test locally first to isolate issues
