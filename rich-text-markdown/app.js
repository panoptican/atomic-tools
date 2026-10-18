/**
 * Markdown ↔ Rich Text — UI wiring (uses RtmConverter).
 *
 * The input box takes pastes (and drops), not typing: each paste is converted
 * and copied at once, while the paste still counts as a user gesture, which
 * Safari needs before it allows a clipboard write.
 */
(function () {
  'use strict';

  var C = window.RtmConverter;
  var convertersReady = C && C.ready();

  var state = {
    direction: null,
    outputMarkdown: '',
    outputHtml: '',
    copyStatus: 'idle'
  };
  var statusTimeout = null;
  var hintTimeout = null;
  // The box's last accepted value, restored when typing slips past beforeinput.
  var lastValue = '';

  var inputArea = document.getElementById('inputArea');
  var clearBtn = document.getElementById('clearBtn');
  var copyBtn = document.getElementById('copyBtn');
  var directionBadge = document.getElementById('directionBadge');
  var badgeText = document.getElementById('badgeText');
  var swapHint = document.getElementById('swapHint');
  var outputSection = document.getElementById('outputSection');
  var outputLabel = document.getElementById('outputLabel');
  var outputBox = document.getElementById('outputBox');
  var hintText = document.getElementById('hintText');
  var statusNote = document.getElementById('statusNote');
  var liveStatus = document.getElementById('liveStatus');
  var selfAside = document.getElementById('selfAside');
  var pageTitle = document.querySelector('.page-title');

  var BADGE_ICONS = {
    check: 'badgeIconCheck',
    error: 'badgeIconError'
  };

  var OFFLINE_MESSAGE = 'Conversion libraries are unavailable. Reload when you are back online.';

  // Edits the box still accepts: paste and drop (handled below), deleting,
  // and undo/redo. Everything else is typing.
  var ALLOWED_INPUT = /^(insertFromPaste|insertFromDrop|delete|history)/;

  /** Screen-reader announcement; cleared first so a repeat is read again. */
  function announce(message) {
    liveStatus.textContent = '';
    setTimeout(function () {
      liveStatus.textContent = message;
    }, 50);
  }

  function hideAllBadgeIcons() {
    Object.keys(BADGE_ICONS).forEach(function (key) {
      document.getElementById(BADGE_ICONS[key]).classList.add('hidden');
    });
  }

  function showBadgeIcon(name) {
    document.getElementById(BADGE_ICONS[name]).classList.remove('hidden');
  }

  function setBadge(variant, text, label, enabled) {
    var hadFocus = document.activeElement === directionBadge;
    directionBadge.className = 'direction-badge ' + variant;
    badgeText.textContent = text;
    directionBadge.setAttribute('aria-label', label);
    directionBadge.disabled = !enabled;
    // Disabling a focused button drops focus to the page; keep it nearby.
    if (hadFocus && !enabled) inputArea.focus({ preventScroll: true });
  }

  /* The badge is a button only while it has something to do (swap or retry);
     the rest of the time it is a disabled status readout. */
  function updateBadge() {
    hideAllBadgeIcons();
    swapHint.classList.add('hidden');

    if (state.copyStatus === 'error') {
      showBadgeIcon('error');
      setBadge('error', 'Copy failed. Retry', 'Copy failed. Retry copying.', true);
      return;
    }

    if (state.copyStatus === 'copied') {
      showBadgeIcon('check');
      setBadge('copied', 'Copied to clipboard', 'Copied to clipboard', false);
      return;
    }

    if (state.direction === 'html-to-md') {
      // Swapping needs Markdown to feed back; a failed conversion has none.
      var canSwap = !!state.outputMarkdown.trim();
      if (canSwap) swapHint.classList.remove('hidden');
      setBadge(
        'active',
        'Rich text → Markdown',
        canSwap
          ? 'Rich text to Markdown. Swap to convert the Markdown back to rich text.'
          : 'Rich text to Markdown',
        canSwap
      );
      return;
    }

    if (state.direction === 'md-to-html') {
      setBadge('active', 'Markdown → Rich text', 'Markdown to rich text', false);
      return;
    }

    setBadge('idle', 'Paste to begin', 'Paste to begin', false);
  }

  function hasOutput() {
    return state.direction === 'html-to-md' ? !!state.outputMarkdown : !!state.outputHtml;
  }

  function updateOutput() {
    var showOutput = hasOutput();
    clearBtn.classList.toggle('is-invisible', !inputArea.value);
    outputSection.classList.toggle('hidden', !showOutput);
    hintText.classList.toggle('hidden', !convertersReady);
    statusNote.classList.toggle('hidden', convertersReady);
    if (!convertersReady) statusNote.textContent = OFFLINE_MESSAGE;

    if (showOutput) {
      if (state.direction === 'html-to-md') {
        outputLabel.textContent = 'Markdown';
        outputBox.className = 'output-box';
        outputBox.textContent = state.outputMarkdown;
      } else {
        outputLabel.textContent = 'Rich text';
        outputBox.className = 'output-box preview-content';
        outputBox.innerHTML = state.outputHtml;
      }
    }
    // Compare converted text so both a rich heading and a plain paste work.
    var convertedText = state.direction === 'html-to-md'
      ? state.outputMarkdown.replace(/^#{1,6}\s+/, '')
      : outputBox.textContent;
    selfAside.classList.toggle('hidden', !showOutput || convertedText.trim() !== pageTitle.textContent.trim());
    updateBadge();
  }

  function showConversionError(message) {
    state.outputMarkdown = '';
    state.outputHtml = '';
    state.copyStatus = 'idle';
    statusNote.textContent =
      message || 'Conversion failed. Clear the input or try a smaller paste.';
    statusNote.classList.remove('hidden');
    clearBtn.classList.toggle('is-invisible', !inputArea.value);
    outputSection.classList.add('hidden');
    selfAside.classList.add('hidden');
    updateBadge();
  }

  /** Converts `source` in `dir`, storing the result. Returns false on failure. */
  function convert(dir, source) {
    state.direction = dir;
    try {
      if (dir === 'html-to-md') {
        state.outputMarkdown = C.convertHtmlToMd(source);
        state.outputHtml = '';
      } else {
        state.outputHtml = C.convertMdToHtml(source);
        state.outputMarkdown = '';
      }
    } catch (err) {
      showConversionError(err.message);
      return false;
    }
    state.copyStatus = 'idle';
    statusNote.textContent = '';
    updateOutput();
    return true;
  }

  async function copyOutput() {
    if (!hasOutput()) return;
    var dir = state.direction;
    var ok = dir === 'html-to-md'
      ? await C.copyMd(state.outputMarkdown)
      : await C.copyRich(state.outputHtml);

    state.copyStatus = ok ? 'copied' : 'error';
    updateBadge();
    announce(ok
      ? (dir === 'html-to-md' ? 'Markdown copied to clipboard.' : 'Rich text copied to clipboard.')
      : 'Copy failed. Use Retry or Copy again.');

    // "Copied" fades back to the direction readout. A failure stays until Retry,
    // Copy again or the next paste: the page promises automatic copying, so a
    // failed copy must not quietly disappear, and the badge must not turn from
    // Retry into Swap under someone's pointer.
    if (statusTimeout) clearTimeout(statusTimeout);
    if (!ok) return;
    statusTimeout = setTimeout(function () {
      state.copyStatus = 'idle';
      updateBadge();
    }, 2500);
  }

  function clearAll() {
    inputArea.value = lastValue = '';
    state.direction = null;
    state.outputMarkdown = '';
    state.outputHtml = '';
    state.copyStatus = 'idle';
    statusNote.textContent = '';
    updateOutput();
    inputArea.focus();
  }

  function swapDirection() {
    if (state.direction !== 'html-to-md') return;

    var mdText = state.outputMarkdown;
    if (!mdText.trim() || !inputArea.value.trim()) return;

    inputArea.value = lastValue = mdText;
    if (convert('md-to-html', mdText)) copyOutput();
    inputArea.focus({ preventScroll: true });
  }

  /** Paste and drop both land here. Returns true when the data was used. */
  function acceptIncoming(htmlData, textData) {
    if (!convertersReady) {
      showConversionError(OFFLINE_MESSAGE);
      return true;
    }
    var dir = C.detectDirection(htmlData, textData);
    var source = dir === 'html-to-md' ? htmlData : textData;
    if (!dir || !source) return false;

    inputArea.value = lastValue = source;
    if (convert(dir, source)) copyOutput();
    return true;
  }

  function flagPasteOnly() {
    if (!hintText.classList.contains('is-flagged')) {
      announce('This box takes pastes, not typing.');
    }
    hintText.classList.add('is-flagged');
    if (hintTimeout) clearTimeout(hintTimeout);
    hintTimeout = setTimeout(function () {
      hintText.classList.remove('is-flagged');
    }, 2500);
  }

  directionBadge.addEventListener('click', function () {
    if (state.copyStatus === 'error') {
      copyOutput();
      return;
    }
    swapDirection();
  });

  clearBtn.addEventListener('click', clearAll);
  copyBtn.addEventListener('click', copyOutput);

  inputArea.addEventListener('paste', function (e) {
    var data = e.clipboardData;
    if (acceptIncoming(data.getData('text/html'), data.getData('text/plain'))) {
      e.preventDefault();
    }
  });

  inputArea.addEventListener('drop', function (e) {
    var data = e.dataTransfer;
    if (acceptIncoming(data.getData('text/html'), data.getData('text/plain'))) {
      e.preventDefault();
    }
  });

  inputArea.addEventListener('beforeinput', function (e) {
    if (ALLOWED_INPUT.test(e.inputType)) return;
    e.preventDefault();
    flagPasteOnly();
  });

  inputArea.addEventListener('input', function (e) {
    // IME composition can't be cancelled in beforeinput; undo it here.
    if (e.inputType && !ALLOWED_INPUT.test(e.inputType)) {
      inputArea.value = lastValue;
      flagPasteOnly();
      return;
    }
    lastValue = inputArea.value;

    // Deleting everything resets; a partial delete or undo re-converts what's
    // left without copying, and Copy again is there if it's wanted.
    if (!inputArea.value.trim()) {
      state.direction = null;
      state.outputMarkdown = '';
      state.outputHtml = '';
      state.copyStatus = 'idle';
      updateOutput();
      return;
    }
    if (convertersReady) convert(state.direction || 'md-to-html', inputArea.value);
  });

  AtomicTheme.bind({
    storageKey: 'rtm-theme',
    mode: 'class',
    className: 'dark',
    toggleId: 'themeToggle'
  });

  updateOutput();
})();
