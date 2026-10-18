// Metadata Manager Module
const MetadataManager = (function() {
  // Defaults
  const DEFAULT_TITLE = 'Untitled madlib';
  const DEFAULT_SUBTITLE = '';

  // State
  let title = '';
  let subtitle = '';

  // DOM Elements
  let titleInput;
  let subtitleInput;

  // Update internal state from inputs
  function syncFromInputs() {
    title = titleInput.value;
    subtitle = subtitleInput.value;
    updatePageTitle();
    // Trigger auto-save
    if (typeof DraftManager !== 'undefined') {
      DraftManager.save();
    }
  }

  // Update browser tab title
  function updatePageTitle() {
    const displayTitle = title.trim() || DEFAULT_TITLE;
    document.title = `${displayTitle} — Madlib Maker`;
  }

  // Get title (returns default if empty)
  function getTitle() {
    return title.trim() || DEFAULT_TITLE;
  }

  // Get raw title (may be empty)
  function getRawTitle() {
    return title;
  }

  // Get subtitle (returns empty string if not set)
  function getSubtitle() {
    return subtitle.trim();
  }

  // Set title (for loading from URL/storage)
  function setTitle(text) {
    title = text || '';
    if (titleInput) {
      titleInput.value = title;
      updatePageTitle();
    }
  }

  // Set subtitle (for loading from URL/storage)
  function setSubtitle(text) {
    subtitle = text || '';
    if (subtitleInput) {
      subtitleInput.value = subtitle;
    }
  }

  // Initialize
  function init() {
    titleInput = document.getElementById('madlib-title');
    subtitleInput = document.getElementById('madlib-subtitle');

    // Sync state on input
    titleInput.addEventListener('input', syncFromInputs);
    subtitleInput.addEventListener('input', syncFromInputs);

    // Initial sync
    syncFromInputs();
  }

  // Public API
  return {
    init,
    getTitle,
    getRawTitle,
    getSubtitle,
    setTitle,
    setSubtitle,
    DEFAULT_TITLE
  };
})();

// Player color themes are disabled; clear any legacy inline overrides from old shares.
const ColorThemeManager = (function() {
  const COLOR_KEYS = ['background', 'text', 'button', 'highlight'];

  function clearOverrides() {
    const root = document.documentElement;
    COLOR_KEYS.forEach((key) => root.style.removeProperty(`--color-${key}`));
  }

  function init() {
    clearOverrides();
  }

  function setTheme() {
    clearOverrides();
  }

  function getTheme() {
    return null;
  }

  function isDefaultTheme() {
    return true;
  }

  return { init, getTheme, setTheme, isDefaultTheme, clear: clearOverrides, PRESETS: {} };
})();
