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

  // Update tab button states
  function updateTabButtons() {
    if (!modeTabs) return;

    modeTabs.forEach(tab => {
      if (tab.dataset.mode === currentMode) {
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
      } else {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
      }
    });
  }

  function handleTabKeydown(e) {
    const tabs = Array.from(modeTabs);
    const index = tabs.indexOf(e.currentTarget);
    if (index === -1) return;

    let nextIndex = null;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex === null) return;

    e.preventDefault();
    tabs[nextIndex].focus();
  }

  // Show creator sections
  function showCreatorSections() {
    if (creatorSections) {
      creatorSections.forEach(section => {
        section.style.display = '';
      });
    }
    // Show headers
    const pageIntro = document.querySelector('.container .page-intro');
    if (pageIntro) pageIntro.style.display = '';
  }

  // Hide creator sections
  function hideCreatorSections() {
    if (creatorSections) {
      creatorSections.forEach(section => {
        section.style.display = 'none';
      });
    }
    // Hide headers (player has its own title)
    const pageIntro = document.querySelector('.container .page-intro');
    if (pageIntro) pageIntro.style.display = 'none';
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
    modeTabs = document.querySelectorAll('.mode-tab[data-mode]');

    // Get all creator sections (including column/bottom wrappers)
    creatorSections = document.querySelectorAll('.container .section, .container .editor-columns, .container .bottom-sections');

    // Add tab click listeners
    modeTabs.forEach(tab => {
      tab.addEventListener('click', handleTabClick);
      tab.addEventListener('keydown', handleTabKeydown);
    });
    updateTabButtons();
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
