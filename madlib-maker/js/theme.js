// Light/dark theme for Madlib Maker. Loaded in <head> so the saved theme
// applies before first paint; the toggle is wired once the page is parsed.
// Kept in a file (not inline) so the page's Content Security Policy can
// refuse every inline script.
AtomicTheme.applyBeforePaint({ storageKey: 'madlib-maker-theme', mode: 'class', className: 'dark' });

document.addEventListener('DOMContentLoaded', function() {
  AtomicTheme.bind({
    storageKey: 'madlib-maker-theme',
    mode: 'class',
    className: 'dark',
    toggleId: 'themeToggle'
  });
});
