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
const PAGE_SIZE = 50;
const MAX_PAGES = 50;
const MAX_WORDS = PAGE_SIZE * MAX_PAGES;
const KV_KEY = 'wordle_solutions';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

function jsonResponse(body, options = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      ...JSON_HEADERS,
      ...(options.cacheControl ? { 'Cache-Control': options.cacheControl } : {})
    }
  });
}

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
 * Latest puzzle date present in the word list (YYYY-MM-DD).
 * Prefers explicit dates from the API; falls back to the highest game number.
 */
function getLatestDataDate(wordList) {
  let latestDate = '';
  let maxGame = -1;

  for (const entry of Object.values(wordList)) {
    if (!entry) continue;
    if (entry.date && entry.date > latestDate) latestDate = entry.date;
    if (entry.game > maxGame) maxGame = entry.game;
  }

  if (latestDate) return latestDate;

  if (maxGame > 0) {
    const d = new Date(WORDLE_START_DATE);
    d.setUTCDate(d.getUTCDate() + maxGame - 1);
    return d.toISOString().slice(0, 10);
  }

  return null;
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function fetchSourcePage(page) {
  const response = await fetch(`${API_BASE_URL}?page=${page}&per_page=${PAGE_SIZE}`, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Wordle source returned HTTP ${response.status} on page ${page}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Wordle source returned invalid JSON on page ${page}`);
  }

  if (!payload || !Array.isArray(payload.results)) {
    throw new Error(`Wordle source returned an invalid page ${page}`);
  }

  return payload;
}

function validateWordList(wordList, expectedCount = null) {
  if (!wordList || typeof wordList !== 'object' || Array.isArray(wordList)) {
    throw new Error('Word list is not an object');
  }

  const entries = Object.entries(wordList);
  if (entries.length === 0) throw new Error('Word list is empty');
  if (expectedCount !== null && entries.length !== expectedCount) {
    throw new Error(`Word list contains ${entries.length} entries; expected ${expectedCount}`);
  }

  const games = new Map();
  for (const [word, data] of entries) {
    if (!/^[A-Z]{5}$/.test(word) || !data || !Number.isInteger(data.game) || data.game < 0) {
      throw new Error(`Word list contains an invalid entry for ${word}`);
    }
    if (data.date && !isValidIsoDate(data.date)) {
      throw new Error(`Word list contains an invalid date for ${word}`);
    }
    if (games.has(data.game) && games.get(data.game) !== word) {
      throw new Error(`Word list contains conflicting answers for game ${data.game}`);
    }
    games.set(data.game, word);
  }

  return wordList;
}

/**
 * Fetch and validate the complete word list from wordlehints.co.uk.
 *
 * A refresh is all-or-nothing. The old implementation converted failed pages
 * into empty results, then overwrote a good KV cache with a partial list.
 */
async function fetchWordList() {
  const firstPage = await fetchSourcePage(1);
  const total = Number(firstPage.total);

  if (!Number.isInteger(total) || total < 1 || total > MAX_WORDS) {
    throw new Error(`Wordle source reported an unsafe total: ${firstPage.total}`);
  }

  const pageCount = Math.ceil(total / PAGE_SIZE);
  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => fetchSourcePage(index + 2))
  );
  const pages = [firstPage, ...remainingPages];
  const allItems = pages.flatMap(page => page.results);

  if (allItems.length !== total) {
    throw new Error(`Wordle source returned ${allItems.length} results; expected ${total}`);
  }

  const wordMap = new Map();
  for (const item of allItems) {
    const word = typeof item.answer === 'string' ? item.answer.toUpperCase() : '';
    const game = Number(item.game);
    const date = item.date || '';

    if (!/^[A-Z]{5}$/.test(word) || !Number.isInteger(game) || game < 0) {
      throw new Error('Wordle source returned an invalid answer entry');
    }
    if (date && !isValidIsoDate(date)) {
      throw new Error(`Wordle source returned an invalid date for ${word}`);
    }
    const existing = wordMap.get(word);
    if (!existing || game > existing.game || date > existing.date) {
      wordMap.set(word, { game, date });
    }
  }

  const wordList = Object.fromEntries(wordMap);
  validateWordList(wordList);
  console.log(`Fetched and validated ${allItems.length} source rows as ${wordMap.size} unique words across ${pageCount} pages`);
  return wordList;
}

/**
 * Get word list from KV or fetch if not available
 */
async function getWordList(env) {
  try {
    // Try to get from KV first
    const cached = await env.WORDLE_KV.get(KV_KEY, 'json');

    if (cached && Object.keys(cached).length > 0) {
      validateWordList(cached);
      console.log('Using cached word list from KV');
      return cached;
    }

    // If not in KV, fetch and store
    console.log('Fetching fresh word list');
    const wordList = await fetchWordList();

    // Store in KV with metadata
    await storeWordList(env, wordList);

    return wordList;

  } catch (error) {
    console.error('Error getting word list:', error);
    throw error;
  }
}

async function storeWordList(env, wordList) {
  validateWordList(wordList);
  const latestDate = getLatestDataDate(wordList);
  await env.WORDLE_KV.put(KV_KEY, JSON.stringify(wordList), {
    metadata: {
      updatedAt: new Date().toISOString(),
      latestDate,
      wordCount: Object.keys(wordList).length
    }
  });
}

/**
 * Metadata for the cached word list (footer, health dashboards).
 */
async function handleMeta(env) {
  try {
    const wordList = await getWordList(env);
    const { metadata } = await env.WORDLE_KV.getWithMetadata(KV_KEY);
    const latestDate = getLatestDataDate(wordList);

    return jsonResponse({
      latestDate,
      wordCount: Object.keys(wordList).length,
      updatedAt: metadata?.updatedAt ?? null,
      refreshStatus: 'ok'
    }, { cacheControl: 'no-store' });
  } catch (error) {
    console.error('Error building meta:', error);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
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
    return jsonResponse({ error: 'Missing word parameter' }, { status: 400 });
  }

  if (word.length !== 5 || !/^[A-Z]+$/.test(word)) {
    return jsonResponse({ error: 'Word must be 5 letters' }, { status: 400 });
  }

  try {
    // Get word list
    const wordList = await getWordList(env);

    // Check if word exists
    const wordData = wordList[word];

    if (!wordData) {
      return jsonResponse({
        used: false,
        word: word
      }, { cacheControl: 'public, max-age=3600' });
    }

    // Exclude today's solution to avoid spoilers
    const todayGame = getTodayGameNumber();
    const todayDate = new Date().toISOString().slice(0, 10);
    if (wordData.game === todayGame || wordData.date === todayDate) {
      return jsonResponse({
        used: false,
        word: word,
        note: 'Today\'s solution excluded'
      }, { cacheControl: 'public, max-age=300' });
    }

    // Word was used in the past
    return jsonResponse({
      used: true,
      word: word,
      game: wordData.game,
      date: wordData.date
    }, { cacheControl: 'public, max-age=86400' });

  } catch (error) {
    console.error('Error checking word:', error);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Handle scheduled cron trigger to refresh word list
 */
async function handleScheduled(env) {
  try {
    console.log('Cron triggered: Refreshing word list');
    const wordList = await fetchWordList();

    await storeWordList(env, wordList);

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

    if (url.pathname === '/api/meta' && request.method === 'GET') {
      return handleMeta(env);
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return jsonResponse({ status: 'ok' });
    }

    // 404 for other routes
    return jsonResponse({ error: 'Not Found' }, { status: 404 });
  },

  async scheduled(event, env, ctx) {
    await handleScheduled(env);
  }
};

export { fetchWordList, getLatestDataDate, validateWordList };
