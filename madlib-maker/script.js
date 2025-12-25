// Word List Management Module
const WordListManager = (function() {
  // State
  let placeholders = [];
  let nextId = 1;
  let pendingDeleteId = null;

  // DOM Elements
  const wordListEl = document.getElementById('word-list');
  const emptyStateEl = document.getElementById('empty-state');
  const customInput = document.getElementById('custom-label-input');
  const addCustomBtn = document.getElementById('add-custom-btn');
  const presetBtns = document.querySelectorAll('.preset-btn');

  // Confirmation dialog elements
  let confirmOverlay;
  let confirmMessage;
  let confirmUsage;
  let confirmCancelBtn;
  let confirmDeleteBtn;

  // Generate stable ID
  function generateId() {
    const id = `word${String(nextId).padStart(2, '0')}`;
    nextId++;
    return id;
  }

  // Add a new placeholder
  function addPlaceholder(label) {
    if (!label || !label.trim()) return;

    const placeholder = {
      id: generateId(),
      label: label.trim()
    };

    placeholders.push(placeholder);
    render();
    // Check for orphaned references after adding
    if (typeof StoryEditor !== 'undefined' && StoryEditor.checkOrphanedReferences) {
      StoryEditor.checkOrphanedReferences();
    }
    // Trigger auto-save
    if (typeof DraftManager !== 'undefined') {
      DraftManager.save();
    }
  }

  // Delete a placeholder by ID (internal, no confirmation)
  function doDeletePlaceholder(id) {
    placeholders = placeholders.filter(p => p.id !== id);
    render();
    // Check for orphaned references after deleting
    if (typeof StoryEditor !== 'undefined' && StoryEditor.checkOrphanedReferences) {
      StoryEditor.checkOrphanedReferences();
    }
    // Trigger auto-save
    if (typeof DraftManager !== 'undefined') {
      DraftManager.save();
    }
  }

  // Show confirmation dialog
  function showConfirmDialog(id, usageCount, label) {
    pendingDeleteId = id;
    confirmMessage.textContent = `The placeholder {${id}} is used in your story.`;
    confirmUsage.innerHTML = `Used <strong>${usageCount}</strong> time${usageCount !== 1 ? 's' : ''} as "<strong>${label}</strong>"`;
    confirmOverlay.classList.add('show');
  }

  // Hide confirmation dialog
  function hideConfirmDialog() {
    confirmOverlay.classList.remove('show');
    pendingDeleteId = null;
  }

  // Request to delete a placeholder (with confirmation if in use)
  function deletePlaceholder(id) {
    // Check if placeholder is used in story
    const usageCount = StoryEditor.countPlaceholderUsage(id);

    if (usageCount > 0) {
      // Find the label for this placeholder
      const placeholder = placeholders.find(p => p.id === id);
      const label = placeholder ? placeholder.label : id;
      showConfirmDialog(id, usageCount, label);
    } else {
      // Not used, delete immediately
      doDeletePlaceholder(id);
    }
  }

  // Handle confirm delete
  function handleConfirmDelete() {
    if (pendingDeleteId) {
      doDeletePlaceholder(pendingDeleteId);
    }
    hideConfirmDialog();
  }

  // Handle cancel delete
  function handleCancelDelete() {
    hideConfirmDialog();
  }

  // Render the placeholder list
  function render() {
    // Clear existing items (except empty state)
    const items = wordListEl.querySelectorAll('.word-item');
    items.forEach(item => item.remove());

    // Show/hide empty state
    if (placeholders.length === 0) {
      emptyStateEl.style.display = 'block';
    } else {
      emptyStateEl.style.display = 'none';

      // Render each placeholder
      placeholders.forEach(placeholder => {
        const itemEl = document.createElement('div');
        itemEl.className = 'word-item';
        itemEl.innerHTML = `
          <div class="word-info">
            <span class="word-id" data-id="${placeholder.id}">{${placeholder.id}}</span>
            <span class="word-label">${escapeHtml(placeholder.label)}</span>
          </div>
          <button type="button" class="delete-btn" data-id="${placeholder.id}">Delete</button>
        `;
        wordListEl.appendChild(itemEl);
      });
    }
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Event: Add custom placeholder
  function handleAddCustom() {
    const label = customInput.value;
    if (label.trim()) {
      addPlaceholder(label);
      customInput.value = '';
      customInput.focus();
    }
  }

  // Event: Preset button click
  function handlePresetClick(e) {
    const type = e.target.dataset.type;
    if (type) {
      addPlaceholder(type);
    }
  }

  // Event: Delete button click (delegated)
  function handleDeleteClick(e) {
    if (e.target.classList.contains('delete-btn')) {
      const id = e.target.dataset.id;
      deletePlaceholder(id);
    }
  }

  // Event: Insert chip click (delegated)
  function handleInsertClick(e) {
    if (e.target.classList.contains('word-id')) {
      const id = e.target.dataset.id;
      if (id) {
        StoryEditor.insertAtCursor(`{${id}}`);
      }
    }
  }

  // Initialize
  function init() {
    // Get confirmation dialog elements
    confirmOverlay = document.getElementById('confirm-dialog-overlay');
    confirmMessage = document.getElementById('confirm-dialog-message');
    confirmUsage = document.getElementById('confirm-dialog-usage');
    confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    confirmDeleteBtn = document.getElementById('confirm-delete-btn');

    // Preset button listeners
    presetBtns.forEach(btn => {
      btn.addEventListener('click', handlePresetClick);
    });

    // Custom add button listener
    addCustomBtn.addEventListener('click', handleAddCustom);

    // Enter key in custom input
    customInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleAddCustom();
      }
    });

    // Delegated delete listener
    wordListEl.addEventListener('click', handleDeleteClick);

    // Delegated insert listener
    wordListEl.addEventListener('click', handleInsertClick);

    // Confirmation dialog listeners
    confirmCancelBtn.addEventListener('click', handleCancelDelete);
    confirmDeleteBtn.addEventListener('click', handleConfirmDelete);

    // Close dialog on overlay click
    confirmOverlay.addEventListener('click', (e) => {
      if (e.target === confirmOverlay) {
        hideConfirmDialog();
      }
    });

    // Initial render
    render();
  }

  // Set placeholders (for loading from URL)
  function setPlaceholders(newPlaceholders) {
    if (!Array.isArray(newPlaceholders)) return;

    placeholders = newPlaceholders.map(p => ({
      id: p.id,
      label: p.label
    }));

    // Update nextId to be higher than any loaded ID
    const maxNum = placeholders.reduce((max, p) => {
      const match = p.id.match(/^word(\d+)$/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    nextId = maxNum + 1;

    render();
    // Check for orphaned references after loading
    if (typeof StoryEditor !== 'undefined' && StoryEditor.checkOrphanedReferences) {
      StoryEditor.checkOrphanedReferences();
    }
  }

  // Public API
  return {
    init,
    getPlaceholders: () => [...placeholders],
    addPlaceholder,
    deletePlaceholder,
    setPlaceholders
  };
})();

// Story Editor Module
const StoryEditor = (function() {
  // State
  let storyText = '';
  let lastCursorPos = null; // Track last known cursor position

  // DOM Elements
  let textareaEl;
  let orphanWarningEl;
  let orphanListEl;

  // Update internal state from textarea
  function syncFromTextarea() {
    storyText = textareaEl.value;
    checkOrphanedReferences();
    // Trigger auto-save
    if (typeof DraftManager !== 'undefined') {
      DraftManager.save();
    }
  }

  // Find all placeholder references in the story
  function findReferencesInStory() {
    const regex = /\{(word\d+)\}/g;
    const references = [];
    let match;
    while ((match = regex.exec(storyText)) !== null) {
      references.push(match[1]);
    }
    return [...new Set(references)]; // Unique references
  }

  // Count occurrences of a specific placeholder in story
  function countPlaceholderUsage(placeholderId) {
    const regex = new RegExp(`\\{${placeholderId}\\}`, 'g');
    const matches = storyText.match(regex);
    return matches ? matches.length : 0;
  }

  // Check for orphaned references and update warning
  function checkOrphanedReferences() {
    if (!orphanWarningEl || !orphanListEl) return;

    const references = findReferencesInStory();
    const placeholders = WordListManager.getPlaceholders();
    const placeholderIds = placeholders.map(p => p.id);

    // Find orphaned references (in story but not in placeholder list)
    const orphaned = references.filter(ref => !placeholderIds.includes(ref));

    if (orphaned.length > 0) {
      orphanListEl.innerHTML = orphaned
        .map(id => `<span class="orphan-tag">{${id}}</span>`)
        .join('');
      orphanWarningEl.classList.add('show');
    } else {
      orphanWarningEl.classList.remove('show');
    }
  }

  // Track cursor position
  function saveCursorPosition() {
    if (textareaEl) {
      lastCursorPos = {
        start: textareaEl.selectionStart,
        end: textareaEl.selectionEnd
      };
    }
  }

  // Get the current story text
  function getStory() {
    return storyText;
  }

  // Set the story text (for loading from URL/storage)
  function setStory(text) {
    storyText = text || '';
    if (textareaEl) {
      textareaEl.value = storyText;
    }
  }

  // Get textarea element (for cursor position in future tickets)
  function getTextarea() {
    return textareaEl;
  }

  // Insert text at cursor position, or append if no cursor
  function insertAtCursor(text) {
    if (!textareaEl) return;

    const currentValue = textareaEl.value;

    // Use last known cursor position, or append if none
    if (lastCursorPos !== null) {
      const start = lastCursorPos.start;
      const end = lastCursorPos.end;
      // Insert at cursor position (replacing any selection)
      textareaEl.value = currentValue.substring(0, start) + text + currentValue.substring(end);
      // Move cursor to after inserted text
      const newCursorPos = start + text.length;
      textareaEl.focus();
      textareaEl.selectionStart = newCursorPos;
      textareaEl.selectionEnd = newCursorPos;
      // Update tracked position
      lastCursorPos = { start: newCursorPos, end: newCursorPos };
    } else {
      // Append to end (no cursor position ever set)
      textareaEl.value = currentValue + text;
      textareaEl.focus();
      // Move cursor to end
      const endPos = textareaEl.value.length;
      textareaEl.selectionStart = endPos;
      textareaEl.selectionEnd = endPos;
      lastCursorPos = { start: endPos, end: endPos };
    }

    // Sync internal state
    syncFromTextarea();
  }

  // Initialize
  function init() {
    textareaEl = document.getElementById('story-editor');
    orphanWarningEl = document.getElementById('orphan-warning');
    orphanListEl = document.getElementById('orphan-list');

    // Sync state on input
    textareaEl.addEventListener('input', syncFromTextarea);

    // Track cursor position on various events
    textareaEl.addEventListener('blur', saveCursorPosition);
    textareaEl.addEventListener('keyup', saveCursorPosition);
    textareaEl.addEventListener('click', saveCursorPosition);
    textareaEl.addEventListener('input', saveCursorPosition);

    // Initial sync
    syncFromTextarea();
  }

  // Public API
  return {
    init,
    getStory,
    setStory,
    getTextarea,
    insertAtCursor,
    countPlaceholderUsage,
    checkOrphanedReferences
  };
})();

// Metadata Manager Module
const MetadataManager = (function() {
  // Defaults
  const DEFAULT_TITLE = 'Untitled Madlib';
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
    document.title = `${displayTitle} — Madlib Creator`;
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

// Color Theme Manager Module
const ColorThemeManager = (function() {
  // Theme presets
  const PRESETS = {
    brick: {
      background: '#1c0001',
      text: '#ddd5ba',
      button: '#831a19',
      highlight: '#eeb440'
    },
    ocean: {
      background: '#0a1929',
      text: '#b8d4e3',
      button: '#1a4f6e',
      highlight: '#4fc3f7'
    },
    forest: {
      background: '#0d1f12',
      text: '#c5d4b8',
      button: '#2d5a3d',
      highlight: '#f0b429'
    },
    midnight: {
      background: '#0f0a1a',
      text: '#d4c5e8',
      button: '#4a1a6b',
      highlight: '#bb86fc'
    }
  };

  // Current theme state
  let currentTheme = { ...PRESETS.brick };
  let activePreset = 'brick';

  // DOM Elements
  let colorInputs = {};
  let hexDisplays = {};
  let previewSwatches = {};
  let presetButtons;
  let resetBtn;

  // Apply theme to CSS custom properties
  function applyTheme() {
    const root = document.documentElement;
    root.style.setProperty('--color-background', currentTheme.background);
    root.style.setProperty('--color-text', currentTheme.text);
    root.style.setProperty('--color-button', currentTheme.button);
    root.style.setProperty('--color-highlight', currentTheme.highlight);

    // Update preview swatches
    updatePreviewSwatches();

    // Update color inputs and hex displays
    updateColorInputs();
  }

  // Update preview swatches
  function updatePreviewSwatches() {
    if (previewSwatches.background) {
      previewSwatches.background.style.background = currentTheme.background;
    }
    if (previewSwatches.text) {
      previewSwatches.text.style.background = currentTheme.text;
    }
    if (previewSwatches.button) {
      previewSwatches.button.style.background = currentTheme.button;
    }
    if (previewSwatches.highlight) {
      previewSwatches.highlight.style.background = currentTheme.highlight;
    }
  }

  // Update color input values and hex displays
  function updateColorInputs() {
    if (colorInputs.background) {
      colorInputs.background.value = currentTheme.background;
      hexDisplays.background.textContent = currentTheme.background;
    }
    if (colorInputs.text) {
      colorInputs.text.value = currentTheme.text;
      hexDisplays.text.textContent = currentTheme.text;
    }
    if (colorInputs.button) {
      colorInputs.button.value = currentTheme.button;
      hexDisplays.button.textContent = currentTheme.button;
    }
    if (colorInputs.highlight) {
      colorInputs.highlight.value = currentTheme.highlight;
      hexDisplays.highlight.textContent = currentTheme.highlight;
    }
  }

  // Update preset button active state
  function updatePresetButtons() {
    if (!presetButtons) return;

    presetButtons.forEach(btn => {
      if (btn.dataset.theme === activePreset) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Check if current theme matches a preset
  function detectActivePreset() {
    for (const [name, colors] of Object.entries(PRESETS)) {
      if (
        currentTheme.background === colors.background &&
        currentTheme.text === colors.text &&
        currentTheme.button === colors.button &&
        currentTheme.highlight === colors.highlight
      ) {
        return name;
      }
    }
    return null; // Custom theme
  }

  // Handle preset button click
  function handlePresetClick(e) {
    const themeName = e.currentTarget.dataset.theme;
    if (themeName && PRESETS[themeName]) {
      currentTheme = { ...PRESETS[themeName] };
      activePreset = themeName;
      applyTheme();
      updatePresetButtons();
      // Trigger auto-save
      if (typeof DraftManager !== 'undefined') {
        DraftManager.save();
      }
    }
  }

  // Handle color input change
  function handleColorChange(colorKey) {
    return function(e) {
      currentTheme[colorKey] = e.target.value;
      hexDisplays[colorKey].textContent = e.target.value;

      // Update preview swatch
      if (previewSwatches[colorKey]) {
        previewSwatches[colorKey].style.background = e.target.value;
      }

      // Apply to CSS
      const root = document.documentElement;
      root.style.setProperty(`--color-${colorKey}`, e.target.value);

      // Check if we still match a preset
      activePreset = detectActivePreset();
      updatePresetButtons();

      // Trigger auto-save
      if (typeof DraftManager !== 'undefined') {
        DraftManager.save();
      }
    };
  }

  // Handle reset button click - resets to the currently selected preset
  function handleReset() {
    // If we have an active preset, reset to its colors
    // Otherwise fall back to brick
    const presetName = activePreset || 'brick';
    if (PRESETS[presetName]) {
      currentTheme = { ...PRESETS[presetName] };
    } else {
      currentTheme = { ...PRESETS.brick };
      activePreset = 'brick';
    }
    applyTheme();
    updatePresetButtons();
    // Trigger auto-save
    if (typeof DraftManager !== 'undefined') {
      DraftManager.save();
    }
  }

  // Get current theme (for URL encoding)
  function getTheme() {
    return { ...currentTheme };
  }

  // Set theme (for loading from URL)
  function setTheme(theme) {
    if (theme && theme.background && theme.text && theme.button && theme.highlight) {
      currentTheme = { ...theme };
      activePreset = detectActivePreset();
      applyTheme();
      updatePresetButtons();
    }
  }

  // Check if using default theme
  function isDefaultTheme() {
    return activePreset === 'brick';
  }

  // Initialize
  function init() {
    // Get color input elements
    colorInputs = {
      background: document.getElementById('color-background'),
      text: document.getElementById('color-text'),
      button: document.getElementById('color-button'),
      highlight: document.getElementById('color-highlight')
    };

    // Get hex display elements
    hexDisplays = {
      background: document.getElementById('hex-background'),
      text: document.getElementById('hex-text'),
      button: document.getElementById('hex-button'),
      highlight: document.getElementById('hex-highlight')
    };

    // Get preview swatch elements
    previewSwatches = {
      background: document.getElementById('preview-background'),
      text: document.getElementById('preview-text'),
      button: document.getElementById('preview-button'),
      highlight: document.getElementById('preview-highlight')
    };

    // Get preset buttons
    presetButtons = document.querySelectorAll('.theme-preset-btn');

    // Get reset button
    resetBtn = document.getElementById('reset-theme-btn');

    // Add event listeners for color inputs
    colorInputs.background.addEventListener('input', handleColorChange('background'));
    colorInputs.text.addEventListener('input', handleColorChange('text'));
    colorInputs.button.addEventListener('input', handleColorChange('button'));
    colorInputs.highlight.addEventListener('input', handleColorChange('highlight'));

    // Add event listeners for preset buttons
    presetButtons.forEach(btn => {
      btn.addEventListener('click', handlePresetClick);
    });

    // Add event listener for reset button
    resetBtn.addEventListener('click', handleReset);

    // Initial render
    applyTheme();
    updatePresetButtons();
  }

  // Public API
  return {
    init,
    getTheme,
    setTheme,
    isDefaultTheme,
    PRESETS
  };
})();

// URL Manager Module
const URLManager = (function() {
  // Configuration
  // TODO: Replace with your actual Cloudflare Worker URL after deployment
  // Leave empty to disable URL shortening and use long hash URLs
  const SHORTENER_API_URL = 'https://madlib-url-shortener.spidleweb.workers.dev';

  // Toast element
  let toastEl;
  let toastTimeout;

  // Show toast notification
  function showToast(message, isError = false) {
    if (!toastEl) return;

    // Clear existing timeout
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }

    toastEl.textContent = message;
    toastEl.classList.remove('show', 'error');

    if (isError) {
      toastEl.classList.add('error');
    }

    // Force reflow for animation
    void toastEl.offsetWidth;

    toastEl.classList.add('show');

    toastTimeout = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 3000);
  }

  // Collect all madlib data
  function collectData() {
    const data = {
      title: MetadataManager.getRawTitle(),
      subtitle: MetadataManager.getSubtitle(),
      placeholders: WordListManager.getPlaceholders(),
      story: StoryEditor.getStory()
    };

    // Only include theme if not default (to keep URLs shorter)
    if (!ColorThemeManager.isDefaultTheme()) {
      const theme = ColorThemeManager.getTheme();
      data.theme = {
        bg: theme.background,
        text: theme.text,
        button: theme.button,
        highlight: theme.highlight
      };
    }

    return data;
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
  async function generateStoryURL(answers) {
    const data = collectData();
    data.answers = answers; // Include the user's answers

    // Try to create short URL first (if shortening is enabled)
    let url = null;
    if (SHORTENER_API_URL) {
      url = await createShortURL('story', data);
    }

    // Fallback to long URL if shortening failed or is disabled
    if (!url) {
      const encoded = encodeData(data);
      if (!encoded) return null;
      const longUrl = new URL(window.location.href);
      longUrl.hash = `story=${encoded}`;
      url = longUrl.toString();
    }

    return url;
  }

  // Copy URL to clipboard
  async function copyToClipboard(url) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch (e) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = url;
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

  // Handle share player button click
  async function handleSharePlayer() {
    // Validate before sharing
    const placeholders = WordListManager.getPlaceholders();
    const story = StoryEditor.getStory();

    if (placeholders.length === 0) {
      showToast('Add at least one placeholder to share', true);
      return;
    }

    if (!story || !story.trim()) {
      showToast('Add story content to share', true);
      return;
    }

    // Try to create short URL first (if shortening is enabled)
    let url = null;
    if (SHORTENER_API_URL) {
      const data = collectData();
      url = await createShortURL('play', data);
    }

    // Fallback to long URL if shortening failed or is disabled
    if (!url) {
      url = generatePlayerURL();
    }

    if (!url) {
      showToast('Failed to generate link', true);
      return;
    }

    const success = await copyToClipboard(url);
    if (success) {
      showToast('Player link copied to clipboard!');
    } else {
      showToast('Failed to copy link', true);
    }
  }

  // Handle share editor button click
  async function handleShareEditor() {
    // Try to create short URL first (if shortening is enabled)
    let url = null;
    if (SHORTENER_API_URL) {
      const data = collectData();
      url = await createShortURL('edit', data);
    }

    // Fallback to long URL if shortening failed or is disabled
    if (!url) {
      url = generateEditorURL();
    }

    if (!url) {
      showToast('Failed to generate link', true);
      return;
    }

    const success = await copyToClipboard(url);
    if (success) {
      showToast('Editor link copied to clipboard!');
    } else {
      showToast('Failed to copy link', true);
    }
  }

  // Load data into the editor
  function loadData(data) {
    if (!data) return false;

    try {
      // Load title and subtitle
      if (data.title !== undefined) {
        MetadataManager.setTitle(data.title);
      }
      if (data.subtitle !== undefined) {
        MetadataManager.setSubtitle(data.subtitle);
      }

      // Load placeholders
      if (data.placeholders) {
        WordListManager.setPlaceholders(data.placeholders);
      }

      // Load story
      if (data.story !== undefined) {
        StoryEditor.setStory(data.story);
      }

      // Load theme
      if (data.theme) {
        ColorThemeManager.setTheme({
          background: data.theme.bg,
          text: data.theme.text,
          button: data.theme.button,
          highlight: data.theme.highlight
        });
      }

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
          data: expanded.data,
          isShort: true
        };
      }
      return null; // Failed to expand
    }

    // Standard long hash formats
    if (hashContent.startsWith('play=')) {
      return {
        mode: 'play',
        data: decodeData(hashContent.substring(5))
      };
    } else if (hashContent.startsWith('edit=')) {
      return {
        mode: 'edit',
        data: decodeData(hashContent.substring(5))
      };
    } else if (hashContent.startsWith('story=')) {
      return {
        mode: 'story',
        data: decodeData(hashContent.substring(6))
      };
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
      showToast('Could not load madlib from URL', true);
      return { mode: 'creator', loaded: false, error: true };
    }

    // Load the data
    const success = loadData(parsed.data);

    if (!success) {
      showToast('Could not load madlib from URL', true);
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

    // Set up button listeners
    const sharePlayerBtn = document.getElementById('share-player-btn');
    const shareEditorBtn = document.getElementById('share-editor-btn');

    if (sharePlayerBtn) {
      sharePlayerBtn.addEventListener('click', handleSharePlayer);
    }
    if (shareEditorBtn) {
      shareEditorBtn.addEventListener('click', handleShareEditor);
    }

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
    loadData,
    parseHash,
    showToast
  };
})();

// Player Mode Module
const PlayerMode = (function() {
  // State
  let placeholders = [];
  let story = '';
  let title = '';
  let subtitle = '';
  let answers = {};
  let inputMode = 'sequential'; // 'sequential' or 'all-at-once'
  let currentPromptIndex = 0;
  let isActive = false;

  // DOM Elements
  let containerEl;
  let creatorEl;
  let playerContainerEl;
  let topBarEl;
  let introScreen;
  let sequentialScreen;
  let allAtOnceScreen;
  let revealScreen;

  // Intro screen elements
  let titleEl;
  let subtitleEl;
  let toggleBtns;
  let startBtn;

  // Sequential screen elements
  let progressEl;
  let labelEl;
  let inputEl;
  let prevBtn;
  let nextBtn;

  // All-at-once screen elements
  let formEl;
  let submitBtn;

  // Reveal screen elements
  let storyOutputEl;
  let copyBtn;
  let shareStoryBtn;
  let playAgainBtn;
  let createOwnBtn;

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Show a specific screen, hide others
  function showScreen(screenName) {
    introScreen.style.display = screenName === 'intro' ? 'flex' : 'none';
    sequentialScreen.style.display = screenName === 'sequential' ? 'flex' : 'none';
    allAtOnceScreen.style.display = screenName === 'all-at-once' ? 'flex' : 'none';
    revealScreen.style.display = screenName === 'reveal' ? 'flex' : 'none';
  }

  // Update intro screen with title and subtitle
  function renderIntro() {
    titleEl.textContent = title || 'Untitled Madlib';
    subtitleEl.textContent = subtitle || '';

    // Update page title
    document.title = title || 'Untitled Madlib';
  }

  // Update toggle button states
  function updateToggleButtons() {
    toggleBtns.forEach(btn => {
      if (btn.dataset.mode === inputMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Render current prompt in sequential mode
  function renderSequentialPrompt() {
    if (placeholders.length === 0) return;

    const current = placeholders[currentPromptIndex];
    progressEl.textContent = `${currentPromptIndex + 1} of ${placeholders.length}`;
    labelEl.textContent = current.label;
    inputEl.placeholder = `Enter a ${current.label}...`;
    inputEl.value = answers[current.id] || '';

    // Update navigation buttons
    prevBtn.disabled = currentPromptIndex === 0;

    // Change next button text on last prompt
    if (currentPromptIndex === placeholders.length - 1) {
      nextBtn.textContent = 'See My Story →';
    } else {
      nextBtn.textContent = 'Next →';
    }

    // Focus input
    inputEl.focus();
  }

  // Render all-at-once form
  function renderAllAtOnceForm() {
    formEl.innerHTML = '';

    placeholders.forEach(placeholder => {
      const fieldDiv = document.createElement('div');
      fieldDiv.className = 'form-field';

      const label = document.createElement('label');
      label.setAttribute('for', `input-${placeholder.id}`);
      label.textContent = placeholder.label;

      const input = document.createElement('input');
      input.type = 'text';
      input.id = `input-${placeholder.id}`;
      input.dataset.id = placeholder.id;
      input.placeholder = `Enter a ${placeholder.label}...`;
      input.value = answers[placeholder.id] || '';

      // Sync answer on input
      input.addEventListener('input', () => {
        answers[placeholder.id] = input.value;
      });

      fieldDiv.appendChild(label);
      fieldDiv.appendChild(input);
      formEl.appendChild(fieldDiv);
    });
  }

  // Render story with substitutions
  function renderReveal() {
    let output = story;

    // Replace placeholders with answers, wrapped in highlight spans
    // Blank inputs render as "___" in a highlight span
    placeholders.forEach(placeholder => {
      const regex = new RegExp(`\\{${placeholder.id}\\}`, 'g');
      const rawAnswer = answers[placeholder.id];
      const displayAnswer = rawAnswer && rawAnswer.trim() ? rawAnswer : '___';
      output = output.replace(regex, `<span class="story-word">${escapeHtml(displayAnswer)}</span>`);
    });

    storyOutputEl.innerHTML = output;
  }

  // Get plain text version of story (for copy)
  function getPlainTextStory() {
    let output = story;

    placeholders.forEach(placeholder => {
      const regex = new RegExp(`\\{${placeholder.id}\\}`, 'g');
      const rawAnswer = answers[placeholder.id];
      const displayAnswer = rawAnswer && rawAnswer.trim() ? rawAnswer : '___';
      output = output.replace(regex, displayAnswer);
    });

    return output;
  }

  // Handle start button click
  function handleStart() {
    if (placeholders.length === 0) {
      URLManager.showToast('No prompts to fill!', true);
      return;
    }

    if (inputMode === 'sequential') {
      currentPromptIndex = 0;
      renderSequentialPrompt();
      showScreen('sequential');
    } else {
      renderAllAtOnceForm();
      showScreen('all-at-once');
      // Focus first input
      const firstInput = formEl.querySelector('input');
      if (firstInput) firstInput.focus();
    }
  }

  // Handle toggle button click
  function handleToggle(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode) {
      inputMode = mode;
      updateToggleButtons();
    }
  }

  // Handle next button in sequential mode
  function handleNext() {
    // Save current answer
    const current = placeholders[currentPromptIndex];
    answers[current.id] = inputEl.value;

    if (currentPromptIndex < placeholders.length - 1) {
      currentPromptIndex++;
      renderSequentialPrompt();
    } else {
      // Show reveal
      renderReveal();
      showScreen('reveal');
    }
  }

  // Handle prev button in sequential mode
  function handlePrev() {
    // Save current answer
    const current = placeholders[currentPromptIndex];
    answers[current.id] = inputEl.value;

    if (currentPromptIndex > 0) {
      currentPromptIndex--;
      renderSequentialPrompt();
    }
  }

  // Handle enter key in sequential mode
  function handleInputKeypress(e) {
    if (e.key === 'Enter') {
      handleNext();
    }
  }

  // Handle submit all button
  function handleSubmitAll() {
    // Collect all answers from form inputs
    const inputs = formEl.querySelectorAll('input');
    inputs.forEach(input => {
      answers[input.dataset.id] = input.value;
    });

    renderReveal();
    showScreen('reveal');
  }

  // Handle copy story button
  async function handleCopyStory() {
    const text = getPlainTextStory();

    try {
      await navigator.clipboard.writeText(text);
      URLManager.showToast('Story copied to clipboard!');
    } catch (e) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        URLManager.showToast('Story copied to clipboard!');
      } catch (e2) {
        URLManager.showToast('Failed to copy story', true);
      }
      document.body.removeChild(textarea);
    }
  }

  // Handle share story link button
  async function handleShareStoryLink() {
    const url = await URLManager.generateStoryURL(answers);
    if (!url) {
      URLManager.showToast('Failed to generate story link', true);
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      URLManager.showToast('Story link copied to clipboard!');
    } catch (e) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        URLManager.showToast('Story link copied to clipboard!');
      } catch (e2) {
        URLManager.showToast('Failed to copy story link', true);
      }
      document.body.removeChild(textarea);
    }
  }

  // Handle play again button
  function handlePlayAgain() {
    // Reset answers but keep placeholders and story
    answers = {};
    currentPromptIndex = 0;

    // Go back to intro
    showScreen('intro');
  }

  function handleCreateOwn() {
    // Navigate to creator mode with a fresh madlib
    window.location.href = window.location.pathname;
  }

  // Activate player mode with data
  // isPreview: if true, don't hide the creator container (ModeManager handles that)
  // isStoryView: if true, show completed story directly (for #story= URLs)
  function activate(data, isPreview = false, isStoryView = false) {
    if (!data) return false;

    // Store data
    placeholders = data.placeholders || [];
    story = data.story || '';
    title = data.title || '';
    subtitle = data.subtitle || '';
    answers = data.answers || {};
    currentPromptIndex = 0;
    isActive = true;

    // Apply theme if present
    if (data.theme) {
      ColorThemeManager.setTheme({
        background: data.theme.bg,
        text: data.theme.text,
        button: data.theme.button,
        highlight: data.theme.highlight
      });
    }

    // For preview mode, don't hide the container (ModeManager handles section visibility)
    // For player-only mode, hide the entire creator container and top bar
    if (!isPreview) {
      creatorEl.style.display = 'none';
      if (topBarEl) topBarEl.style.display = 'none';
    }
    playerContainerEl.style.display = 'flex';

    // If story view mode, show the completed story directly
    if (isStoryView && data.answers) {
      renderReveal();
      showScreen('reveal');
    } else {
      // Otherwise show intro screen for interactive play
      renderIntro();
      showScreen('intro');
    }

    return true;
  }

  // Deactivate player mode
  function deactivate() {
    isActive = false;
    playerContainerEl.style.display = 'none';
    creatorEl.style.display = '';
    if (topBarEl) topBarEl.style.display = '';

    // Reset player state for next activation
    answers = {};
    currentPromptIndex = 0;
  }

  // Initialize
  function init() {
    // Get main containers
    creatorEl = document.querySelector('.container');
    playerContainerEl = document.getElementById('player-container');
    topBarEl = document.querySelector('.top-bar');

    // Get screens
    introScreen = document.getElementById('player-intro');
    sequentialScreen = document.getElementById('player-sequential');
    allAtOnceScreen = document.getElementById('player-all-at-once');
    revealScreen = document.getElementById('player-reveal');

    // Get intro elements
    titleEl = document.getElementById('player-title');
    subtitleEl = document.getElementById('player-subtitle');
    toggleBtns = document.querySelectorAll('.toggle-btn');
    startBtn = document.getElementById('start-btn');

    // Get sequential elements
    progressEl = document.getElementById('prompt-progress');
    labelEl = document.getElementById('prompt-label');
    inputEl = document.getElementById('prompt-input');
    prevBtn = document.getElementById('prev-btn');
    nextBtn = document.getElementById('next-btn');

    // Get all-at-once elements
    formEl = document.getElementById('all-inputs-form');
    submitBtn = document.getElementById('submit-all-btn');

    // Get reveal elements
    storyOutputEl = document.getElementById('story-output');
    copyBtn = document.getElementById('copy-story-btn');
    shareStoryBtn = document.getElementById('share-story-btn');
    playAgainBtn = document.getElementById('play-again-btn');
    createOwnBtn = document.getElementById('create-own-btn');

    // Set up event listeners
    startBtn.addEventListener('click', handleStart);

    toggleBtns.forEach(btn => {
      btn.addEventListener('click', handleToggle);
    });

    prevBtn.addEventListener('click', handlePrev);
    nextBtn.addEventListener('click', handleNext);
    inputEl.addEventListener('keypress', handleInputKeypress);

    submitBtn.addEventListener('click', handleSubmitAll);

    copyBtn.addEventListener('click', handleCopyStory);
    shareStoryBtn.addEventListener('click', handleShareStoryLink);
    playAgainBtn.addEventListener('click', handlePlayAgain);
    createOwnBtn.addEventListener('click', handleCreateOwn);
  }

  // Public API
  return {
    init,
    activate,
    deactivate,
    isActive: () => isActive
  };
})();

// Draft Manager Module (Local Storage Persistence)
const DraftManager = (function() {
  const STORAGE_KEY = 'madlib-creator-draft';
  const DEBOUNCE_DELAY = 500;

  let saveTimeout = null;
  let isEnabled = true; // Can be disabled for player-only mode

  // Collect current state for saving
  function collectState() {
    return {
      title: MetadataManager.getRawTitle(),
      subtitle: MetadataManager.getSubtitle(),
      placeholders: WordListManager.getPlaceholders(),
      story: StoryEditor.getStory(),
      theme: ColorThemeManager.getTheme()
    };
  }

  // Save to local storage (internal, immediate)
  function doSave() {
    if (!isEnabled) return;

    try {
      const state = collectState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save draft:', e);
    }
  }

  // Save with debounce (public API)
  function save() {
    if (!isEnabled) return;

    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Schedule save
    saveTimeout = setTimeout(doSave, DEBOUNCE_DELAY);
  }

  // Load from local storage
  function load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to load draft:', e);
      return null;
    }
  }

  // Check if draft exists
  function hasDraft() {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch (e) {
      return false;
    }
  }

  // Clear draft from storage
  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear draft:', e);
    }
  }

  // Restore draft to editor
  function restore() {
    const draft = load();
    if (!draft) return false;

    try {
      // Restore title and subtitle
      if (draft.title !== undefined) {
        MetadataManager.setTitle(draft.title);
      }
      if (draft.subtitle !== undefined) {
        MetadataManager.setSubtitle(draft.subtitle);
      }

      // Restore placeholders
      if (draft.placeholders) {
        WordListManager.setPlaceholders(draft.placeholders);
      }

      // Restore story
      if (draft.story !== undefined) {
        StoryEditor.setStory(draft.story);
      }

      // Restore theme
      if (draft.theme) {
        ColorThemeManager.setTheme(draft.theme);
      }

      return true;
    } catch (e) {
      console.error('Failed to restore draft:', e);
      return false;
    }
  }

  // Reset editor to blank slate
  function resetEditor() {
    MetadataManager.setTitle('');
    MetadataManager.setSubtitle('');
    WordListManager.setPlaceholders([]);
    StoryEditor.setStory('');
    ColorThemeManager.setTheme(ColorThemeManager.PRESETS.brick);
  }

  // Handle "New Madlib" button click
  function handleNewMadlib() {
    if (hasDraft()) {
      // Show confirmation
      const confirmed = confirm('Start a new madlib? Your current draft will be cleared.');
      if (!confirmed) return;
    }

    // Clear storage and reset editor
    clear();
    resetEditor();
    URLManager.showToast('Started new madlib');
  }

  // Enable/disable auto-save (disable for player mode)
  function setEnabled(enabled) {
    isEnabled = enabled;
  }

  // Initialize
  function init() {
    // Set up "New Madlib" button listener
    const newBtn = document.getElementById('new-madlib-btn');
    if (newBtn) {
      newBtn.addEventListener('click', handleNewMadlib);
    }
  }

  // Public API
  return {
    init,
    save,
    load,
    hasDraft,
    clear,
    restore,
    resetEditor,
    setEnabled
  };
})();

