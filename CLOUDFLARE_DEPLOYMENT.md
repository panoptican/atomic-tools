# Cloudflare Worker Backend Deployment Guide

This guide will help you deploy the Wordle Checker backend to Cloudflare Workers.

## Prerequisites

1. **Cloudflare Account** (free tier works perfectly)
   - Sign up at https://dash.cloudflare.com/sign-up

2. **Node.js and npm** installed
   - Check: `node --version` and `npm --version`

3. **Wrangler CLI** - Cloudflare's development tool
   ```bash
   npm install -g wrangler
   ```

## Step 1: Login to Cloudflare

```bash
wrangler login
```

This will open your browser to authenticate with Cloudflare.

## Step 2: Create KV Namespace

The Worker needs a KV (Key-Value) storage to cache the word list.

```bash
# Create the KV namespace
wrangler kv:namespace create WORDLE_KV

# This will output something like:
# 🌀 Creating namespace with title "wordle-checker-api-WORDLE_KV"
# ✨ Success!
# Add the following to your wrangler.toml:
# { binding = "WORDLE_KV", id = "abcd1234..." }
```

**Important:** Copy the `id` value from the output!

## Step 3: Update wrangler.toml

Open `wrangler.toml` and replace `YOUR_KV_NAMESPACE_ID` with the ID from Step 2:

```toml
kv_namespaces = [
  { binding = "WORDLE_KV", id = "YOUR_ACTUAL_ID_HERE" }
]
```

For example:
```toml
kv_namespaces = [
  { binding = "WORDLE_KV", id = "abcd1234efgh5678" }
]
```

## Step 4: Deploy the Worker

```bash
wrangler deploy
```

This will:
- Bundle your worker code
- Upload it to Cloudflare's edge network
- Output your Worker URL

Example output:
```
✨ Success! Deployed wordle-checker-api
   https://wordle-checker-api.YOUR-SUBDOMAIN.workers.dev
```

**Copy this URL!** You'll need it for the frontend.

## Step 5: Test the Worker

Test the health endpoint:
```bash
curl https://wordle-checker-api.YOUR-SUBDOMAIN.workers.dev/health
```

Expected response:
```json
{"status":"ok"}
```

Test checking a word:
```bash
curl https://wordle-checker-api.YOUR-SUBDOMAIN.workers.dev/api/check-word?word=CIGAR
```

Expected response (example):
```json
{
  "used": true,
  "word": "CIGAR",
  "game": 1,
  "date": "2021-06-19"
}
```

## Step 6: Update Frontend

Open `index.html` and update the `API_URL` constant (around line 245):

**Before:**
```javascript
const API_URL = 'https://wordle-checker-api.YOUR-SUBDOMAIN.workers.dev/api/check-word';
```

**After:**
```javascript
const API_URL = 'https://wordle-checker-api.YOUR-ACTUAL-SUBDOMAIN.workers.dev/api/check-word';
```

Replace `YOUR-ACTUAL-SUBDOMAIN` with your actual Worker URL from Step 4.

## Step 7: Deploy Frontend

Deploy your updated `index.html` to your hosting platform:

### GitHub Pages:
```bash
git add index.html
git commit -m "Update API URL for Cloudflare Worker"
git push origin main
```

### Or test locally:
```bash
python3 -m http.server 8000
# Visit http://localhost:8000
```

## How It Works

### Architecture

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │ API Request
       │ /api/check-word?word=CIGAR
       ▼
┌──────────────────────────┐
│  Cloudflare Worker       │
│  (Edge Computing)        │
│  - Check word in KV      │
│  - Exclude today's word  │
│  - Return JSON           │
└──────┬───────────────────┘
       │ If cache miss/stale
       ▼
┌──────────────────────────┐
│  wordlehints.co.uk API   │
│  (Source of truth)       │
│  - Fetch all words       │
│  - Update KV cache       │
└──────────────────────────┘
```

### Cron Job (Automatic Updates)

The Worker is configured with a cron trigger in `wrangler.toml`:

```toml
[triggers]
crons = ["0 3 * * *"]
```

This means:
- **Runs daily at 3:00 AM UTC**
- Fetches the latest word list from wordlehints.co.uk
- Updates the KV storage
- Your frontend always has up-to-date data!

### Caching Strategy

1. **On first request**: Worker fetches word list from API → stores in KV
2. **Subsequent requests**: Worker reads from KV (blazing fast!)
3. **Daily at 3 AM**: Cron refreshes the cache automatically
4. **Result caching**: API responses cached with HTTP headers
   - Past words: 24 hours
   - Today's word check: 5 minutes
   - Not found: 1 hour

## Monitoring & Debugging

### View Worker Logs

```bash
wrangler tail
```

This shows real-time logs from your Worker.

### Check KV Contents

```bash
# List all keys in KV
wrangler kv:key list --binding WORDLE_KV

# Get the word list
wrangler kv:key get wordle_solutions --binding WORDLE_KV
```

### View Metrics

Visit the Cloudflare Dashboard:
1. Go to https://dash.cloudflare.com
2. Navigate to "Workers & Pages"
3. Click on "wordle-checker-api"
4. View requests, errors, CPU time, etc.

## Updating the Worker

Made changes to `worker.js`? Just redeploy:

```bash
wrangler deploy
```

The update is instant across Cloudflare's global network!

## Cost

**Cloudflare Workers Free Tier:**
- ✅ 100,000 requests/day
- ✅ 10ms CPU time per request
- ✅ Workers KV: 100,000 reads/day, 1,000 writes/day

For a personal Wordle checker, this is **completely free** and more than enough!

## Troubleshooting

### Error: "KV namespace not found"

Make sure you:
1. Created the KV namespace (`wrangler kv:namespace create WORDLE_KV`)
2. Updated `wrangler.toml` with the correct ID
3. Deployed after updating (`wrangler deploy`)

### Error: "CORS blocked"

The Worker includes CORS headers by default:
```javascript
'Access-Control-Allow-Origin': '*'
```

If still blocked, check that you're calling the correct Worker URL.

### Error: "API returns 500"

Check Worker logs:
```bash
wrangler tail
```

Common causes:
- wordlehints.co.uk API is down (temporary)
- KV binding misconfigured
- Network timeout

### Word list is stale

Manually trigger a refresh:
```bash
# Force a scheduled event (simulates cron)
wrangler dev --test-scheduled
```

Or wait for the next daily cron run at 3 AM UTC.

## Advanced: Custom Domain

Want to use your own domain? (e.g., `api.mywordlechecker.com`)

1. Add your domain to Cloudflare
2. In Workers dashboard → Routes → Add Route
3. Set route: `api.mywordlechecker.com/*`
4. Select your Worker
5. Update `API_URL` in `index.html`

## Support

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/
- **Cloudflare Community**: https://community.cloudflare.com/

## Summary

You now have:
- ✅ Lightweight backend on Cloudflare's global edge network
- ✅ Automatic daily updates of Wordle solutions
- ✅ Fast API responses (KV caching)
- ✅ No loading delay on frontend
- ✅ Always up-to-date word list
- ✅ Completely free (for personal use)

Enjoy your blazing-fast, always-current Wordle checker! 🎉
