const MadlibShare = (function() {
  const CARD_WIDTH = 1080;
  const CARD_MARGIN = 80;
  const CARD_MAX_HEIGHT = 3000;
  const FONT_START = 40;
  const FONT_MIN = 28;

  let linkField = null;

  function isTouchFirst() {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  function selectLinkField() {
    if (!linkField) return;
    linkField.hidden = false;
    linkField.focus();
    linkField.select();
  }

  // Native share sheet on phones; clipboard everywhere else. `useField` is the
  // creator's share panel, where the link also sits in a field to copy by hand.
  async function shareLink({ url, title, text, useField = false }) {
    if (!url) return false;
    if (navigator.share && isTouchFirst()) {
      try {
        await navigator.share({ url, title, text });
        return true;
      } catch (err) {
        if (err && err.name === 'AbortError') return false;
        // Any other failure: fall through to copying
      }
    }
    const copied = await URLManager.copyToClipboard(url);
    if (copied) {
      URLManager.showToast('Link copied');
      return true;
    }
    if (useField && linkField) {
      URLManager.showToast("Couldn’t copy the link. Copy it from the field instead.", true);
      selectLinkField();
    } else {
      URLManager.showToast("Couldn’t copy the link. Use Copy story to share the text instead.", true);
    }
    return false;
  }

  // Share panel ----------------------------------------------------------

  function buildPanel(panel) {
    panel.innerHTML = `
      <div class="share-buttons">
        <button type="button" class="share-btn share-btn-primary" id="share-player-btn">Share with players</button>
        <button type="button" class="share-btn share-btn-secondary" id="share-editor-btn">Copy editor link</button>
      </div>
      <div class="share-link" id="share-link-row" hidden>
        <label class="share-link-label" for="share-link-field">Player link</label>
        <input type="text" class="share-link-field" id="share-link-field" readonly spellcheck="false" autocomplete="off">
        <div class="share-link-actions">
          <button type="button" class="share-btn share-btn-secondary" id="share-copy-btn">Copy</button>
          <a class="share-open-link" id="share-open-link" target="_blank" rel="noopener">Open as player</a>
        </div>
      </div>
    `;

    const playerBtn = panel.querySelector('#share-player-btn');
    const editorBtn = panel.querySelector('#share-editor-btn');
    const copyBtn = panel.querySelector('#share-copy-btn');
    const row = panel.querySelector('#share-link-row');
    const openLink = panel.querySelector('#share-open-link');
    linkField = panel.querySelector('#share-link-field');
    linkField.addEventListener('focus', () => linkField.select());

    playerBtn.addEventListener('click', async () => {
      const label = playerBtn.textContent;
      playerBtn.disabled = true;
      playerBtn.textContent = 'Making link…';
      try {
        const url = await URLManager.getPlayerLink();
        if (!url) return;
        linkField.value = url;
        openLink.href = url;
        row.hidden = false;
        await shareLink({ url, title: MetadataManager.getTitle(), text: 'Fill in my madlib!', useField: true });
      } finally {
        playerBtn.disabled = false;
        playerBtn.textContent = label;
      }
    });

    copyBtn.addEventListener('click', async () => {
      if (!linkField.value) return;
      if (await URLManager.copyToClipboard(linkField.value)) {
        URLManager.showToast('Link copied');
      } else {
        URLManager.showToast("Couldn’t copy the link. Copy it from the field instead.", true);
        selectLinkField();
      }
    });

    editorBtn.addEventListener('click', async () => {
      editorBtn.disabled = true;
      try {
        const url = await URLManager.getEditorLink();
        if (!url) return;
        if (await URLManager.copyToClipboard(url)) {
          URLManager.showToast('Editor link copied. Anyone with it can edit a copy.');
        } else {
          URLManager.showToast("Couldn’t copy the editor link. Click Copy editor link again to retry.", true);
        }
      } finally {
        editorBtn.disabled = false;
      }
    });
  }

  // Image card -----------------------------------------------------------

  function slugify(text) {
    const slug = String(text || '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    return slug || 'madlib';
  }

  function readTheme() {
    const css = getComputedStyle(document.documentElement);
    const get = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    return {
      paper: get('--paper', '#f5f4ef'),
      ink: get('--ink', '#111111'),
      soft: get('--ink-soft', '#444444'),
      muted: get('--ink-muted', '#6e6e69'),
      display: get('--display', 'sans-serif'),
      text: get('--text', 'sans-serif')
    };
  }

  // Split a paragraph into unbreakable atoms (parts glued together, e.g. a chip
  // plus its trailing comma) separated by spaces; { br: true } marks a forced break
  function paragraphAtoms(paragraph) {
    const atoms = [];
    let current = [];
    const flush = () => {
      if (current.length) atoms.push({ parts: current });
      current = [];
    };
    paragraph.forEach((step, i) => {
      if (i > 0) {
        flush();
        if (step.lineBreakBefore) atoms.push({ br: true });
      }
      (step.runs || []).forEach(run => {
        if (run.answer !== undefined) {
          current.push({ chip: true, text: String(run.answer) });
          return;
        }
        String(run.text || '').split(/(\s+)/).forEach(piece => {
          if (!piece) return;
          if (/^\s+$/.test(piece)) flush();
          else current.push({ chip: false, text: piece });
        });
      });
    });
    flush();
    return atoms;
  }

  function wrapPlain(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    String(text).split(/\s+/).filter(Boolean).forEach(word => {
      const next = line ? line + ' ' + word : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  // Lay the story out at one font size: returns lines of positioned parts
  function layoutStory(ctx, result, theme, fs) {
    const textFont = `400 ${fs}px ${theme.text}`;
    const chipFont = `500 ${fs}px ${theme.text}`;
    const pad = Math.round(fs * 0.3);
    const lineHeight = Math.round(fs * 1.65);
    const paraGap = Math.round(fs * 0.9);
    const maxWidth = CARD_WIDTH - CARD_MARGIN * 2;

    ctx.font = textFont;
    const spaceW = ctx.measureText(' ').width;
    const measure = part => {
      ctx.font = part.chip ? chipFont : textFont;
      return ctx.measureText(part.text).width + (part.chip ? pad * 2 : 0);
    };

    const lines = [];
    let height = 0;
    (result.paragraphs || []).forEach((paragraph, pi) => {
      if (pi > 0) height += paraGap;
      let line = null;
      const newLine = () => {
        line = { parts: [], y: height, x: 0 };
        lines.push(line);
        height += lineHeight;
      };
      newLine();
      paragraphAtoms(paragraph).forEach(atom => {
        if (atom.br) {
          newLine();
          return;
        }
        const widths = atom.parts.map(measure);
        const total = widths.reduce((a, b) => a + b, 0);
        if (line.x > 0 && line.x + spaceW + total > maxWidth) newLine();
        if (line.x > 0) line.x += spaceW;
        atom.parts.forEach((part, i) => {
          line.parts.push({ part, x: line.x, w: widths[i] });
          line.x += widths[i];
        });
      });
    });
    return { lines, height, lineHeight, pad, textFont, chipFont };
  }

  function buildCanvas(result, theme) {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH;
    canvas.height = 10;
    const ctx = canvas.getContext('2d');
    const contentX = CARD_MARGIN;
    const maxWidth = CARD_WIDTH - CARD_MARGIN * 2;

    // Header: kicker, title, subtitle
    const kickerFont = `500 24px ${theme.text}`;
    const titleFont = `700 68px ${theme.display}`;
    const subFont = `400 34px ${theme.text}`;
    ctx.font = titleFont;
    const titleLines = wrapPlain(ctx, result.title || 'Untitled madlib', maxWidth);
    ctx.font = subFont;
    const subLines = result.subtitle ? wrapPlain(ctx, result.subtitle, maxWidth) : [];

    const kickerH = 30;
    const titleLH = 80;
    const subLH = 46;
    let headerH = kickerH + 28 + titleLines.length * titleLH;
    if (subLines.length) headerH += 16 + subLines.length * subLH;
    const footerH = 24 + 36 + 30;
    const storyGap = 64;
    const fixedH = CARD_MARGIN * 2 + headerH + storyGap + footerH;

    // Shrink the story text until the card fits the height cap
    let fs = FONT_START;
    let story = layoutStory(ctx, result, theme, fs);
    while (fixedH + story.height > CARD_MAX_HEIGHT && fs > FONT_MIN) {
      fs -= 2;
      story = layoutStory(ctx, result, theme, Math.max(fs, FONT_MIN));
    }

    canvas.height = Math.ceil(fixedH + story.height);
    // Resizing resets the context state
    ctx.fillStyle = theme.paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    let y = CARD_MARGIN;
    ctx.fillStyle = theme.muted;
    ctx.font = kickerFont;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
    ctx.fillText('A MADLIB', contentX, y + 22);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    y += kickerH + 28;

    ctx.fillStyle = theme.ink;
    ctx.font = titleFont;
    titleLines.forEach((line, i) => ctx.fillText(line, contentX, y + i * titleLH + 56));
    y += titleLines.length * titleLH;

    if (subLines.length) {
      y += 16;
      ctx.fillStyle = theme.soft;
      ctx.font = subFont;
      subLines.forEach((line, i) => ctx.fillText(line, contentX, y + i * subLH + 34));
      y += subLines.length * subLH;
    }
    y += storyGap;

    // Story: chips are ink blocks with paper text, like .story-word
    const chipH = Math.round(story.lineHeight * 0.82);
    story.lines.forEach(line => {
      const baseline = y + line.y + Math.round(story.lineHeight * 0.68);
      line.parts.forEach(({ part, x, w }) => {
        if (part.chip) {
          ctx.fillStyle = theme.ink;
          ctx.fillRect(contentX + x, baseline - Math.round(chipH * 0.72), w, chipH);
          ctx.fillStyle = theme.paper;
          ctx.font = story.chipFont;
          ctx.fillText(part.text, contentX + x + story.pad, baseline);
        } else {
          ctx.fillStyle = theme.ink;
          ctx.font = story.textFont;
          ctx.fillText(part.text, contentX + x, baseline);
        }
      });
    });
    y += story.height + 24;

    // Footer
    ctx.fillStyle = theme.muted;
    ctx.fillRect(contentX, canvas.height - CARD_MARGIN - 54, maxWidth, 1);
    ctx.font = `400 24px ${theme.text}`;
    ctx.fillText('tools.spidleweb.net/madlib-maker', contentX, canvas.height - CARD_MARGIN - 8);
    return canvas;
  }

  async function saveImage(result) {
    if (!result || !result.paragraphs) {
      URLManager.showToast('Finish the story first, then save it as an image.', true);
      return;
    }
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const theme = readTheme();
      try {
        if (document.fonts && document.fonts.load) {
          await Promise.all([
            document.fonts.load(`400 40px ${theme.text}`),
            document.fonts.load(`500 40px ${theme.text}`),
            document.fonts.load(`700 40px ${theme.display}`)
          ]);
        }
      } catch (err) { /* fall back to whatever is loaded */ }

      const canvas = buildCanvas(result, theme);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('No image data');

      const title = result.title || 'Madlib';
      const filename = slugify(result.title) + '.png';
      const file = new File([blob], filename, { type: 'image/png' });

      if (isTouchFirst() && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title });
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
          // Otherwise fall through to a download
        }
      }

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      URLManager.showToast('Image saved');
    } catch (err) {
      URLManager.showToast("Couldn’t save the image. Try again, or use Copy story instead.", true);
    }
  }

  function init() {
    const panel = document.getElementById('share-panel');
    if (panel) buildPanel(panel);

    const saveBtn = document.getElementById('save-image-btn');
    if (saveBtn) {
      saveBtn.hidden = false;
      saveBtn.addEventListener('click', () => {
        if (typeof PlayerMode === 'undefined') return;
        saveImage(PlayerMode.getResult());
      });
    }
  }

  return { init, shareLink, saveImage };
})();
