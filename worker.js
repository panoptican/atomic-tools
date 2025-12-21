/**
 * Cloudflare Worker for Wordle Checker
 *
 * Features:
 * - Fetches and caches Wordle solutions from wordlehints.co.uk API
 * - Stores in KV for persistence
 * - Daily cron refresh
 * - API endpoint: /api/check-word?word=xxxxx
 * - Excludes today's solution to avoid spoilers
 */

// Constants
const WORDLE_START_DATE = new Date('2021-06-19'); // Wordle #1 launch date
const API_BASE_URL = 'https://wordlehints.co.uk/wp-json/wordlehint/v1/answers';
const MAX_PAGES = 40; // Fetch up to 40 pages (2000 words)
const KV_KEY = 'wordle_solutions';

/**
 * Calculate today's Wordle game number
 */
function getTodayGameNumber() {
  const today = new Date();
  const diffTime = today - WORDLE_START_DATE;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

/**
 * Fetch word list from wordlehints.co.uk API
 */
async function fetchWordList() {
  const wordMap = new Map();

  try {
    // Fetch multiple pages in parallel
    const pagePromises = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      pagePromises.push(
        fetch(`${API_BASE_URL}?page=${page}&per_page=50`)
          .then(res => res.ok ? res.json() : [])
          .catch(() => [])
      );
    }

    const results = await Promise.all(pagePromises);

    // Process all results
    for (const words of results) {
      if (!Array.isArray(words)) continue;

      for (const item of words) {
        if (item.answer && item.game) {
          const word = item.answer.toUpperCase();
          wordMap.set(word, {
            game: parseInt(item.game),
            date: item.date || ''
          });
        }
      }
    }

    console.log(`Fetched ${wordMap.size} unique words`);
    return Object.fromEntries(wordMap);

  } catch (error) {
    console.error('Error fetching word list:', error);
    throw error;
  }
}

/**
 * Get word list from KV or fetch if not available
 */
async function getWordList(env) {
  try {
    // Try to get from KV first
    const cached = await env.WORDLE_KV.get(KV_KEY, 'json');

    if (cached && Object.keys(cached).length > 0) {
      console.log('Using cached word list from KV');
      return cached;
    }

    // If not in KV, fetch and store
    console.log('Fetching fresh word list');
    const wordList = await fetchWordList();

    // Store in KV with metadata
    await env.WORDLE_KV.put(KV_KEY, JSON.stringify(wordList), {
      metadata: {
        updatedAt: new Date().toISOString(),
        wordCount: Object.keys(wordList).length
      }
    });

    return wordList;

  } catch (error) {
    console.error('Error getting word list:', error);
    throw error;
  }
}

/**
 * Handle API request to check a word
 */
async function handleCheckWord(request, env) {
  const url = new URL(request.url);
  const word = url.searchParams.get('word')?.toUpperCase();

  // Validate input
  if (!word) {
    return new Response(JSON.stringify({ error: 'Missing word parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (word.length !== 5 || !/^[A-Z]+$/.test(word)) {
    return new Response(JSON.stringify({ error: 'Word must be 5 letters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get word list
    const wordList = await getWordList(env);

    // Check if word exists
    const wordData = wordList[word];

    if (!wordData) {
      return new Response(JSON.stringify({
        used: false,
        word: word
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
      });
    }

    // Exclude today's solution to avoid spoilers
    const todayGame = getTodayGameNumber();
    if (wordData.game === todayGame) {
      return new Response(JSON.stringify({
        used: false,
        word: word,
        note: 'Today\'s solution excluded'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300' // Cache for 5 minutes (today changes)
        }
      });
    }

    // Word was used in the past
    return new Response(JSON.stringify({
      used: true,
      word: word,
      game: wordData.game,
      date: wordData.date
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
      }
    });

  } catch (error) {
    console.error('Error checking word:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle scheduled cron trigger to refresh word list
 */
async function handleScheduled(env) {
  try {
    console.log('Cron triggered: Refreshing word list');
    const wordList = await fetchWordList();

    await env.WORDLE_KV.put(KV_KEY, JSON.stringify(wordList), {
      metadata: {
        updatedAt: new Date().toISOString(),
        wordCount: Object.keys(wordList).length
      }
    });

    console.log(`Word list updated: ${Object.keys(wordList).length} words`);
  } catch (error) {
    console.error('Error in scheduled refresh:', error);
  }
}

/**
 * Handle CORS preflight requests
 */
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/**
 * Main worker entry point
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // Route to check-word endpoint
    if (url.pathname === '/api/check-word' && request.method === 'GET') {
      return handleCheckWord(request, env);
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 404 for other routes
    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    await handleScheduled(env);
  }
};