// Mode Manager Module
const ModeManager = (function() {
  // Current mode: 'creator' or 'preview'
  let currentMode = 'creator';

  // Whether we're in player-only mode (from #play= URL)
  let isPlayerOnly = false;

  // DOM Elements
  let modeTabsEl;
  let modeTabs;
  let creatorSections;
  let creatorEl;
  let playerContainerEl;

  // Validate before entering preview mode
  function validate() {
    const placeholders = WordListManager.getPlaceholders();
    const story = StoryEditor.getStory();

    const errors = [];

    if (placeholders.length === 0) {
      errors.push('Add at least one placeholder to preview');
    }

    if (!story || !story.trim()) {
      errors.push('Add story content to preview');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Collect current state for preview
  function collectPreviewData() {
    return {
      title: MetadataManager.getRawTitle(),
      subtitle: MetadataManager.getSubtitle(),
      placeholders: WordListManager.getPlaceholders(),
      story: StoryEditor.getStory(),
      theme: ColorThemeManager.isDefaultTheme() ? null : {
        bg: ColorThemeManager.getTheme().background,
        text: ColorThemeManager.getTheme().text,
        button: ColorThemeManager.getTheme().button,
        highlight: ColorThemeManager.getTheme().highlight
      }
    };
  }

  // Update tab button states
  function updateTabButtons() {
    if (!modeTabs) return;

    modeTabs.forEach(tab => {
      if (tab.dataset.mode === currentMode) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  // Show creator sections
  function showCreatorSections() {
    if (creatorSections) {
      creatorSections.forEach(section => {
        section.style.display = '';
      });
    }
    // Show headers
    const headerRow = document.querySelector('.container .header-row');
    const h2 = document.querySelector('.container h2');
    if (headerRow) headerRow.style.display = '';
    if (h2) h2.style.display = '';
  }

  // Hide creator sections
  function hideCreatorSections() {
    if (creatorSections) {
      creatorSections.forEach(section => {
        section.style.display = 'none';
      });
    }
    // Hide headers (player has its own title)
    const headerRow = document.querySelector('.container .header-row');
    const h2 = document.querySelector('.container h2');
    if (headerRow) headerRow.style.display = 'none';
    if (h2) h2.style.display = 'none';
  }

  // Switch to creator mode
  function switchToCreator() {
    currentMode = 'creator';

    // Deactivate player
    PlayerMode.deactivate();

    // Show creator sections
    showCreatorSections();

    // Update tabs
    updateTabButtons();
  }

  // Switch to preview mode
  function switchToPreview() {
    // Validate first
    const validation = validate();

    if (!validation.valid) {
      URLManager.showToast(validation.errors[0], true);
      return false;
    }

    currentMode = 'preview';

    // Hide creator sections but keep tabs visible
    hideCreatorSections();

    // Update tabs
    updateTabButtons();

    // Activate player with current data (isPreview=true to keep container visible)
    const data = collectPreviewData();
    PlayerMode.activate(data, true);

    return true;
  }

  // Handle tab click
  function handleTabClick(e) {
    const mode = e.currentTarget.dataset.mode;

    if (mode === currentMode) return;

    if (mode === 'creator') {
      switchToCreator();
    } else if (mode === 'preview') {
      switchToPreview();
    }
  }

  // Set player-only mode (from #play= URL)
  function setPlayerOnly(isOnly) {
    isPlayerOnly = isOnly;

    if (isOnly) {
      // Hide mode tabs entirely for player-only mode
      if (modeTabsEl) {
        modeTabsEl.style.display = 'none';
      }
    }
  }

  // Check if in player-only mode
  function isPlayerOnlyMode() {
    return isPlayerOnly;
  }

  // Get current mode
  function getMode() {
    return currentMode;
  }

  // Initialize
  function init() {
    modeTabsEl = document.getElementById('mode-tabs');
    modeTabs = document.querySelectorAll('.mode-tab');
    creatorEl = document.querySelector('.container');
    playerContainerEl = document.getElementById('player-container');

    // Get all creator sections (not including the header and tabs)
    creatorSections = document.querySelectorAll('.container .section');

    // Add tab click listeners
    modeTabs.forEach(tab => {
      tab.addEventListener('click', handleTabClick);
    });
  }

  // Public API
  return {
    init,
    switchToCreator,
    switchToPreview,
    setPlayerOnly,
    isPlayerOnlyMode,
    getMode,
    validate
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async function() {
  WordListManager.init();
  StoryEditor.init();
  MetadataManager.init();
  ColorThemeManager.init();
  PlayerMode.init();
  ModeManager.init();
  DraftManager.init();

  // Initialize URL manager and check for play/edit mode
  const urlResult = await URLManager.init();

  if (urlResult.mode === 'play' && urlResult.loaded && urlResult.data) {
    // Player-only mode from #play= URL
    // Hide creator UI entirely, no edit access
    // Disable draft auto-save for player mode
    DraftManager.setEnabled(false);
    ModeManager.setPlayerOnly(true);
    document.querySelector('.container').style.display = 'none';
    PlayerMode.activate(urlResult.data);
  } else if (urlResult.mode === 'story' && urlResult.loaded && urlResult.data) {
    // Story view mode from #story= URL
    // Show completed story directly
    // Disable draft auto-save for story view mode
    DraftManager.setEnabled(false);
    ModeManager.setPlayerOnly(true);
    document.querySelector('.container').style.display = 'none';
    PlayerMode.activate(urlResult.data, false, true);
  } else if (urlResult.mode === 'edit' && urlResult.loaded) {
    // Creator mode from #edit= URL, data already loaded by URLManager
    // Overwrite local draft with URL data
    DraftManager.save();
  } else if (urlResult.error) {
    // Invalid/malformed hash - error toast already shown by URLManager
    // Try to restore from local draft
    if (DraftManager.hasDraft()) {
      DraftManager.restore();
      URLManager.showToast('Draft restored');
    }
  } else {
    // Base URL (no hash) - check for saved draft
    if (DraftManager.hasDraft()) {
      DraftManager.restore();
      URLManager.showToast('Draft restored');
    }
  }
});
