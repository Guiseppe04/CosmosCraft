# CosmosCraft - Deployment Guide

## Overview
This guide walks you through deploying CosmosCraft using:
- **Backend**: Render
- **Frontend**: Netlify

## Prerequisites
- GitHub repository with your code
- Render account (https://render.com)
- Netlify account (https://netlify.com)
- MongoDB Atlas account (https://www.mongodb.com/cloud/atlas)

## Backend Deployment (Render)

### Step 1: Set up MongoDB Atlas
1. Create a MongoDB cluster on MongoDB Atlas
2. Create a database user with appropriate permissions
3. Get your connection string: `mongodb+srv://username:password@cluster.mongodb.net/cosmoscraft`

### Step 2: Deploy to Render
1. Go to https://dashboard.render.com
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: cosmoscraft-backend
   - **Environment**: Node
   - **Plan**: Free (for testing), Starter+ (for production)
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`

### Step 3: Add Environment Variables
In Render dashboard, add these environment variables:
- `NODE_ENV`: `production`
- `MONGODB_URI`: Your MongoDB connection string
- `FRONTEND_URL`: Your Netlify frontend URL
- `JWT_SECRET`: Generate a strong secret (use `openssl rand -hex 32`)
- `JWT_EXPIRE`: `7d`
- `REFRESH_TOKEN_EXPIRE`: `30d`
- `GOOGLE_CLIENT_ID`: From Google OAuth
- `GOOGLE_CLIENT_SECRET`: From Google OAuth
- `FACEBOOK_APP_ID`: From Facebook OAuth
- `FACEBOOK_APP_SECRET`: From Facebook OAuth
- `MAIL_USER`: Your Gmail address
- `MAIL_PASS`: Gmail app password (not your main password)
- `MAIL_FROM`: noreply@cosmoscraft.com

### Step 4: Update OAuth Callbacks
For Google and Facebook OAuth:
- Update callback URLs to point to your Render backend URL
- Format: `https://your-render-backend.onrender.com/auth/google/callback`

## Frontend Deployment (Netlify)

### Step 1: Deploy to Netlify
1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub repository
4. Configure the build:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/dist`
   - **Node version**: 20

### Step 2: Add Environment Variables
In Netlify Site Settings → Build & Deploy → Environment:
- `VITE_API_URL`: Your Render backend URL (e.g., `https://cosmoscraft-backend.onrender.com`)
- `VITE_APP_NAME`: `CosmosCraft`

### Step 3: Configure Build Settings
Make sure these are set in `netlify.toml`:
- Build command: `cd client && npm run build`
- Publish directory: `client/dist`
- Functions directory: (leave empty unless using serverless functions)

## Post-Deployment

### Update CORS
Your backend CORS is configured to allow your Netlify frontend URL. Verify in:
- `server/index.js` - `origin: process.env.FRONTEND_URL`

### Update API Endpoints
Frontend makes requests to API_URL environment variable:
- Development: `http://localhost:5000`
- Production: Your Render backend URL

### Testing
1. Backend health check: `https://your-render-backend.onrender.com/health`
2. Test login/signup endpoints
3. Verify email notifications work
4. Test OAuth flows

## Troubleshooting

### Backend not starting
- Check logs in Render dashboard
- Verify all environment variables are set
- Ensure MongoDB connection string is correct

### Frontend not connecting to backend
- Check `VITE_API_URL` environment variable
- Verify CORS settings in `server/index.js`
- Check browser console for network errors

### MongoDB connection fails
- Verify IP whitelist in MongoDB Atlas (allow all IPs: 0.0.0.0/0)
- Check username and password in connection string
- Ensure database name is correct

### Email sending fails
- Gmail requires "App Password" (not your main password)
- Enable "Less secure app access" if needed
- Check SMTP settings in environment variables

## Environment Variables Checklist

### Backend (.env)
```
□ NODE_ENV=production
□ PORT=10000 (Render assigns this)
□ MONGODB_URI=<your-mongodb-uri>
□ FRONTEND_URL=<your-netlify-url>
□ JWT_SECRET=<strong-random-key>
□ JWT_EXPIRE=7d
□ REFRESH_TOKEN_EXPIRE=30d
□ GOOGLE_CLIENT_ID=<google-oauth>
□ GOOGLE_CLIENT_SECRET=<google-oauth>
□ FACEBOOK_APP_ID=<facebook-oauth>
□ FACEBOOK_APP_SECRET=<facebook-oauth>
□ MAIL_HOST=smtp.gmail.com
□ MAIL_PORT=587
□ MAIL_USER=<your-gmail>
□ MAIL_PASS=<app-password>
□ MAIL_FROM=noreply@cosmoscraft.com
```

### Frontend (.env)
```
□ VITE_API_URL=<your-render-backend-url>
□ VITE_APP_NAME=CosmosCraft
```

## Useful Links
- Render Docs: https://render.com/docs
- Netlify Docs: https://docs.netlify.com
- MongoDB Atlas: https://www.mongodb.com/cloud/atlas
- Google OAuth: https://developers.google.com/identity/protocols/oauth2
- Facebook OAuth: https://developers.facebook.com/docs/facebook-login
