# Deployment Guide: Ayur AI

This guide provides complete, step-by-step instructions on how to export your Ayur AI project to a GitHub repository and deploy it to a shared server (like a VPS, cPanel, or a PaaS like Render/Railway).

## Phase 1: Export to GitHub

Since you are currently building this in Google AI Studio, the easiest way to get your code onto GitHub is to use the built-in export feature.

### Option A: Direct Export (Recommended)
1. In the AI Studio interface, look for the **Settings** menu (usually a gear icon or an export button in the top right corner).
2. Select **Export to GitHub**.
3. Follow the prompts to authenticate with your GitHub account.
4. Choose to create a new repository (e.g., `ayur-ai-app`).
5. AI Studio will automatically push all your code to that new repository.

### Option B: Manual Export via ZIP
1. In the AI Studio interface, select **Download ZIP** from the settings/export menu.
2. Extract the ZIP file on your local computer.
3. Open your terminal/command prompt and navigate to the extracted folder:
   ```bash
   cd path/to/ayur-ai
   ```
4. Initialize a Git repository and push it to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

---

## Phase 2: Deploying to a Shared Server

Ayur AI is a full-stack Node.js application (using Express for the backend and Vite/React for the frontend). It requires a server that can run Node.js.

### Option 1: Deploying to a VPS (Ubuntu / Debian) or cPanel with Node.js Support

If you have a shared hosting plan with cPanel (that supports Node.js apps) or a Virtual Private Server (VPS):

#### Step 1: Clone the Repository
SSH into your server and clone your GitHub repository:
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

#### Step 2: Install Node.js (If not already installed)
Ensure you have Node.js (v18 or higher) installed on your server.
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Step 3: Install Dependencies
```bash
npm install
```

#### Step 4: Configure Environment Variables
Create a `.env` file in the root directory of your project:
```bash
nano .env
```
Add the following variables:
```env
GEMINI_API_KEY="your_gemini_api_key_here"
APP_URL="https://yourdomain.com"
```
*(Note: Since Ayur AI allows adding API keys via the Admin Panel, the `GEMINI_API_KEY` in the `.env` is optional but good for a fallback).*

#### Step 5: Build the Application
Compile the frontend Vite app into static files:
```bash
npm run build
```

#### Step 6: Start the Server with PM2
To keep your app running in the background even after you close the terminal, use PM2:
```bash
sudo npm install -g pm2
pm2 start npm --name "ayur-ai" -- run start
pm2 save
pm2 startup
```

#### Step 7: Set up Nginx Reverse Proxy (Optional but Recommended)
If you want to map your domain (e.g., `ayurai.com`) to the app running on port 3000:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Restart Nginx: `sudo systemctl restart nginx`

---

### Option 2: Deploying to a PaaS (Render, Railway, or Heroku)

This is the easiest way to host a Node.js app without managing server infrastructure.

#### Step 1: Create an Account
Sign up for [Render.com](https://render.com) or [Railway.app](https://railway.app).

#### Step 2: Create a New Web Service
1. Click **New +** and select **Web Service**.
2. Connect your GitHub account and select the `ayur-ai-app` repository you created in Phase 1.

#### Step 3: Configure the Build and Start Commands
In the service settings, configure the following:
*   **Environment / Runtime:** Node.js
*   **Build Command:** `npm install && npm run build`
*   **Start Command:** `npm run start`

#### Step 4: Add Environment Variables
In the "Environment" or "Variables" tab of your hosting dashboard, add:
*   `GEMINI_API_KEY`: (Your API Key)
*   `APP_URL`: (The URL provided by Render/Railway, e.g., `https://ayur-ai.onrender.com`)

#### Step 5: Deploy
Click **Deploy** or **Save**. The platform will automatically pull your code from GitHub, install dependencies, build the app, and start the server. Any future pushes to your GitHub `main` branch will automatically trigger a new deployment.

---

## Database Note
Ayur AI uses SQLite (`better-sqlite3`) to store chats, messages, and admin settings. 
*   A file named `ayurai.db` will be created automatically in the root folder when the server starts.
*   **Important for PaaS (Render/Railway):** These platforms use ephemeral file systems. If your app restarts, the `ayurai.db` file will be wiped. To prevent data loss on Render/Railway, you MUST attach a **Persistent Disk** (Volume) to your service and mount it to the directory where the database is saved, or modify `server.ts` to save the DB file inside that mounted volume.
*   **For VPS/cPanel:** You don't need to worry about this; the file system is persistent.
