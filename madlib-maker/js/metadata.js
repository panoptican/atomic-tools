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
  let subtitleField;
  let addSubtitleBtn;

  // The subtitle input hides behind "Add subtitle" until it has a value
  function showSubtitleField(visible) {
    subtitleField.hidden = !visible;
    addSubtitleBtn.hidden = visible;
  }

  // Grow the title textarea to fit its wrapped lines
  function fitTitleHeight() {
    titleInput.style.height = 'auto';
    titleInput.style.height = `${titleInput.scrollHeight}px`;
  }

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
      fitTitleHeight();
      updatePageTitle();
    }
  }

  // Set subtitle (for loading from URL/storage)
  function setSubtitle(text) {
    subtitle = text || '';
    if (subtitleInput) {
      subtitleInput.value = subtitle;
      showSubtitleField(Boolean(subtitle));
    }
  }

  // Initialize
  function init() {
    titleInput = document.getElementById('madlib-title');
    subtitleInput = document.getElementById('madlib-subtitle');
    subtitleField = document.getElementById('subtitle-field');
    addSubtitleBtn = document.getElementById('add-subtitle-btn');

    // Sync state on input. The title is a textarea only so it can wrap:
    // keep it one paragraph by dropping line breaks (typed or pasted).
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') e.preventDefault();
    });
    titleInput.addEventListener('input', () => {
      if (/[\r\n]/.test(titleInput.value)) {
        titleInput.value = titleInput.value.replace(/[\r\n]+/g, ' ');
      }
      fitTitleHeight();
      syncFromInputs();
    });
    // Re-fit when the card's width changes or the display font arrives
    let lastWidth = 0;
    new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width !== lastWidth) {
        lastWidth = width;
        fitTitleHeight();
      }
    }).observe(titleInput);
    if (document.fonts) document.fonts.ready.then(fitTitleHeight);
    subtitleInput.addEventListener('input', syncFromInputs);

    addSubtitleBtn.addEventListener('click', () => {
      showSubtitleField(true);
      subtitleInput.focus();
    });
    // Leaving it empty folds it back into the link
    subtitleInput.addEventListener('blur', () => {
      if (!subtitleInput.value.trim()) showSubtitleField(false);
    });

    // Initial sync
    syncFromInputs();
    fitTitleHeight();
    showSubtitleField(Boolean(subtitle));
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
