// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async function() {
  StoryEditor.init();
  BlankToolbar.init();
  BlankList.init();
  MetadataManager.init();
  ColorThemeManager.init();
  PlayerMode.init();
  ModeManager.init();
  DraftManager.init();

  // Optional features, one file each. A feature that's missing or throws on init
  // is skipped so the core tool keeps working.
  const features = [
    typeof MadlibHighlight !== 'undefined' && MadlibHighlight,
    typeof MadlibShare !== 'undefined' && MadlibShare,
    typeof MadlibSuggest !== 'undefined' && MadlibSuggest,
    typeof MadlibPrint !== 'undefined' && MadlibPrint,
    typeof MadlibCollection !== 'undefined' && MadlibCollection
  ];
  features.forEach(feature => {
    if (!feature || typeof feature.init !== 'function') return;
    try {
      feature.init();
    } catch (e) {
      console.error('Feature failed to start:', e);
    }
  });

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
    // Creator mode from #edit= URL, data already loaded by URLManager.
    // The library saves it as a new madlib. Drop the hash so a reload reopens
    // that saved copy (with any edits) instead of loading the link again.
    DraftManager.save();
    history.replaceState(null, '', location.pathname + location.search);
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
