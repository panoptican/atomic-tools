# Madlib Maker

An interactive web tool for creating and sharing custom madlibs. Create stories with customizable placeholders, share them with friends, and watch the hilarity unfold!

## Features

- **Interactive Story Editor**: Create stories with custom placeholders using simple `{id}` syntax
- **Multiple Placeholder Types**: Use preset types (noun, verb, adjective, etc.) or create your own
- **Color Themes**: Customize the look with built-in themes or create custom color schemes
- **Three Sharing Modes**:
  - **Player Link**: Share a playable version where others fill in the blanks (no editing)
  - **Editor Link**: Share an editable copy so others can customize your madlib
  - **Story Link**: Share a completed story with all answers filled in (view only)
- **URL Shortening**: Optional integration with Cloudflare Workers for short, shareable links
- **Auto-save Drafts**: Never lose your work with automatic local storage backup
- **Player Mode**: Clean, focused interface for playing madlibs

## Getting Started

### Local Development

1. Clone the repository
2. Serve the directory with any HTTP server:
   ```bash
   python3 -m http.server 8080
   ```
3. Visit http://localhost:8080/madlib-maker/

### Basic Usage

1. **Create Placeholders**: Click preset buttons (noun, verb, etc.) or add custom ones
2. **Write Your Story**: Use `{id}` syntax to reference placeholders (e.g., `{word01}`)
3. **Customize Theme**: Optional - choose a color theme or create your own
4. **Share**: Click "Share with Players" to get a link others can play

## URL Shortening (Optional)

The madlib-maker includes optional URL shortening to make share links shorter and more user-friendly.

### Without URL Shortening

Share links use URL hash encoding:
```
https://your-site.com/madlib-maker/#play=N4IgdghgtgpiBcIA...
```

These work perfectly but can be very long for complex madlibs.

### With URL Shortening

Short links use a 6-character code:
```
https://your-site.com/madlib-maker/#s=aB3xY9
```

### Setting Up URL Shortening

1. **Deploy the Cloudflare Worker**:
   ```bash
   cd madlib-maker
   npm install
   wrangler login
   wrangler kv:namespace create "MADLIB_URLS"
   ```

2. **Update Configuration**:
   - Copy the KV namespace ID to `wrangler.toml`
   - Deploy: `npm run deploy`
   - Copy the worker URL

3. **Enable in Frontend**:
   - Open `script.js`
   - Find `SHORTENER_API_URL` (around line 763)
   - Add your worker URL:
     ```javascript
     const SHORTENER_API_URL = 'https://madlib-url-shortener.your-subdomain.workers.dev';
     ```

4. **Test**: Create a madlib and click "Share with Players" - you should get a short URL!

See [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md) for detailed deployment instructions.

### Features of URL Shortening

- **Automatic Fallback**: If shortening fails, falls back to long hash URLs
- **6-Character Codes**: Short, memorable URLs (62^6 combinations)
- **1-Year Expiration**: Shortened URLs expire after 1 year
- **Free Tier**: Cloudflare Workers free tier easily handles thousands of shares/day
- **Backward Compatible**: Old long hash URLs continue to work

## File Structure

```
madlib-maker/
├── index.html              # Main HTML structure
├── script.js               # Application logic (7 modular components)
├── styles.css              # Styling and themes
├── README.md               # This file
├── CLOUDFLARE_DEPLOYMENT.md # URL shortener deployment guide
├── worker.js               # Cloudflare Worker for URL shortening
├── wrangler.toml           # Worker configuration
└── package.json            # Dependencies
```

## How It Works

### URL Encoding

The madlib-maker uses two URL formats:

1. **Long Hash Format** (default):
   - Data compressed using LZ-String algorithm
   - Encoded in URL hash: `#play=...` or `#edit=...`
   - Works without any backend

2. **Short Code Format** (with URL shortener):
   - Data stored in Cloudflare KV storage
   - Hash contains only short code: `#s=aB3xY9`
   - Fetches data from worker API on page load

### Share Modes

- **Play Mode** (`#play=` or `#s=code`): Player-only interface with no editing
- **Edit Mode** (`#edit=` or `#s=code`): Full creator interface for customization
- **Story Mode** (`#story=` or `#s=code`): View-only mode showing a completed story with all answers

## Architecture

The application uses a modular architecture with 7 main components:

1. **WordListManager**: Manages placeholder creation and deletion
2. **StoryEditor**: Story text editing with live placeholder highlighting
3. **MetadataManager**: Title and subtitle management
4. **ColorThemeManager**: Theme selection and customization
5. **URLManager**: Share links and URL shortening (if enabled)
6. **PlayerMode**: Playing interface for filled-in stories
7. **ModeManager**: Switches between creator and player views
8. **DraftManager**: Auto-save and restore from local storage

## Browser Compatibility

- Modern browsers with ES6+ support
- Clipboard API for easy link copying (with fallback)
- Local Storage for draft auto-save
- Tested on Chrome, Firefox, Safari, Edge

## Privacy

- All data stored client-side in browser Local Storage
- No tracking or analytics
- URL shortening (if enabled) stores only:
  - Madlib data (title, placeholders, story, theme)
  - Creation timestamp
  - 1-year expiration

## License

MIT
