// Mode Manager Module
const ModeManager = (function() {
  // Current mode: 'creator' or 'preview'
  let currentMode = 'creator';

  // Whether we're in player-only mode (from #play= URL)
  let isPlayerOnly = false;

  // DOM Elements
  let previewBar;
  let creatorSections;

  // Where the creator was scrolled to, so leaving the preview lands back there
  let creatorScrollY = 0;

  // Validate before entering preview mode
  function validate() {
    const story = StoryEditor.getStory();
    const prompts = MadlibFormat.parse(story).prompts;

    const errors = [];

    if (!story || !story.trim()) {
      errors.push('Add story content to preview');
    } else if (prompts.length === 0) {
      errors.push('Add at least one blank to preview');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Collect current state for preview
  function collectPreviewData() {
    return {
      v: MadlibFormat.VERSION,
      title: MetadataManager.getRawTitle(),
      subtitle: MetadataManager.getSubtitle(),
      story: StoryEditor.getStory()
    };
  }

  // Show creator sections
  function showCreatorSections() {
    if (creatorSections) {
      creatorSections.forEach(section => {
        section.style.display = '';
      });
    }
    // Show headers
    const pageIntro = document.getElementById('creator-intro');
    if (pageIntro) pageIntro.style.display = '';
    document.querySelector('.page-main > .container').classList.remove('is-preview');
    if (previewBar) previewBar.hidden = true;
  }

  // Hide creator sections
  function hideCreatorSections() {
    if (creatorSections) {
      creatorSections.forEach(section => {
        section.style.display = 'none';
      });
    }
    // Hide headers (player has its own title)
    const pageIntro = document.getElementById('creator-intro');
    if (pageIntro) pageIntro.style.display = 'none';
    // Only the preview bar is left, so the container stops sharing the page's
    // spare height with the player and the preview sits right under the bar
    document.querySelector('.page-main > .container').classList.add('is-preview');
    if (previewBar) previewBar.hidden = false;
  }

  // Switch to creator mode
  function switchToCreator() {
    currentMode = 'creator';

    // Deactivate player
    PlayerMode.deactivate();

    // Show creator sections
    showCreatorSections();
  }

  // "Back to editing": land where the preview was opened from, with focus on
  // the Preview button. (Loading a draft also leaves the preview, but goes
  // through switchToCreator alone.)
  function exitPreview() {
    switchToCreator();
    window.scrollTo(0, creatorScrollY);
    const previewBtn = document.getElementById('preview-btn');
    if (previewBtn) previewBtn.focus({ preventScroll: true });
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
    creatorScrollY = window.scrollY;

    // Hide creator sections and show the preview bar
    hideCreatorSections();

    // Activate player with current data (isPreview=true to keep container visible)
    const data = collectPreviewData();
    PlayerMode.activate(data, true);

    // The Preview button just disappeared, so start at the top with focus
    // on the way back
    window.scrollTo(0, 0);
    const exitBtn = document.getElementById('exit-preview-btn');
    if (exitBtn) exitBtn.focus({ preventScroll: true });

    return true;
  }

  // Set player-only mode (from #play= URL)
  function setPlayerOnly(isOnly) {
    isPlayerOnly = isOnly;

    // Nothing to hide: the creator container, with its intro, library
    // buttons and preview bar, is hidden whole for player links (main.js)
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
    previewBar = document.getElementById('preview-bar');

    // Get all creator sections (including the column wrapper)
    creatorSections = document.querySelectorAll('.container .section, .container .editor-columns');

    const previewBtn = document.getElementById('preview-btn');
    if (previewBtn) previewBtn.addEventListener('click', () => switchToPreview());
    const exitBtn = document.getElementById('exit-preview-btn');
    if (exitBtn) exitBtn.addEventListener('click', exitPreview);
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
