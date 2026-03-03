---
description: Deploy web application for free using Vercel (frontend) and Render (backend)
---

# Deploy Free

## Frontend → Vercel (free)
1. Push code to GitHub
2. Go to https://vercel.com and sign in with GitHub
3. Import the repo, set root directory to `frontend`
4. Set environment variable: `NEXT_PUBLIC_API_BASE` = your Render backend URL
5. Deploy

## Backend → Render (free)
1. Push code to GitHub
2. Go to https://render.com and sign in with GitHub
3. Create new Web Service, connect the repo
4. Set root directory to `backend`
5. Build command: `pip install -r requirements.txt`
6. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
7. Add environment variables from `.env`

## Alternative: Railway (free tier)
1. Go to https://railway.app
2. Connect GitHub repo
3. Deploy both frontend and backend as separate services

## Auto-deploy via GitHub Actions
- Push to `main` branch triggers auto-deploy on both Vercel and Render
- See `.github/workflows/deploy.yml` for CI/CD configuration
