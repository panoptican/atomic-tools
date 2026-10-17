// Paper versions: a fill-in worksheet and a finished-story page
const MadlibPrint = (function() {
  let root = null;
  let cleanupTimer = null;

  function getRoot() {
    if (!root) {
      root = document.createElement('div');
      root.id = 'print-root';
      root.className = 'print-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function cleanup() {
    clearTimeout(cleanupTimer);
    document.documentElement.classList.remove('is-printing');
    if (root) root.innerHTML = '';
  }

  function print(html) {
    const el = getRoot();
    el.innerHTML = html;
    document.documentElement.classList.add('is-printing');
    window.addEventListener('afterprint', cleanup, { once: true });
    // Fallback for browsers that never fire afterprint
    clearTimeout(cleanupTimer);
    cleanupTimer = setTimeout(cleanup, 60000);
    // Let the layout settle before the dialog opens
    requestAnimationFrame(() => window.print());
  }

  function headerHtml(title, subtitle) {
    return `
      <header class="print-head">
        <h1 class="print-title">${escapeHtml(title || 'My Madlib')}</h1>
        ${subtitle ? `<p class="print-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      </header>`;
  }

  function joinSteps(steps, renderStep) {
    return steps.map((step, i) => {
      const sep = i === 0 ? '' : (step.lineBreakBefore ? '<br>' : ' ');
      return sep + renderStep(step);
    }).join('');
  }

  function printWorksheet(madlib) {
    const data = madlib || URLManager.collectData();
    const story = (data && data.story) || '';
    const { prompts } = MadlibFormat.parse(story);
    if (!prompts.length) {
      URLManager.showToast('Add at least one blank first.', true);
      return;
    }

    const numbers = new Map(prompts.map((p, i) => [p.key, i + 1]));

    const items = prompts.map((prompt, i) => `
      <li class="print-prompt">
        <span class="print-prompt-num">${i + 1}.</span>
        <span class="print-prompt-body">
          <span class="print-prompt-line"></span>
          <span class="print-prompt-label">${escapeHtml(MadlibFormat.promptText(prompt))}</span>
        </span>
      </li>`).join('');

    const paragraphs = MadlibFormat.toSteps(story).map(paragraph => {
      const html = joinSteps(paragraph, step => step.pieces.map(piece => {
        if (piece.text !== undefined) return escapeHtml(piece.text);
        const token = piece.token;
        return `<span class="print-gap"><sup class="print-gap-num">${numbers.get(token.key)}</sup><span class="print-gap-type">${escapeHtml(token.type)}</span></span>`;
      }).join(''));
      return `<p>${html}</p>`;
    }).join('');

    print(`
      <div class="print-sheet print-worksheet">
        ${headerHtml(data.title, data.subtitle)}
        <p class="print-meta"><span>Name: <i class="print-meta-line"></i></span><span>Date: <i class="print-meta-line"></i></span></p>
        <section class="print-section">
          <h2 class="print-heading">Fill these in first</h2>
          <ol class="print-prompts${prompts.length > 8 ? ' is-two-col' : ''}">${items}</ol>
        </section>
        <section class="print-section print-story-section">
          <h2 class="print-heading">Then read the story</h2>
          <div class="print-story">${paragraphs}</div>
        </section>
      </div>`);
  }

  function printStory(result) {
    if (!result || !result.paragraphs || !result.paragraphs.length) {
      URLManager.showToast('Nothing to print yet.', true);
      return;
    }
    const paragraphs = result.paragraphs.map(paragraph => {
      const html = joinSteps(paragraph, step => step.runs.map(run => (
        run.answer !== undefined
          ? `<strong class="print-answer">${escapeHtml(run.answer)}</strong>`
          : escapeHtml(run.text)
      )).join(''));
      return `<p>${html}</p>`;
    }).join('');

    print(`
      <div class="print-sheet print-finished">
        ${headerHtml(result.title, result.subtitle)}
        <div class="print-story">${paragraphs}</div>
        <footer class="print-footer">Made with Madlib Maker</footer>
      </div>`);
  }

  function init() {
    const slot = document.getElementById('print-sheet-slot');
    if (slot && !slot.firstChild) {
      slot.className = 'print-sheet-slot';
      slot.innerHTML = `
        <button type="button" class="share-btn share-btn-secondary" id="print-worksheet-btn">Print worksheet</button>
        <p class="print-sheet-hint">A paper version to fill in with a pencil.</p>`;
      slot.querySelector('button').addEventListener('click', () => printWorksheet());
    }

    const storyBtn = document.getElementById('print-story-btn');
    if (storyBtn) {
      storyBtn.hidden = false;
      storyBtn.addEventListener('click', () => printStory(PlayerMode.getResult()));
    }
  }

  return { init, printWorksheet, printStory };
})();
