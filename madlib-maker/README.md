# Madlib Maker

An interactive web tool for creating and sharing custom madlibs. Create stories with customizable placeholders, share them with friends, and watch the hilarity unfold!

## Features

- **Select-to-Blank Editor**: Write a story, select a word, and pick a type to turn it into a blank
- **Blank Syntax**: `{noun}` is a new blank every time it appears; `{name:hero}` blanks share one answer wherever the name repeats; `{noun|Something squishy?}` asks players a question instead of naming the word type
- **Step-Through Reveal**: The finished story plays back a sentence at a time, with optional read-aloud; tap a word to see what was asked
- **Three Sharing Modes**:
  - **Player Link**: Share a playable version where others fill in the blanks (no editing)
  - **Editor Link**: Share an editable copy so others can customize your madlib
  - **Story Link**: Share a completed story with all answers filled in (view only)
- **URL Shortening**: Optional integration with Cloudflare Workers for short, shareable links
- **Older Links Keep Working**: Pre-2026 links and drafts (a placeholder list plus `{word01}` references) are converted on load
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

1. **Write Your Story**: Type it normally
2. **Blank Out Words**: Select a word and click a type (Noun, Verb, …), or type `{plural noun}` yourself. Use **Reuse** in the Blanks list, or `{name:hero}`, to repeat one answer
3. **Share**: Click "Share with Players" to get a link others can play

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
   - Open `js/url.js`
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
├── index.html              # Page markup; loads the scripts below in order
├── styles.css              # Core styles and shared dialog styles
├── js/
│   ├── core.js             # Shared helpers + MadlibFormat (blank syntax, finish())
│   ├── editor.js           # Story editor, blank toolbar, blanks sidebar
│   ├── metadata.js         # Title/subtitle (+ legacy color-theme cleanup)
│   ├── url.js              # Share links, short links, loading links
│   ├── reveal.js           # Auto-playing sentence-by-sentence reveal
│   ├── player.js           # Prompt flow for filling in a madlib
│   ├── drafts.js           # Auto-save into the madlib library
│   ├── modes.js            # Create / Preview switching
│   ├── main.js             # Start-up; starts optional features
│   └── grammar.js, highlight.js, share.js, suggest.js, print.js,
│       collection.js, library.js   # One file per optional feature
├── css/                    # One stylesheet per optional feature
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

The story text is the single source of truth for blanks; everything else is derived from it. The core modules (one or more per file in `js/`):

1. **MadlibFormat**: Parses blank tokens, migrates old data, splits the story into reveal steps
2. **StoryEditor**: Story textarea; inserts and replaces text through undoable edits
3. **BlankToolbar**: Turns the selected word (or the cursor) into a blank
4. **BlankList**: Sidebar list of blanks with jump, rename, reuse and delete (with undo)
5. **MetadataManager**: Title and subtitle management
6. **ColorThemeManager**: Clears color overrides left by old shares (themes are disabled)
7. **URLManager**: Share links and URL shortening (if enabled)
8. **Reveal**: Sentence-by-sentence story playback and read-aloud
9. **PlayerMode**: Prompt flow for filling in a madlib
10. **ModeManager**: Switches between creator and player views
11. **DraftManager**: Auto-saves into the madlib library; "New madlib" and the My madlibs dialog

Optional features, one file each in `js/` (plus `css/`), started by `main.js` and skipped if missing:

- **MadlibGrammar**: a/an agreement and sentence-start capitals in the finished story
- **MadlibHighlight**: tinted chips behind blanks in the story editor
- **MadlibSuggest**: "Stuck?" dice that fill in a random word for the blank's type
- **MadlibShare**: share panel (phone share sheet or copy) and "Save as image" story cards
- **MadlibPrint**: printable paper worksheet and printable finished story
- **MadlibCollection**: "My stories", every finished story saved in this browser
- **MadlibLibrary**: storage for "My madlibs" (several saved madlibs instead of one draft)

Features talk through `MadlibFormat.finish()` (the finished-story shape) and two document events: `madlib:revealdone` and `madlib:storychange`.

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
