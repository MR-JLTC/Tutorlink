# TutorLink Deployment Guide

This guide will help you deploy both the frontend and backend while maintaining the ability to run them locally.

## 🚀 Deployment Platforms

### Frontend Options:
- **Vercel** (Recommended) - Best for React/Vite apps
- **Netlify** - Alternative option

### Backend Options:
- **Railway** (Recommended) - Easy setup, includes database
- **Render** - Alternative option with free tier

## 📋 Prerequisites

1. **GitHub Account** - Your code should be in a GitHub repository
2. **Accounts on deployment platforms:**
   - Vercel/Netlify account for frontend
   - Railway/Render account for backend

## 🔧 Step 1: Prepare Your Code

### 1.1 Update Environment Variables

**Frontend (.env):**
```env
# For production, use your deployed backend URL
VITE_BACKEND_URL=https://your-backend.railway.app

# For local development, use:
# VITE_BACKEND_LAPTOP_IP=192.168.50.24
```

**Backend (backend/.env):**
```env
NODE_ENV=production
PORT=3000
DB_HOST=your-db-host
DB_PORT=3306
DB_USERNAME=your-db-username
DB_PASSWORD=your-db-password
DB_DATABASE=tutorlink
JWT_SECRET=your-strong-random-secret-key
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
FRONTEND_URL=https://your-frontend.vercel.app
```

## 🌐 Step 2: Deploy Backend (Railway)

### Option A: Railway (Recommended)

1. **Sign up** at [railway.app](https://railway.app)
2. **Create New Project** → "Deploy from GitHub repo"
3. **Select your repository**
4. **Configure:**
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`
5. **Add Environment Variables:**
   - Go to Variables tab
   - Add all variables from `backend/.env.example`
6. **Add MySQL Database:**
   - Click "New" → "Database" → "MySQL"
   - Railway will automatically provide connection variables
7. **Deploy!**

### Option B: Render

1. **Sign up** at [render.com](https://render.com)
2. **New** → **Web Service**
3. **Connect your GitHub repository**
4. **Configure:**
   - Name: `tutorlink-backend`
   - Root Directory: `backend`
   - Environment: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`
5. **Add Environment Variables** (from `backend/.env.example`)
6. **Add Database:**
   - New → PostgreSQL/MySQL
   - Copy connection details to environment variables
7. **Deploy!**

## 🎨 Step 3: Deploy Frontend (Vercel)

### Option A: Vercel (Recommended)

1. **Sign up** at [vercel.com](https://vercel.com)
2. **Import Project** from GitHub
3. **Configure:**
   - Framework Preset: Vite
   - Root Directory: `.` (root)
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Environment Variables:**
   - `VITE_BACKEND_URL`: Your deployed backend URL (e.g., `https://your-backend.railway.app`)
5. **Deploy!**

### Option B: Netlify

1. **Sign up** at [netlify.com](https://netlify.com)
2. **Add new site** → **Import from Git**
3. **Select your repository**
4. **Configure:**
   - Base directory: `.`
   - Build command: `npm run build`
   - Publish directory: `dist`
5. **Environment Variables:**
   - Go to Site settings → Environment variables
   - Add `VITE_BACKEND_URL`
6. **Deploy!**

## 🔄 Step 4: Update CORS Settings

After deploying, update your backend CORS to allow your frontend domain:

**backend/src/main.ts:**
```typescript
app.enableCors({
  origin: [
    'http://localhost:3001', // Local development
    'https://your-frontend.vercel.app', // Production frontend
  ],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
});
```

## 🏠 Step 5: Local Development Setup

### Running Locally

**Backend:**
```bash
cd backend
# Create .env file with local database settings
npm install
npm run start:dev
```

**Frontend:**
```bash
# Create .env file with local backend URL
npm install
npm run dev
```

### Environment Variables for Local Development

**Frontend (.env):**
```env
# Use local IP or localhost
VITE_BACKEND_LAPTOP_IP=192.168.50.24
# OR
# VITE_BACKEND_URL=http://localhost:3000
```

**Backend (backend/.env):**
```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_DATABASE=tutorlink
JWT_SECRET=your-local-secret
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
FRONTEND_URL=http://localhost:3001
```

## 🔐 Important Security Notes

1. **Never commit `.env` files** - They're in `.gitignore`
2. **Use strong JWT secrets** in production
3. **Enable HTTPS** on both frontend and backend
4. **Set `synchronize: false`** in production (already configured)
5. **Use environment variables** for all sensitive data

## 🐛 Troubleshooting

### Backend won't start
- Check database connection variables
- Ensure MySQL is accessible from deployment platform
- Check build logs for errors

### Frontend can't connect to backend
- Verify `VITE_BACKEND_URL` is set correctly
- Check CORS settings in backend
- Ensure backend is deployed and running

### Database connection errors
- Verify database credentials
- Check if database allows external connections
- For Railway/Render, use their provided database connection strings

## 📝 Quick Reference

### Local Development
```bash
# Backend
cd backend && npm run start:dev

# Frontend  
npm run dev
```

### Production URLs
- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-backend.railway.app`

### Environment Variable Priority
1. `VITE_BACKEND_URL` (production)
2. `VITE_BACKEND_LAPTOP_IP` (local with IP)
3. `localhost` (fallback)

## 🎉 You're Done!

Your app is now deployed and you can still run it locally for development!

