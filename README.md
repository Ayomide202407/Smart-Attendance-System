# Smart-Attendance-System
An AI based attendance system.

## Local development
Backend (Flask):
1. `cd Backend`
2. `pip install -r requirements.txt`
3. `python app.py`

Frontend (Vite + React):
1. `cd frontend`
2. `npm install`
3. `npm run dev`

## Reset local data
This project stores demo/test data locally in SQLite and image/embedding folders. To wipe everything:
- Delete `ignis.db`
- Delete `Backend/dataset/`
- Delete `Backend/embeddings/`
- Delete `Backend/exports/`

## Hosting (recommended for occasional use)
Backend: Render (free tier, sleeps after inactivity)
1. Create a new Render Web Service from this repo.
2. Render will pick up `render.yaml` automatically.
3. After deploy, copy the public backend URL.
4. Set `CORS_ORIGINS` in Render to your frontend URL.

Frontend: Vercel
1. Create a new Vercel project from this repo.
2. Set Root Directory to `frontend`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add environment variables:
   - `VITE_API_URL=https://<your-render-backend-url>`
   - `VITE_API_BASE_URL=https://<your-render-backend-url>`

