# Quick Deployment Guide

## 🚀 Fast Track Deployment

### Backend Deployment (Railway - Recommended)

1. **Go to** [railway.app](https://railway.app) and sign up
2. **New Project** → **Deploy from GitHub**
3. **Select your repo**
4. **Settings:**
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`
5. **Add MySQL Database:**
   - Click "New" → "Database" → "MySQL"
6. **Environment Variables:**
   ```
   NODE_ENV=production
   PORT=3000
   DB_HOST=<from database>
   DB_PORT=<from database>
   DB_USERNAME=<from database>
   DB_PASSWORD=<from database>
   DB_DATABASE=<from database>
   JWT_SECRET=<generate-a-strong-random-string>
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=your-app-password
   FRONTEND_URL=https://your-frontend.vercel.app
   ```
7. **Copy your backend URL** (e.g., `https://your-app.railway.app`)

### Frontend Deployment (Vercel - Recommended)

1. **Go to** [vercel.com](https://vercel.com) and sign up
2. **Import Project** from GitHub
3. **Settings:**
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Environment Variables:**
   ```
   VITE_BACKEND_URL=https://your-backend.railway.app
   ```
5. **Deploy!**

## 🏠 Local Development

### Backend
```bash
cd backend
# Create .env file (see backend/.env.example)
npm install
npm run start:dev
```

### Frontend
```bash
# Create .env file (see .env.example)
npm install
npm run dev
```

## 📝 Environment Files

**Frontend `.env`:**
```env
VITE_BACKEND_LAPTOP_IP=192.168.50.24
```

**Backend `backend/.env`:**
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

## ✅ Checklist

- [ ] Backend deployed and running
- [ ] Frontend deployed and running
- [ ] Environment variables set in both platforms
- [ ] Database connected
- [ ] CORS configured correctly
- [ ] Local development still works

