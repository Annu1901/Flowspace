# Netlify & GitHub Deployment Guide - Flowspace

This guide covers step-by-step instructions to push your repository to **GitHub** and deploy to **Netlify** with real email authentication via **Supabase Auth** & **Resend SMTP**.

---

## 1. Pushing to GitHub

1. Open your terminal in `d:/flowspace-source-code`:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Flowspace application"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/flowspace.git
   git push -u origin main
   ```

---

## 2. Deploying to Netlify

1. Log in to [Netlify Dashboard](https://app.netlify.com).
2. Click **Add new site** -> **Import an existing project**.
3. Select **GitHub** and pick `flowspace`.
4. Configure Build settings:
   - **Build command**: `npm run build` (or leave empty for static site)
   - **Publish directory**: `public`
5. Click **Environment Variables** -> Add:
   - **`SUPABASE_URL`**: `https://ovvbrwqyjdeomzezhacu.supabase.co`
   - **`SUPABASE_ANON_KEY`**: `sb_publishable_3UnL1xJOnf9cLMaLTd-zJA_ztW4WeRy`
6. Click **Deploy site**. Netlify will generate your live URL (e.g., `https://flowspace-app.netlify.app`).

---

## 3. Configuring Supabase Dashboard & Resend SMTP

### 3.1 Update Supabase URL Configuration
1. Open [Supabase Dashboard](https://app.supabase.com/project/ovvbrwqyjdeomzezhacu).
2. Go to **Authentication** -> **URL Configuration**:
   - Set **Site URL**: `https://flowspace-app.netlify.app`
   - Add to **Redirect URLs**:
     - `http://localhost:3000/**`
     - `https://flowspace-app.netlify.app/**`

### 3.2 Configure Resend Custom SMTP
1. Log in to [Resend.com](https://resend.com) -> Go to **API Keys** -> Create API Key (`re_...`).
2. Go to Supabase Dashboard -> **Authentication** -> **SMTP Settings**:
   - Turn **ON** **Enable Custom SMTP**.
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: *(Your Resend API key `re_...`)*
   - **Sender email**: `onboarding@resend.dev`
3. Click **Save**.
