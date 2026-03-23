<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SVM classes ERP

This project now uses a MERN-style stack:

- React + Vite frontend
- Express + Node.js API server
- MongoDB with Mongoose models
- JWT-based authentication

## Deploy On Render

This repo is now prepared for a single-service Render deployment:

- Render builds the Vite frontend with `npm run build`
- Express serves the built `dist` frontend and all `/api/*` routes
- MongoDB should stay on MongoDB Atlas

### Render Setup

1. Push this project to GitHub.
2. In Render, create a new `Blueprint` deployment or a `Web Service`.
3. If you use the included [render.yaml](/Users/sagarika/Downloads/eduflow-erp/render.yaml), Render will auto-fill:
   - build command: `npm install && npm run build`
   - start command: `npm run start`
4. Add these environment variables in Render:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `NODE_ENV=production`
5. Deploy.

### Notes

- The app runs as one Node service on Render.
- No separate frontend service is required.
- After deploy, open your Render URL and log in normally.

Development is split into two processes:

- frontend: Vite dev server
- backend: Express API server

## Run Locally

**Prerequisites:** Node.js and a running MongoDB instance

1. Install dependencies:
   `npm install`
2. Create `.env.local` from `.env.example` and set:
   `MONGODB_URI=mongodb://127.0.0.1:27017/svm-classes-erp`
   `CLOUDINARY_CLOUD_NAME=your-cloud-name`
   `CLOUDINARY_API_KEY=your-cloudinary-api-key`
   `CLOUDINARY_API_SECRET=your-cloudinary-api-secret`
3. Start the backend API:
   `npm run dev:api`
4. In a second terminal, start the frontend:
   `npm run dev`
5. Open:
   `http://localhost:5173`

The frontend proxies `/api` requests to `http://127.0.0.1:3000` by default during development.

## Default Login

- Username: `admin`
- Password: `admin123`

The server seeds the admin account, classes, and starter subjects automatically on first boot.
