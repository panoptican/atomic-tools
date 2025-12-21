# Wordle Solution Checker

A fast, always-up-to-date web application to check if a word has ever been a Wordle solution.

## ✨ Features

- ⚡ **Instant checks** - No loading, no delays
- 🔄 **Always current** - Automatically syncs with latest Wordle solutions daily
- 🌍 **Blazing fast** - Powered by Cloudflare's global edge network
- 🎨 **Visual tile preview** - Wordle-style color coding
- 🎯 **Spoiler-free** - Automatically excludes today's solution
- 🆓 **100% Free** - Runs on Cloudflare's generous free tier

## 🏗️ Architecture

This project consists of two parts:

### Frontend (`index.html`)
- Simple, clean Wordle-themed interface
- No build step required
- Calls backend API to check words

### Backend (`worker.js`)
- **Cloudflare Worker** running on the edge
- **KV storage** for caching word list
- **Cron job** refreshes data daily at 3 AM UTC
- Fetches from wordlehints.co.uk API

```
Frontend → Cloudflare Worker → KV Cache → wordlehints.co.uk
                 ↑                 ↑
                 └─────────────────┘
                  (Cron: Daily 3AM)
```

## 🚀 Deployment

### Backend (Cloudflare Worker)

See **[CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md)** for detailed step-by-step instructions.

**Quick start:**
```bash
# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login

# Create KV namespace
npm run kv:create

# Update wrangler.toml with KV ID (from previous step)

# Deploy!
npm run deploy
```

### Frontend (GitHub Pages)

1. Update `API_URL` in `index.html` with your Worker URL
2. Push to GitHub
3. Enable GitHub Pages:
   - Settings → Pages
   - Source: Deploy from a branch
   - Branch: `main` / `/ (root)`
   - Save

Your site will be available at: `https://<username>.github.io/wordle-checker/`

## 🛠️ Local Development

### Frontend only:
```bash
python3 -m http.server 8080
# Visit http://localhost:8080
```

### Worker development:
```bash
npm run dev
# Worker runs at http://localhost:8787
```

## 📝 Scripts

```bash
npm run dev         # Run Worker locally
npm run deploy      # Deploy Worker to Cloudflare
npm run tail        # View Worker logs in real-time
npm run kv:create   # Create KV namespace
npm run kv:list     # List keys in KV
npm run kv:get      # Get word list from KV
```

## 🧪 Testing

Legacy test scripts (for old static word list approach):

```bash
node test-checker.js
node analyze-wordlist.js
node test-today-exclusion.js
```

Test the Worker API:
```bash
curl https://your-worker.workers.dev/api/check-word?word=CIGAR
```

## 📖 Documentation

- **[CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md)** - Complete deployment guide
- **[worker.js](./worker.js)** - Backend API code
- **[wrangler.toml](./wrangler.toml)** - Worker configuration

## 🎯 Why Cloudflare Workers?

**Before (v1):**
- ❌ Slow: Load 550+ words on every page load
- ❌ Manual updates: Need to edit code to add new words
- ❌ CORS issues: External API often blocked
- ❌ Stale data: Falls back to outdated static list

**After (v2 with Worker):**
- ✅ Fast: Zero loading, instant results
- ✅ Auto-updates: Daily cron job syncs new words
- ✅ No CORS: Worker fetches server-side
- ✅ Always fresh: KV cache updated automatically
- ✅ Free: 100k requests/day on free tier

## 📄 License

MIT