# Wordle Solution Checker

A web application to check if a word has ever been a Wordle solution.

## Features

- Check any 5-letter word against past Wordle answers
- Visual tile preview with Wordle-style color coding
- Offline-capable with built-in word list (550+ solutions)
- Attempts to fetch latest solutions from wordlehints.co.uk API
- Clean, Wordle-themed interface

## Deployment

This site is ready to deploy on GitHub Pages:

1. Go to your repository Settings
2. Navigate to Pages (under "Code and automation")
3. Under "Build and deployment":
   - Source: Deploy from a branch
   - Branch: Select your branch (e.g., `main`) and `/ (root)`
4. Click Save

Your site will be available at: `https://<username>.github.io/wordle-checker/`

## Local Development

Simply open `index.html` in a web browser, or run a local server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`

## Testing

Run the included test scripts to verify functionality:

```bash
node test-checker.js
node analyze-wordlist.js
```