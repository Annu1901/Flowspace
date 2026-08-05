# Deployment & Hosting Guide - Flowspace

This guide covers step-by-step instructions for pushing the codebase to **GitHub** and hosting the platform live on **Vercel** & **Render** with **Supabase PostgreSQL Database** & **Resend SMTP**.

---

## 1. Pushing to GitHub

1. Open your terminal in the repository root (`d:/flowspace-source-code`):
   ```bash
   git add .
   git commit -m "Update Flowspace application"
   git branch -M main
   git remote add origin https://github.com/Annu1901/Flowspace.git
   git push -u origin main
   ```

---

## 2. Deploying Frontend to Vercel

1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New** -> **Project**.
3. Import the GitHub repository **`Annu1901/Flowspace`**.
4. Framework Preset: **Other / Static HTML**.
5. Output Directory: `./public` (or root `./`).
6. Click **Deploy**.
7. Vercel will build and assign your live production URL: **[https://flowspace26.vercel.app/](https://flowspace26.vercel.app/)**.

---

## 3. Deploying Backend API to Render

1. Log in to [Render Dashboard](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect GitHub repository **`Annu1901/Flowspace`**.
4. Settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Environment Variables:
   - `SUPABASE_URL`: `https://ovvbrwqyjdeomzezhacu.supabase.co`
   - `SUPABASE_ANON_KEY`: `sb_publishable_3UnL1xJOnf9cLMaLTd-zJA_ztW4WeRy`
6. Click **Create Web Service**.

---

## 4. Configuring Supabase Dashboard & Resend SMTP

### 4.1 Update Supabase URL Configuration
1. Open [Supabase Dashboard](https://app.supabase.com/project/ovvbrwqyjdeomzezhacu).
2. Go to **Authentication** -> **URL Configuration**:
   - Set **Site URL**: `https://flowspace26.vercel.app`
   - Add to **Redirect URLs**:
     - `http://localhost:3000/**`
     - `https://flowspace26.vercel.app/**`

### 4.2 Configure Resend Custom SMTP
1. Log in to [Resend.com](https://resend.com) -> Go to **API Keys** -> Create API Key (`re_...`).
2. Go to Supabase Dashboard -> **Authentication** -> **SMTP Settings**:
   - Turn **ON** **Enable Custom SMTP**.
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: *(Your Resend API key `re_...`)*
   - **Sender email**: `onboarding@resend.dev`
3. Click **Save**.
