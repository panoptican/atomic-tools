// Story editor highlighting: a "backdrop mirror" behind the real textarea.
// The textarea keeps all native behaviour; a div with identical text metrics
// sits underneath and paints a chip behind every {blank} token.
const MadlibHighlight = (function() {
  // Computed styles that affect where text lands; copied from the textarea
  const MIRRORED = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant',
    'fontStretch', 'fontKerning', 'fontFeatureSettings', 'fontVariationSettings',
    'lineHeight', 'letterSpacing', 'wordSpacing', 'textTransform', 'textIndent',
    'textRendering', 'tabSize', 'direction',
    'paddingTop', 'paddingLeft', 'paddingBottom',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'
  ];

  let textarea = null;
  let backdrop = null;
  let ready = false;

  // Escape plain text and mark each token; tokens must not overlap
  function buildHtml(text) {
    let tokens = [];
    try {
      tokens = MadlibFormat.parse(text).tokens || [];
    } catch (e) {
      tokens = [];
    }
    tokens = tokens.slice().sort(function(a, b) { return a.start - b.start; });

    let html = '';
    let pos = 0;
    tokens.forEach(function(token) {
      if (token.start < pos || token.end > text.length) return;
      html += escapeHtml(text.slice(pos, token.start));
      let cls = 'hl-token';
      if (token.name) cls += ' hl-named';
      if (token.question) cls += ' hl-question';
      html += '<mark class="' + cls + '">' + escapeHtml(text.slice(token.start, token.end)) + '</mark>';
      pos = token.end;
    });
    html += escapeHtml(text.slice(pos));
    // A trailing newline is collapsed in a div but shows as a line in a textarea
    if (/\n$/.test(text)) html += ' ';
    return html;
  }

  function syncScroll() {
    backdrop.scrollTop = textarea.scrollTop;
    backdrop.scrollLeft = textarea.scrollLeft;
  }

  // Re-copy metrics; runs at init and whenever the textarea resizes
  function syncStyles() {
    const cs = getComputedStyle(textarea);
    MIRRORED.forEach(function(prop) {
      backdrop.style[prop] = cs[prop];
    });
    // A classic (non-overlay) scrollbar narrows the textarea's text area; reserve the same width
    const scrollbar = Math.max(0, textarea.offsetWidth - textarea.clientWidth -
      parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth));
    backdrop.style.paddingRight = (parseFloat(cs.paddingRight) + scrollbar) + 'px';
    syncScroll();
  }

  function render() {
    if (!ready) return;
    backdrop.innerHTML = buildHtml(textarea.value);
    syncScroll();
  }

  function refresh() {
    syncStyles();
    render();
  }

  function init() {
    if (ready) return;
    textarea = document.getElementById('story-editor');
    if (!textarea || !textarea.parentNode) return;

    const wrap = document.createElement('div');
    wrap.className = 'hl-wrap';
    backdrop = document.createElement('div');
    backdrop.className = 'hl-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    textarea.parentNode.insertBefore(wrap, textarea);
    wrap.appendChild(backdrop);
    wrap.appendChild(textarea);
    wrap.classList.add('hl-active');
    ready = true;

    textarea.addEventListener('scroll', syncScroll);
    textarea.addEventListener('input', render);
    document.addEventListener('madlib:storychange', render);

    // The textarea is user-resizable and its padding/font change by breakpoint
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(refresh).observe(textarea);
    }
    window.addEventListener('resize', refresh);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(refresh);
    }

    refresh();
  }

  return { init: init, refresh: refresh };
})();
