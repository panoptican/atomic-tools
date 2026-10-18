// URL Manager Module
const URLManager = (function() {
  // Configuration (leave empty to disable URL shortening and use long hash URLs)
  const SHORTENER_API_URL = 'https://madlib-url-shortener.spidleweb.workers.dev';

  const LINK_ERROR = "Couldn't make the link. Your madlib is saved, so reload the page and try again.";
  const LOAD_ERROR = "Couldn't open this madlib link. It may be incomplete or expired, so ask the sender for a new one.";

  // Toast element
  let toastEl;
  let toastTimeout;
  let toastId = 0;

  function toastButton(className, label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  // Fade the toast out, then empty it so no invisible button stays in the tab order.
  // With an id (from showToast), only hides that toast, not a newer one.
  function hideToast(id) {
    if (!toastEl || (id !== undefined && id !== toastId)) return;
    clearTimeout(toastTimeout);
    toastEl.classList.remove('show');
    toastTimeout = setTimeout(() => {
      toastEl.textContent = '';
    }, 200);
  }

  // Show toast notification, optionally with one action button (e.g. Undo).
  // Plain messages fade after 3s. An error or an action stays until it is used,
  // dismissed or replaced, so nobody loses an Undo or a message to a timer.
  // Returns an id for hideToast.
  function showToast(message, isError = false, action = null) {
    if (!toastEl) return null;
    toastId++;

    clearTimeout(toastTimeout);

    // A modal dialog makes everything outside it inert, so show the toast inside
    // whichever dialog is open (it's position: fixed, so it stays put on screen)
    const host = document.querySelector('dialog[open]') || document.body;
    if (toastEl.parentElement !== host) host.appendChild(toastEl);

    toastEl.textContent = message;
    toastEl.classList.remove('show', 'error');
    toastEl.setAttribute('role', isError ? 'alert' : 'status');
    toastEl.setAttribute('aria-live', isError ? 'assertive' : 'polite');

    if (isError) {
      toastEl.classList.add('error');
    }

    if (action) {
      toastEl.appendChild(toastButton('toast-action', action.label, () => {
        hideToast();
        action.onClick();
      }));
    }

    const persistent = isError || !!action;
    if (persistent) {
      toastEl.appendChild(toastButton('toast-dismiss', 'Dismiss', () => hideToast()));
    }

    // Force reflow for animation
    void toastEl.offsetWidth;

    toastEl.classList.add('show');

    if (!persistent) toastTimeout = setTimeout(() => hideToast(), 3000);
    return toastId;
  }

  // Collect all madlib data
  function collectData() {
    return {
      v: MadlibFormat.VERSION,
      title: MetadataManager.getRawTitle(),
      subtitle: MetadataManager.getSubtitle(),
      story: StoryEditor.getStory()
    };
  }

  // Encode data to URL-safe string
  function encodeData(data) {
    try {
      const json = JSON.stringify(data);
      const compressed = LZString.compressToEncodedURIComponent(json);
      return compressed;
    } catch (e) {
      console.error('Failed to encode data:', e);
      return null;
    }
  }

  // Decode URL-safe string to data
  function decodeData(encoded) {
    try {
      const json = LZString.decompressFromEncodedURIComponent(encoded);
      if (!json) return null;
      return JSON.parse(json);
    } catch (e) {
      console.error('Failed to decode data:', e);
      return null;
    }
  }

  // Generate player URL
  function generatePlayerURL() {
    const data = collectData();
    const encoded = encodeData(data);
    if (!encoded) return null;

    const url = new URL(window.location.href);
    url.hash = `play=${encoded}`;
    return url.toString();
  }

  // Generate editor URL
  function generateEditorURL() {
    const data = collectData();
    const encoded = encodeData(data);
    if (!encoded) return null;

    const url = new URL(window.location.href);
    url.hash = `edit=${encoded}`;
    return url.toString();
  }

  // Generate story URL (with answers)
  // dataWithAnswers: full data object including answers (from PlayerMode)
  async function generateStoryURL(dataWithAnswers) {
    // Try to create short URL first (if shortening is enabled)
    let url = null;
    if (SHORTENER_API_URL) {
      url = await createShortURL('story', dataWithAnswers);
    }

    // Fallback to long URL if shortening failed or is disabled
    if (!url) {
      const encoded = encodeData(dataWithAnswers);
      if (!encoded) return null;
      const longUrl = new URL(window.location.href);
      longUrl.hash = `story=${encoded}`;
      url = longUrl.toString();
    }

    return url;
  }

  // Copy text to clipboard
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return true;
      } catch (e2) {
        document.body.removeChild(textarea);
        return false;
      }
    }
  }

  // Create a shortened URL using the shortener API
  async function createShortURL(mode, data) {
    if (!SHORTENER_API_URL) {
      return null; // Shortening disabled
    }

    try {
      const response = await fetch(`${SHORTENER_API_URL}/shorten`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode, data }),
      });

      if (!response.ok) {
        console.error('Failed to create short URL:', response.statusText);
        return null;
      }

      const result = await response.json();

      // Build the madlib-maker URL with the short code
      const baseUrl = new URL(window.location.href);
      baseUrl.hash = `s=${result.shortCode}`;
      return baseUrl.toString();
    } catch (e) {
      console.error('Error creating short URL:', e);
      return null;
    }
  }

  // Expand a shortened URL to get the madlib data
  async function expandShortURL(shortCode) {
    if (!SHORTENER_API_URL) {
      return null;
    }

    try {
      const response = await fetch(`${SHORTENER_API_URL}/${shortCode}`);

      if (!response.ok) {
        console.error('Failed to expand short URL:', response.statusText);
        return null;
      }

      const result = await response.json();
      return result; // { mode, data }
    } catch (e) {
      console.error('Error expanding short URL:', e);
      return null;
    }
  }

  // Link for players to fill in the current madlib: short when the shortener
  // answers, long otherwise. Shows a toast and returns null if it can't be shared yet.
  async function getPlayerLink() {
    const validation = ModeManager.validate();
    if (!validation.valid) {
      showToast(validation.errors[0].replace('preview', 'share'), true);
      return null;
    }
    const url = (SHORTENER_API_URL && await createShortURL('play', collectData())) || generatePlayerURL();
    if (!url) showToast(LINK_ERROR, true);
    return url;
  }

  // Link that opens an editable copy of the current madlib
  async function getEditorLink() {
    const url = (SHORTENER_API_URL && await createShortURL('edit', collectData())) || generateEditorURL();
    if (!url) showToast(LINK_ERROR, true);
    return url;
  }

  // Load data into the editor
  function loadData(rawData) {
    const data = MadlibFormat.migrate(rawData);
    if (!data) return false;

    try {
      MetadataManager.setTitle(data.title);
      MetadataManager.setSubtitle(data.subtitle);
      StoryEditor.setStory(data.story);
      ColorThemeManager.clear();
      return true;
    } catch (e) {
      console.error('Failed to load data:', e);
      return false;
    }
  }

  // Parse current URL hash
  async function parseHash() {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return null;

    const hashContent = hash.substring(1); // Remove #

    // Check for short URL format: #s=shortCode
    if (hashContent.startsWith('s=')) {
      const shortCode = hashContent.substring(2);
      const expanded = await expandShortURL(shortCode);
      if (expanded) {
        return {
          mode: expanded.mode,
          data: MadlibFormat.migrate(expanded.data),
          isShort: true
        };
      }
      return null; // Failed to expand
    }

    // Standard long hash formats
    const prefixes = { 'play=': 'play', 'edit=': 'edit', 'story=': 'story' };
    for (const prefix in prefixes) {
      if (hashContent.startsWith(prefix)) {
        return {
          mode: prefixes[prefix],
          data: MadlibFormat.migrate(decodeData(hashContent.substring(prefix.length)))
        };
      }
    }

    return null;
  }

  // Handle URL on page load
  async function handleURLOnLoad() {
    const parsed = await parseHash();

    if (!parsed) {
      // No hash or invalid format - stay in creator mode
      return { mode: 'creator', loaded: false };
    }

    if (!parsed.data) {
      // Hash present but couldn't decode - show error
      showToast(LOAD_ERROR, true);
      return { mode: 'creator', loaded: false, error: true };
    }

    // Load the data
    const success = loadData(parsed.data);

    if (!success) {
      showToast(LOAD_ERROR, true);
      return { mode: 'creator', loaded: false, error: true };
    }

    return {
      mode: parsed.mode,
      loaded: true,
      data: parsed.data
    };
  }

  // Initialize
  async function init() {
    toastEl = document.getElementById('toast');

    // Handle URL on load
    const result = await handleURLOnLoad();

    // Return mode info for potential use by other modules
    return result;
  }

  // Public API
  return {
    init,
    generatePlayerURL,
    generateEditorURL,
    generateStoryURL,
    getPlayerLink,
    getEditorLink,
    collectData,
    copyToClipboard,
    loadData,
    parseHash,
    showToast,
    hideToast
  };
})();
