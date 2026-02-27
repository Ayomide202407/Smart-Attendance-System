# Deploying This Project to PythonAnywhere

This project has:
- Backend: Flask app in `Backend/app.py`
- Frontend: Vite React app in `frontend/`

PythonAnywhere can host the Flask backend directly. For the frontend, easiest option is to host it on Vercel/Netlify and point it to PythonAnywhere backend URL.

## 1) Upload code to PythonAnywhere

From PythonAnywhere Bash console:

```bash
cd ~
git clone <your-repo-url> "EEE451 PROJECT"
cd "EEE451 PROJECT"
```

If repo is already there:

```bash
cd ~/EEE451\ PROJECT
git pull
```

## 2) Create virtualenv and install packages

```bash
mkvirtualenv --python=/usr/bin/python3.10 eee451env
cd ~/EEE451\ PROJECT/Backend
pip install -r requirements-pythonanywhere.txt
```

If your PythonAnywhere image uses Python 3.11, use that path instead.

## 3) Create Flask web app on PythonAnywhere

1. Go to **Web** tab.
2. Click **Add a new web app**.
3. Choose **Manual configuration**.
4. Choose Python version that matches your virtualenv.
5. Set **Virtualenv** to:
   - `/home/<your-username>/.virtualenvs/eee451env`

## 4) Configure WSGI file

In Web tab, open WSGI file:
- `/var/www/<your-username>_pythonanywhere_com_wsgi.py`

Replace contents with the template from:
- `Backend/pythonanywhere_wsgi_template.py`

Then edit placeholders:
- Replace `<your-username>`
- If your folder name differs from `EEE451 PROJECT`, update `PROJECT_HOME`

## 5) Set environment variables (recommended)

In WSGI file (already included defaults), set these to your real values:
- `SECRET_KEY`
- `FLASK_DEBUG=0`
- `CORS_ORIGINS`:
  - use your frontend URL (for example `https://your-frontend.vercel.app`)
  - use `*` only for quick testing

## 6) Reload and test

1. Click **Reload** in Web tab.
2. Open:
   - `https://<your-username>.pythonanywhere.com/health`
3. Expected response:
   - `{"status":"ok"}`

If it fails, check:
- **Web tab > Error log**
- **Web tab > Server log**

## 7) Frontend configuration

If frontend is hosted elsewhere, set:
- `VITE_API_BASE_URL=https://<your-username>.pythonanywhere.com`

Then redeploy frontend.

## Notes specific to this project

- SQLite DB file is configured to:
  - `~/EEE451 PROJECT/Backend/ignis.db`
- OpenCV dependency uses `opencv-contrib-python-headless` in PythonAnywhere requirements.
- Live camera modules (`run_live.py`) are not suitable for PythonAnywhere web hosting.

