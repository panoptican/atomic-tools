/**
 * Madlib Maker URL Shortening Service
 *
 * Cloudflare Worker that provides URL shortening for madlib share links.
 * Stores madlib data in KV storage and returns short codes.
 */

// CORS headers for allowing frontend access
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Generate a random short code (6 characters, alphanumeric)
 */
function generateShortCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Handle POST request to create a shortened URL
 */
async function handleShorten(request, env) {
  try {
    const body = await request.json();
    const { mode, data } = body;

    // Validate input
    if (!mode || !data || (mode !== 'play' && mode !== 'edit')) {
      return new Response(JSON.stringify({
        error: 'Invalid request. Required: mode (play|edit) and data object'
      }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Generate a unique short code (with collision handling)
    let shortCode;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      shortCode = generateShortCode();
      const existing = await env.MADLIB_URLS.get(shortCode);
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      return new Response(JSON.stringify({
        error: 'Failed to generate unique short code. Please try again.'
      }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Store the madlib data with metadata
    const record = {
      mode,
      data,
      created: new Date().toISOString(),
    };

    // Store in KV with 1 year expiration (31536000 seconds)
    await env.MADLIB_URLS.put(shortCode, JSON.stringify(record), {
      expirationTtl: 31536000,
    });

    return new Response(JSON.stringify({
      shortCode,
      url: `${new URL(request.url).origin}/${shortCode}`,
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to process request',
      message: error.message,
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle GET request to expand a shortened URL
 */
async function handleExpand(shortCode, env) {
  try {
    const record = await env.MADLIB_URLS.get(shortCode);

    if (!record) {
      return new Response(JSON.stringify({
        error: 'Short code not found'
      }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const { mode, data } = JSON.parse(record);

    return new Response(JSON.stringify({
      mode,
      data,
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to expand short code',
      message: error.message,
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // POST /shorten - Create a shortened URL
    if (request.method === 'POST' && path === '/shorten') {
      return handleShorten(request, env);
    }

    // GET /:shortCode - Expand a shortened URL
    if (request.method === 'GET' && path.length > 1) {
      const shortCode = path.substring(1); // Remove leading slash
      return handleExpand(shortCode, env);
    }

    // Default: API info
    return new Response(JSON.stringify({
      service: 'Madlib Maker URL Shortener',
      endpoints: {
        'POST /shorten': 'Create shortened URL (body: {mode: "play"|"edit", data: {...}})',
        'GET /:shortCode': 'Expand shortened URL',
      },
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  },
};
