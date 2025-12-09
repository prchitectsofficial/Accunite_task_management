# Quick Deployment Guide - DigitalOcean App Platform

This is a simplified guide for deploying to DigitalOcean App Platform.

## Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Ready for deployment"
git remote add origin https://github.com/YOUR-USERNAME/accunite-task-management.git
git push -u origin main
```

## Step 2: Create App on DigitalOcean

1. Go to https://cloud.digitalocean.com/apps
2. Click "Create App"
3. Connect your GitHub account
4. Select repository: `accunite-task-management`
5. Click "Next"

## Step 3: Configure Services

### Backend Service

- **Name**: `api`
- **Source Directory**: `/backend`
- **Build Command**: `npm install && npm run build`
- **Run Command**: `npm start`
- **HTTP Port**: `5000`

### Frontend Service

- **Name**: `frontend`
- **Source Directory**: `/frontend`
- **Build Command**: `npm install && npm run build`
- **Run Command**: `npm run preview -- --port 3000 --host 0.0.0.0`
- **HTTP Port**: `3000`

## Step 4: Environment Variables (Backend)

Add these environment variables to the `api` service:

```
JWT_SECRET=your-secret-key-here-generate-with-openssl-rand-base64-32
NODE_ENV=production
PORT=5000
DATABASE_PATH=/app/data/database.sqlite
APP_URL=https://your-app-name-xxxxx.ondigitalocean.app
```

Optional (for email features including welcome emails):

```
APP_URL=https://your-app-name-xxxxx.ondigitalocean.app
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=Accunite Task Management <noreply@accunite.com>
```

**Note:** Set `APP_URL` to your actual deployed app URL after deployment. This is used in welcome emails sent to new assignees.

## Step 5: Configure Routes

- `/api/*` → `api` service
- `/*` → `frontend` service

## Step 6: Deploy!

Click "Create Resources" and wait for deployment.

## Step 7: Access Your App

Once deployed, you'll get a URL like:
`https://accunite-task-management-xxxxx.ondigitalocean.app`

Login with:

- Email: `admin@accunite.com`
- Password: `admin123`

## Important Notes

1. **Database**: SQLite database will persist in `/app/data/`
2. **Scaling**: Start with Basic plan ($5/service) and scale as needed
3. **Backups**: Consider setting up database backups
4. **Custom Domain**: Add your domain in App Platform settings
5. **SSL**: Automatically handled by App Platform

## Generate Secure JWT Secret

```bash
# On Mac/Linux
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

## Troubleshooting

- Check build logs in App Platform
- Verify environment variables are set correctly
- Ensure ports match (5000 for backend, 3000 for frontend)
- Check service logs for runtime errors
