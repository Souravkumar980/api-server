# 🛡️ Propagandus API Server (Node.js & Cloudflare Workers)

High-performance, secure backend API server for the **Propagandus Sovereign Citizen Community**.

Supports two execution modes:
1. **Cloudflare Worker (Serverless Edge)**: Fast global deployment via Cloudflare Workers with free Cloudflare D1 SQLite database and global CORS enabled.
2. **Node.js (Self-Hosted / VPS)**: Express server with `better-sqlite3`, live Server-Sent Events (SSE) streaming, rate limiting, and honeypot security shields.

---

## ⚡ Micro-to-Micro Guide: Cloudflare Worker Deployment

Follow these exact step-by-step instructions to deploy this API to Cloudflare Workers for free so your InfinityFree frontend can make API calls directly.

### Step 1: Install Wrangler CLI & Authenticate
In your local terminal or GitHub Codespaces:
```bash
npm install
npx wrangler login
```
A browser window will open. Click **Allow** to authorize Cloudflare Wrangler with your Cloudflare account.

---

### Step 2: Create Cloudflare D1 Serverless Database
Run:
```bash
npx wrangler d1 create propagandus_db
```
Wrangler will output something like:
```text
✅ Successfully created DB 'propagandus_db'!

[[d1_databases]]
binding = "DB"
database_name = "propagandus_db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy the `database_id` string.

---

### Step 3: Configure `wrangler.toml`
Open `wrangler.toml` and update the database configuration:
```toml
name = "api-server"
main = "worker.js"
compatibility_date = "2024-10-01"

[[d1_databases]]
binding = "DB"
database_name = "propagandus_db"
database_id = "PASTE_YOUR_DATABASE_ID_HERE"
```

---

### Step 4: Run Database Schema Migration
Initialize the database tables and default admin account on Cloudflare D1:
```bash
npx wrangler d1 execute propagandus_db --remote --file=./schema.sql
```
This sets up all tables: `users`, `messages`, `channels`, `channel_members`, `reactions`, `direct_messages`, `posts`, `audit_logs`, and inserts the default admin master credentials (`omkumar.working@gmail.com`).

---

### Step 5: Deploy the Worker
Deploy your API server globally across Cloudflare edge data centers:
```bash
npx wrangler deploy
```
Upon completion, Cloudflare will print your live worker URL:
```text
Published api-server (0.85 sec)
  https://api-server.<your-subdomain>.workers.dev
```

---

### Step 6: Connect InfinityFree Frontend to Cloudflare Worker

Because Cloudflare Worker handles CORS headers (`Access-Control-Allow-Origin: *`), your InfinityFree static website can connect seamlessly to this worker.

In your frontend website (before deploying `dist/` to InfinityFree):
1. In your `index.html` inside `<head>` or before loading scripts, add:
```html
<script>
  window.__API_BASE_URL__ = "https://api-server.<your-subdomain>.workers.dev";
</script>
```
OR set the environment variable in `.env.production` before running `npm run build`:
```env
VITE_API_BASE_URL=https://api-server.<your-subdomain>.workers.dev
```

When users register, login, post messages, upload profile photos, or react on your InfinityFree hosted website, the requests will hit your Cloudflare Worker without any CORS errors.

---

## 💻 Alternative: Running with Node.js

To run the Node.js server locally or on any VPS:
```bash
npm install
npm start
```
The server will start on port `5000` (or `process.env.PORT`) with persistent SQLite storage at `data/propagandus.db`.

---

## 📡 Key API Routes

- `GET  /api/health` — Health check & status
- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login user / Admin
- `GET  /api/auth/session` — Fetch active session
- `POST /api/auth/logout` — End session
- `GET  /api/community/messages` — Fetch public & private channel messages
- `POST /api/community/messages` — Send message (with URL preview & reply support)
- `POST /api/community/messages/react` — Add/remove emoji reaction
- `DELETE /api/community/messages` — Delete message (Admin or author)
- `GET  /api/community/stream` — Live Server-Sent Events (SSE) real-time stream
- `POST /api/community/channels` — Create private / public channels
- `POST /api/community/channels/join` — Request access to private channels
- `GET  /api/user/profile` — Fetch user profile
- `POST /api/user/profile` — Update username, display name, avatar
- `GET  /api/admin/metrics` — Admin dashboard analytics & user management
- `POST /api/admin/users/badge` — Admin badge toggle (Golden / Blue / None)
- `POST /api/admin/users/ban` — Block / Unblock malicious users
- `GET  /api/posts` — Intel & fact dispatch posts
- `POST /api/posts/vote` — Live poll votes
- `POST /api/social-lookup` — YouTube / Twitter metadata fetcher
