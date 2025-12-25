# Madlib Maker URL Shortener - Cloudflare Deployment Guide

This guide covers deploying the URL shortening service for Madlib Maker to Cloudflare Workers.

## Prerequisites

- Node.js and npm installed
- Cloudflare account (free tier works)
- Wrangler CLI (`npm install -g wrangler`)

## Setup Steps

### 1. Install Dependencies

```bash
cd madlib-maker
npm install
```

### 2. Login to Cloudflare

```bash
wrangler login
```

This opens a browser for authentication.

### 3. Create KV Namespace

Create the KV namespace for storing shortened URLs:

```bash
wrangler kv:namespace create "MADLIB_URLS"
```

This outputs something like:
```
{ binding = "MADLIB_URLS", id = "abc123..." }
```

Copy the `id` value.

### 4. Update wrangler.toml

Replace `YOUR_KV_NAMESPACE_ID` in `wrangler.toml` with the actual namespace ID from step 3:

```toml
[[kv_namespaces]]
binding = "MADLIB_URLS"
id = "abc123..."  # Your actual namespace ID
```

### 5. Test Locally (Optional)

```bash
npm run dev
```

Visit http://localhost:8787 to test the worker locally.

### 6. Deploy to Cloudflare

```bash
npm run deploy
```

This deploys the worker and outputs the production URL, e.g.:
```
https://madlib-url-shortener.YOUR-SUBDOMAIN.workers.dev
```

### 7. Update Frontend Configuration

Copy the worker URL from deployment and update `script.js` in the madlib-maker:

Find the `SHORTENER_API_URL` constant and update it with your worker URL:

```javascript
const SHORTENER_API_URL = 'https://madlib-url-shortener.YOUR-SUBDOMAIN.workers.dev';
```

## Testing the API

### Create a shortened URL:

```bash
curl -X POST https://madlib-url-shortener.YOUR-SUBDOMAIN.workers.dev/shorten \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "play",
    "data": {
      "title": "Test Madlib",
      "subtitle": "A test story",
      "placeholders": [],
      "story": "Once upon a time..."
    }
  }'
```

Response:
```json
{
  "shortCode": "aB3xY9",
  "url": "https://madlib-url-shortener.YOUR-SUBDOMAIN.workers.dev/aB3xY9"
}
```

### Expand a shortened URL:

```bash
curl https://madlib-url-shortener.YOUR-SUBDOMAIN.workers.dev/aB3xY9
```

Response:
```json
{
  "mode": "play",
  "data": {
    "title": "Test Madlib",
    "subtitle": "A test story",
    "placeholders": [],
    "story": "Once upon a time..."
  }
}
```

## Features

- **Short Codes**: 6-character alphanumeric codes (62^6 = ~56 billion combinations)
- **Collision Handling**: Automatically retries if a code already exists
- **Expiration**: URLs expire after 1 year
- **CORS Enabled**: Frontend can access from any domain
- **Two Modes**: Supports both `play` and `edit` modes

## Troubleshooting

### KV Namespace Errors

If you see KV-related errors:
1. Verify the namespace ID in `wrangler.toml` matches the created namespace
2. Ensure you're logged into the correct Cloudflare account
3. Try recreating the namespace: `wrangler kv:namespace delete --namespace-id=OLD_ID` then create a new one

### CORS Errors

The worker includes CORS headers. If you still see CORS errors:
1. Check browser console for specific error messages
2. Verify the worker is deployed and accessible
3. Ensure the frontend is using the correct worker URL

### Deployment Failures

If deployment fails:
1. Check your Cloudflare account is in good standing
2. Verify you have the latest version of Wrangler: `npm install -g wrangler@latest`
3. Try `wrangler logout` then `wrangler login` to refresh auth

## Cost

Cloudflare Workers free tier includes:
- 100,000 requests/day
- 10ms CPU time per request
- KV: 100,000 reads/day, 1,000 writes/day

For a URL shortener, this is typically more than sufficient. The free tier should easily handle thousands of madlib shares per day.

## Security Notes

- No authentication required (public service)
- URLs expire after 1 year
- No rate limiting (relying on Cloudflare's DDoS protection)
- Consider adding rate limiting if abuse becomes an issue
