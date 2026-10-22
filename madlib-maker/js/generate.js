// Generate Module: write a madlib from a prompt with the creator's own Claude or
// OpenAI key. The browser calls the provider directly; there is no server.
// Needs MadlibFormat (core.js), MadlibGenerateFormat (generate-format.js),
// DraftManager and URLManager. Spec: spec/generate-from-prompt.md
const MadlibGenerate = (function() {
  const STORE_KEY = 'madlib-ai-settings';
  const PROMPT_MAX = 500;
  const TIMEOUT_MS = 90000;
  const MAX_TOKENS = 8000;
  const MAX_TOKENS_RETRY = 16000;

  // Error kinds an adapter throws; the UI turns each into one message
  class GenerateError extends Error {
    constructor(kind, detail = {}) {
      super(kind);
      this.kind = kind;
      Object.assign(this, detail);
    }
  }

  // --- Providers ------------------------------------------------------------

  const PROVIDERS = {
    claude: {
      name: 'Claude',
      defaultModel: 'claude-opus-5-5',
      // Shown in the model list even if the models endpoint leaves them out
      suggestedModels: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
      keyLooksRight: key => key.startsWith('sk-ant-'),
      base: 'https://api.anthropic.com/v1',
      headers(key) {
        return {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          // Required for browser calls; the key is the user's own
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json'
        };
      },
      async listModels(key, signal) {
        const data = await request(this, `${this.base}/models?limit=100`, { headers: this.headers(key), signal });
        return (data.data || []).map(model => model.id).filter(Boolean);
      },
      // Models that rejected the effort setting (older ones such as Haiku 4.5),
      // so later requests in this visit leave it out from the start
      noEffort: new Set(),
      async generate({ key, model, system, user, maxTokens, signal }) {
        const send = withEffort => request(this, `${this.base}/messages`, {
          method: 'POST',
          headers: this.headers(key),
          signal,
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: user }],
            output_config: {
              format: { type: 'json_schema', schema: MadlibGenerateFormat.schema() },
              ...(withEffort ? { effort: 'low' } : {})
            }
          })
        });
        let data;
        try {
          data = await send(!this.noEffort.has(model));
        } catch (error) {
          if (error.kind !== 'rejected' || !/effort/i.test(error.message || '')) throw error;
          this.noEffort.add(model);
          data = await send(false);
        }
        if (data.stop_reason === 'refusal') throw new GenerateError('declined');
        const block = (data.content || []).find(part => part.type === 'text');
        return { text: block ? block.text : '', truncated: data.stop_reason === 'max_tokens' };
      }
    },
    openai: {
      name: 'OpenAI',
      // A current model with structured outputs; change here when OpenAI's recommendation moves
      defaultModel: 'gpt-6-astra',
      suggestedModels: [],
      keyLooksRight: key => key.startsWith('sk-') && !key.startsWith('sk-ant-'),
      // One constant, so an OpenAI-compatible endpoint can reuse this adapter later
      base: 'https://api.openai.com/v1',
      headers(key) {
        return { authorization: `Bearer ${key}`, 'content-type': 'application/json' };
      },
      async listModels(key, signal) {
        const data = await request(this, `${this.base}/models`, { headers: this.headers(key), signal });
        // The endpoint also lists audio, image and embedding models; keep chat-like ones
        const notChat = /(embed|whisper|tts|dall-e|image|audio|realtime|transcribe|moderation|search|babbage|davinci)/i;
        return (data.data || []).map(model => model.id).filter(id => id && !notChat.test(id)).sort().reverse();
      },
      async generate({ key, model, system, user, maxTokens, signal }) {
        const data = await request(this, `${this.base}/chat/completions`, {
          method: 'POST',
          headers: this.headers(key),
          signal,
          body: JSON.stringify({
            model,
            max_completion_tokens: maxTokens,
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'madlib', strict: true, schema: MadlibGenerateFormat.schema() }
            }
          })
        });
        const choice = (data.choices || [])[0] || {};
        const message = choice.message || {};
        if (message.refusal) throw new GenerateError('declined');
        return { text: message.content || '', truncated: choice.finish_reason === 'length' };
      }
    }
  };

  // fetch with errors sorted into kinds the UI can explain
  async function request(provider, url, options) {
    let response;
    try {
      response = await fetch(url, options);
    } catch (e) {
      if (e && e.name === 'AbortError') throw new GenerateError('aborted');
      // A TypeError covers offline, DNS and CORS failures; the browser won't say which
      throw new GenerateError('network');
    }

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      if (e && e.name === 'AbortError') throw new GenerateError('aborted');
      data = null;
    }
    if (response.ok) return data || {};

    const error = (data && data.error) || {};
    const text = `${error.type || ''} ${error.code || ''} ${error.message || ''}`;
    const status = response.status;
    if (status === 401) throw new GenerateError('key');
    if (status === 403 || status === 404) throw new GenerateError('model');
    if (status === 429 && /insufficient_quota|billing|credit/i.test(text)) throw new GenerateError('credit');
    if (status === 429) {
      const seconds = parseInt(response.headers.get('retry-after') || '', 10);
      throw new GenerateError('busy', { retryAfter: Number.isFinite(seconds) ? seconds : null });
    }
    // Anthropic reports an empty balance as a 400
    if (status === 400 && /credit balance/i.test(text)) throw new GenerateError('credit');
    // An effort rejection is retried without it (see the Claude adapter), so
    // keep it apart from the model-can't-do-this case below
    if (status === 400 && /effort/i.test(text)) {
      throw new GenerateError('rejected', { message: error.message || 'effort is not supported' });
    }
    // A model without structured outputs (or another feature this needs) answers 400
    if (status === 400 && /output_config|output_format|json_schema|response_format|structured/i.test(text)) {
      throw new GenerateError('unsupported');
    }
    if (status >= 500) throw new GenerateError('provider');
    throw new GenerateError('rejected', { message: error.message || `Request failed (${status})` });
  }

  function errorMessage(error, settings) {
    const provider = PROVIDERS[settings.provider].name;
    const model = settings.models[settings.provider];
    switch (error && error.kind) {
      case 'key': return "That key didn't work. Check it in AI settings.";
      case 'model': return `Your key can't use ${model}. Pick another model in AI settings.`;
      case 'unsupported': return `${model} can't write madlibs in the format this needs. Pick a newer model in AI settings.`;
      case 'credit': return `Your ${provider} account is out of credit.`;
      case 'busy':
        return error.retryAfter
          ? `${provider} is busy. Try again in ${error.retryAfter} second${error.retryAfter === 1 ? '' : 's'}.`
          : `${provider} is busy. Try again in a few seconds.`;
      case 'provider': return `${provider} is having trouble. Try again shortly.`;
      case 'declined': return 'The model declined that prompt. Try a different idea.';
      case 'rejected': return `${provider} couldn't use that request: ${error.message}`;
      default: return `Couldn't reach ${provider}. Check your connection and try again.`;
    }
  }

  // --- Settings -------------------------------------------------------------

  // Where settings live: localStorage when remembered, sessionStorage when not,
  // and only this variable when the browser blocks storage. The key is never
  // written anywhere else (library, share links, logs).
  let memorySettings = null;
  let storageBlocked = false;

  function defaults() {
    return {
      provider: 'claude',
      remember: true,
      keys: { claude: '', openai: '' },
      models: { claude: PROVIDERS.claude.defaultModel, openai: PROVIDERS.openai.defaultModel }
    };
  }

  function normalizeSettings(raw) {
    const base = defaults();
    if (!raw || typeof raw !== 'object') return base;
    const provider = PROVIDERS[raw.provider] ? raw.provider : base.provider;
    const keys = { ...base.keys };
    const models = { ...base.models };
    Object.keys(PROVIDERS).forEach(id => {
      if (raw.keys && typeof raw.keys[id] === 'string') keys[id] = raw.keys[id];
      if (raw.models && typeof raw.models[id] === 'string' && raw.models[id].trim()) models[id] = raw.models[id].trim();
    });
    return { provider, remember: raw.remember !== false, keys, models };
  }

  function readStore(store) {
    try {
      const raw = window[store].getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function loadSettings() {
    if (memorySettings) return normalizeSettings(memorySettings);
    return normalizeSettings(readStore('localStorage') || readStore('sessionStorage'));
  }

  function saveSettings(settings) {
    const clean = normalizeSettings(settings);
    const keep = clean.remember ? 'localStorage' : 'sessionStorage';
    const drop = clean.remember ? 'sessionStorage' : 'localStorage';
    try {
      window[keep].setItem(STORE_KEY, JSON.stringify(clean));
      try { window[drop].removeItem(STORE_KEY); } catch (e) { /* nothing to remove */ }
      memorySettings = null;
      storageBlocked = false;
    } catch (e) {
      memorySettings = clean;
      storageBlocked = true;
    }
    return clean;
  }

  function probeStorage() {
    try {
      const test = `${STORE_KEY}-probe`;
      window.localStorage.setItem(test, '1');
      window.localStorage.removeItem(test);
      return false;
    } catch (e) {
      return true;
    }
  }

  // Pasted keys often carry spaces, quotes or a "Bearer " prefix
  function cleanKey(raw) {
    return String(raw || '')
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^bearer\s+/i, '')
      .trim();
  }

  // --- DOM helpers ----------------------------------------------------------

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(className, text, onClick) {
    const node = el('button', className, text);
    node.type = 'button';
    if (onClick) node.addEventListener('click', onClick);
    return node;
  }

  let idCount = 0;
  function uid(name) {
    idCount++;
    return `gen-${name}-${idCount}`;
  }

  function field(labelText, control) {
    const wrap = el('div', 'gen-field');
    const label = el('label', 'gen-label', labelText);
    if (!control.id) control.id = uid('field');
    label.htmlFor = control.id;
    wrap.append(label, control);
    return wrap;
  }

  // A row of radio buttons styled as a segmented control (arrow keys work natively)
  function segmented(legendText, name, options, onChange) {
    const fieldset = el('fieldset', 'gen-field gen-segmented');
    fieldset.append(el('legend', 'gen-label', legendText));
    const row = el('div', 'gen-segments');
    const inputs = {};
    options.forEach(([value, text, detail]) => {
      const label = el('label', 'gen-segment');
      const input = el('input');
      input.type = 'radio';
      input.name = name;
      input.value = value;
      input.addEventListener('change', () => { if (input.checked) onChange(value); });
      inputs[value] = input;
      const face = el('span', 'gen-segment-text');
      face.append(el('span', 'gen-segment-label', text));
      if (detail) face.append(el('span', 'gen-segment-detail', detail));
      label.append(input, face);
      row.appendChild(label);
    });
    fieldset.appendChild(row);
    return {
      node: fieldset,
      inputs,
      set(value) { Object.keys(inputs).forEach(key => { inputs[key].checked = key === value; }); },
      get() { return Object.keys(inputs).find(key => inputs[key].checked); },
      setDisabled(disabled) { fieldset.disabled = disabled; }
    };
  }

  function dialogShell(titleText, className) {
    const dialog = el('dialog', `mm-dialog gen-dialog ${className}`);
    const titleId = uid('title');
    dialog.setAttribute('aria-labelledby', titleId);
    const header = el('div', 'mm-dialog-header');
    const title = el('h2', 'mm-dialog-title', titleText);
    title.id = titleId;
    const close = button('mm-dialog-close', 'Close', () => closeDialog(dialog));
    header.append(title, close);
    const body = el('div', 'mm-dialog-body gen-body');
    dialog.append(header, body);
    document.body.appendChild(dialog);
    return { dialog, body, close };
  }

  function openDialog(dialog) {
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    }
  }

  function setMessage(node, text, tone) {
    node.textContent = text || '';
    node.hidden = !text;
    node.classList.toggle('is-error', tone === 'error');
    node.classList.toggle('is-ok', tone === 'ok');
  }

  // --- AI settings dialog ---------------------------------------------------

  const ui = {};
  let draft = null; // settings being edited in the dialog, per provider

  function buildSettings() {
    const shell = dialogShell('AI settings', 'gen-settings-dialog');
    ui.settings = shell.dialog;

    ui.provider = segmented('Provider', uid('provider'), [['claude', 'Claude'], ['openai', 'OpenAI']], switchProvider);

    ui.key = el('input', 'gen-input');
    ui.key.type = 'password';
    ui.key.placeholder = 'Enter your API key';
    ui.key.autocomplete = 'off';
    ui.key.spellcheck = false;
    ui.key.setAttribute('autocapitalize', 'off');
    ui.key.addEventListener('input', () => {
      setMessage(ui.keyStatus, '');
      showKeyWarning();
      // A different key may see different models
      ui.modelsFor = null;
    });
    const keyField = field('API key', ui.key);
    // Check sits right beside the key it checks
    ui.checkKey = button('gen-btn gen-row-btn', 'Check', checkKey);
    ui.checkKey.setAttribute('aria-label', 'Check key');
    const keyRow = el('div', 'gen-input-row');
    keyRow.append(ui.key, ui.checkKey);
    keyField.appendChild(keyRow);
    ui.keyStatus = el('p', 'gen-inline-status');
    ui.keyStatus.setAttribute('role', 'status');
    ui.keyStatus.hidden = true;
    ui.key.setAttribute('aria-describedby', (ui.keyStatus.id = uid('key-status')));
    keyField.appendChild(ui.keyStatus);

    ui.model = el('input', 'gen-input');
    ui.model.type = 'text';
    ui.model.autocomplete = 'off';
    ui.model.spellcheck = false;
    ui.model.setAttribute('autocapitalize', 'off');
    ui.model.addEventListener('input', markSelectedModel);
    const modelField = field('Model', ui.model);
    // A dropdown of the provider's models: loads on first open, closes on pick
    ui.loadModels = button('gen-btn gen-row-btn gen-dropdown-btn', 'Models', toggleModels);
    ui.loadModels.setAttribute('aria-expanded', 'false');
    ui.modelList = el('div', 'gen-model-list');
    ui.modelList.id = uid('models');
    ui.modelList.setAttribute('role', 'group');
    ui.modelList.setAttribute('aria-label', 'Models');
    ui.modelList.hidden = true;
    ui.loadModels.setAttribute('aria-controls', ui.modelList.id);
    ui.modelList.addEventListener('keydown', onModelListKey);
    const modelRow = el('div', 'gen-input-row');
    modelRow.append(ui.model, ui.loadModels);
    ui.modelStatus = el('p', 'gen-inline-status');
    ui.modelStatus.setAttribute('role', 'status');
    ui.modelStatus.hidden = true;
    modelField.append(modelRow, ui.modelList, ui.modelStatus);

    const rememberLabel = el('label', 'gen-check');
    ui.remember = el('input', 'gen-check-input');
    ui.remember.type = 'checkbox';
    ui.remember.addEventListener('change', updateNote);
    rememberLabel.append(ui.remember, el('span', 'gen-check-box'), el('span', 'gen-check-text', 'Remember on this device'));

    ui.settingsStatus = el('p', 'gen-inline-status');
    ui.settingsStatus.setAttribute('role', 'status');
    ui.settingsStatus.hidden = true;

    ui.note = el('p', 'gen-note');

    const actions = el('div', 'gen-actions gen-actions-end');
    ui.forgetKey = button('gen-btn', 'Forget key', forgetKey);
    ui.save = button('gen-btn gen-btn-primary', 'Save', saveFromDialog);
    actions.append(ui.forgetKey, ui.save);

    shell.body.append(ui.provider.node, keyField, modelField, rememberLabel, ui.settingsStatus, ui.note, actions);

    // Enter in a text field saves, like a form
    [ui.key, ui.model].forEach(input => input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveFromDialog();
      }
    }));

    // The close event fires asynchronously, possibly after the dialog has been
    // reopened, so it only cancels pending checks; openSettings resets the draft
    ui.settings.addEventListener('close', () => settingsJob.abort());
  }

  // One pending check or model load at a time; closing the dialog cancels it
  const settingsJob = {
    controller: null,
    start() {
      this.abort();
      this.controller = new AbortController();
      return this.controller.signal;
    },
    abort() {
      if (this.controller) this.controller.abort();
      this.controller = null;
    }
  };

  function provider() {
    return PROVIDERS[draft.provider];
  }

  function stashFields() {
    draft.keys[draft.provider] = cleanKey(ui.key.value);
    draft.models[draft.provider] = ui.model.value.trim() || provider().defaultModel;
  }

  function fillFields() {
    ui.provider.set(draft.provider);
    ui.key.value = draft.keys[draft.provider] || '';
    ui.model.value = draft.models[draft.provider] || provider().defaultModel;
    ui.remember.checked = draft.remember;
    ui.modelList.replaceChildren();
    ui.modelsFor = null;
    showModels(false);
    setMessage(ui.keyStatus, '');
    setMessage(ui.modelStatus, '');
    setMessage(ui.settingsStatus, storageBlocked ? "Your key won't be remembered in this browser." : '');
    setBusy(ui.checkKey, false, 'Check');
    setBusy(ui.loadModels, false, 'Models');
    showKeyWarning();
    updateNote();
    updateForget();
  }

  function switchProvider(value) {
    settingsJob.abort();
    stashFields();
    draft.provider = value;
    fillFields();
  }

  function showKeyWarning() {
    const key = cleanKey(ui.key.value);
    if (key && !provider().keyLooksRight(key)) {
      setMessage(ui.keyStatus, `This doesn't look like a ${provider().name} key.`);
    } else if (ui.keyStatus.textContent.startsWith("This doesn't look like")) {
      setMessage(ui.keyStatus, '');
    }
  }

  function updateNote() {
    const name = provider().name;
    ui.note.textContent = ui.remember.checked
      ? `Your key is stored in this browser and sent only to ${name}. It's never included in share links. Use a key with a spend limit.`
      : `Your key is sent only to ${name}. It's never included in share links. Use a key with a spend limit.`;
  }

  // Forget only makes sense for a key that's actually saved
  function updateForget() {
    const saved = loadSettings();
    ui.forgetKey.hidden = !saved.keys[draft.provider];
  }

  function setBusy(node, busy, idleText, busyText) {
    node.disabled = busy;
    node.textContent = busy ? busyText : idleText;
    node.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  async function checkKey() {
    const key = cleanKey(ui.key.value);
    if (!key) {
      setMessage(ui.keyStatus, 'Enter your API key first.', 'error');
      ui.key.focus();
      return;
    }
    const current = provider();
    const signal = settingsJob.start();
    setBusy(ui.checkKey, true, 'Check', 'Checking…');
    setMessage(ui.keyStatus, '');
    try {
      await current.listModels(key, signal);
      setMessage(ui.keyStatus, 'Key works', 'ok');
    } catch (error) {
      if (error.kind === 'aborted') return;
      // The generic key message ends "Check it in AI settings", which is where we are
      const message = error.kind === 'key'
        ? "That key didn't work."
        : errorMessage(error, { provider: draft.provider, models: draft.models });
      setMessage(ui.keyStatus, message, 'error');
    } finally {
      if (ui.settings.open) setBusy(ui.checkKey, false, 'Check');
    }
  }

  function showModels(open) {
    ui.modelList.hidden = !open;
    ui.loadModels.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  // The Models button: load the list the first time, then open or close it
  async function toggleModels() {
    if (!ui.modelList.hidden) {
      showModels(false);
      return;
    }
    if (ui.modelsFor === draft.provider && ui.modelList.children.length) {
      openModelList();
      return;
    }
    const key = cleanKey(ui.key.value);
    if (!key) {
      setMessage(ui.modelStatus, 'Enter your API key to see the models.', 'error');
      ui.key.focus();
      return;
    }
    const current = provider();
    const forProvider = draft.provider;
    const signal = settingsJob.start();
    setBusy(ui.loadModels, true, 'Models', 'Loading…');
    setMessage(ui.modelStatus, '');
    try {
      const listed = await current.listModels(key, signal);
      renderModels([...new Set([...current.suggestedModels, ...listed])]);
      ui.modelsFor = forProvider;
      openModelList();
    } catch (error) {
      if (error.kind === 'aborted') return;
      setMessage(ui.modelStatus, errorMessage(error, { provider: draft.provider, models: draft.models }), 'error');
    } finally {
      if (ui.settings.open) setBusy(ui.loadModels, false, 'Models');
    }
  }

  function openModelList() {
    showModels(true);
    const target = ui.modelList.querySelector('.is-selected') || ui.modelList.firstElementChild;
    if (target) {
      target.focus();
      target.scrollIntoView({ block: 'nearest' });
    }
  }

  function pickModel(id) {
    ui.model.value = id;
    markSelectedModel();
    showModels(false);
    ui.loadModels.focus();
  }

  // Arrow keys move through the list; Escape closes it without closing the dialog
  function onModelListKey(e) {
    const rows = [...ui.modelList.querySelectorAll('.gen-model')];
    const index = rows.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = rows[Math.max(0, Math.min(rows.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)))];
      if (next) next.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      showModels(false);
      ui.loadModels.focus();
    }
  }

  function renderModels(ids) {
    ui.modelList.replaceChildren(...ids.map(id => {
      const row = button('gen-model', id, () => pickModel(id));
      row.dataset.model = id;
      row.title = id;
      return row;
    }));
    markSelectedModel();
  }

  function markSelectedModel() {
    const value = ui.model.value.trim();
    ui.modelList.querySelectorAll('.gen-model').forEach(row => {
      const selected = row.dataset.model === value;
      row.classList.toggle('is-selected', selected);
      row.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function forgetKey() {
    settingsJob.abort();
    const saved = loadSettings();
    saved.keys[draft.provider] = '';
    saveSettings(saved);
    draft.keys[draft.provider] = '';
    ui.key.value = '';
    setMessage(ui.keyStatus, 'Key forgotten.', 'ok');
    updateForget();
    ui.key.focus();
  }

  function saveFromDialog() {
    stashFields();
    draft.remember = ui.remember.checked;
    if (!draft.keys[draft.provider]) {
      setMessage(ui.keyStatus, 'Enter your API key to save.', 'error');
      ui.key.focus();
      return;
    }
    saveSettings(draft);
    if (storageBlocked) {
      // Settings still work for this visit; say so where the user will see it
      URLManager.showToast("Your key won't be remembered in this browser.");
    }
    closeDialog(ui.settings);
    openGenerate();
  }

  function openSettings() {
    if (!ui.settings) buildSettings();
    if (ui.generate && ui.generate.open) closeDialog(ui.generate);
    draft = loadSettings();
    if (!memorySettings && probeStorage()) storageBlocked = true;
    fillFields();
    openDialog(ui.settings);
    (ui.key.value ? ui.model : ui.key).focus();
  }

  // --- Generate dialog ------------------------------------------------------

  let job = null; // the running generation: { controller, reason }

  function buildGenerate() {
    const shell = dialogShell('Generate a madlib', 'gen-generate-dialog');
    ui.generate = shell.dialog;

    ui.prompt = el('textarea', 'gen-input gen-prompt');
    ui.prompt.maxLength = PROMPT_MAX;
    ui.prompt.rows = 4;
    ui.prompt.placeholder = "A pirate's first day at school";
    ui.prompt.required = true;
    ui.prompt.addEventListener('input', updatePromptState);
    const promptField = field('Prompt (required)', ui.prompt);
    ui.count = el('p', 'gen-count');
    ui.count.id = uid('count');
    ui.prompt.setAttribute('aria-describedby', ui.count.id);
    promptField.appendChild(ui.count);

    // Each length shows roughly how long the story is and how many blanks it has
    const sizes = MadlibGenerateFormat.LENGTHS;
    const lengthOption = (value, text) => [value, text, `~${sizes[value].words} words · ${sizes[value].target} blanks`];
    ui.length = segmented('Length', uid('length'), [
      lengthOption('short', 'Short'), lengthOption('medium', 'Medium'), lengthOption('long', 'Long')
    ], () => {});

    // Settings group: the switch shows on/off itself, so the line under the
    // label says what turning it on means
    const settingsGroup = el('div', 'gen-field gen-settings-group');
    const settingsLabel = el('p', 'gen-label', 'Settings');
    settingsLabel.id = uid('settings-label');
    settingsGroup.setAttribute('role', 'group');
    settingsGroup.setAttribute('aria-labelledby', settingsLabel.id);
    const humor = el('label', 'gen-switch');
    ui.humor = el('input', 'gen-switch-input');
    ui.humor.type = 'checkbox';
    ui.humor.setAttribute('role', 'switch');
    const humorText = el('span', 'gen-switch-text');
    const humorHint = el('span', 'gen-switch-state', 'Jokes for teens and grown-ups instead of little kids. Never explicit.');
    humorHint.id = uid('humor-hint');
    ui.humor.setAttribute('aria-describedby', humorHint.id);
    humorText.append(el('span', 'gen-switch-label', 'Grown-up humor'), humorHint);
    humor.append(ui.humor, el('span', 'gen-switch-track'), humorText);
    settingsGroup.append(settingsLabel, humor);

    ui.progress = el('p', 'gen-progress', 'Generating your madlib… This can take 5–30 seconds.');
    ui.progress.setAttribute('role', 'status');
    ui.progress.hidden = true;

    ui.error = el('div', 'gen-error');
    ui.error.setAttribute('role', 'alert');
    ui.error.hidden = true;

    ui.partial = el('div', 'gen-partial');
    ui.partial.hidden = true;

    const footer = el('div', 'gen-actions gen-actions-split');
    ui.settingsLink = button('gen-link', 'AI settings', openSettings);
    const end = el('div', 'gen-actions');
    ui.cancel = button('gen-btn', 'Cancel', () => stopJob('cancel'));
    ui.cancel.hidden = true;
    ui.run = button('gen-btn gen-btn-primary', 'Generate', runGenerate);
    end.append(ui.cancel, ui.run);
    footer.append(ui.settingsLink, end);

    shell.body.append(promptField, ui.length.node, settingsGroup, ui.progress, ui.error, ui.partial, footer);

    // Cmd/Ctrl+Enter in the prompt generates
    ui.prompt.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        runGenerate();
      }
    });

    // Closing (Close button or Escape) stops a running request; nothing is saved
    ui.generate.addEventListener('close', () => stopJob('cancel'));

    ui.length.set('medium');
  }

  function updatePromptState() {
    const length = ui.prompt.value.length;
    ui.count.textContent = `${length} / ${PROMPT_MAX} characters`;
    ui.run.disabled = !!job || !ui.prompt.value.trim();
  }

  function showError(text) {
    ui.partial.hidden = true;
    setMessage(ui.error, text, 'error');
  }

  function clearResults() {
    ui.error.hidden = true;
    ui.partial.hidden = true;
    ui.partial.replaceChildren();
  }

  function showPartial(result) {
    ui.error.hidden = true;
    const list = el('ul', 'gen-partial-list');
    result.errors.forEach(text => list.appendChild(el('li', null, text)));
    const open = button('gen-btn', 'Open anyway', () => finish(result));
    ui.partial.replaceChildren(el('p', 'gen-partial-title', 'This madlib needs a few fixes.'), list, open);
    ui.partial.hidden = false;
    open.focus();
  }

  function setGenerating(on) {
    ui.prompt.disabled = on;
    ui.length.setDisabled(on);
    ui.humor.disabled = on;
    ui.settingsLink.disabled = on;
    ui.progress.hidden = !on;
    ui.cancel.hidden = !on;
    ui.run.textContent = on ? 'Generating…' : 'Generate';
    ui.run.setAttribute('aria-busy', on ? 'true' : 'false');
    ui.generate.classList.toggle('is-generating', on);
    updatePromptState();
  }

  function stopJob(reason) {
    if (!job) return;
    job.reason = reason;
    job.controller.abort();
  }

  async function runGenerate() {
    if (job) return; // one request at a time
    const prompt = ui.prompt.value.trim();
    if (!prompt) {
      ui.prompt.focus();
      return;
    }
    const settings = loadSettings();
    const key = settings.keys[settings.provider];
    if (!key) {
      openSettings();
      return;
    }

    const current = PROVIDERS[settings.provider];
    const length = ui.length.get() || 'medium';
    const grownUp = ui.humor.checked;
    const system = MadlibGenerateFormat.systemPrompt(grownUp);

    job = { controller: new AbortController(), reason: null };
    const timer = setTimeout(() => stopJob('timeout'), TIMEOUT_MS);
    clearResults();
    setGenerating(true);

    try {
      let retryErrors = [];
      let maxTokens = MAX_TOKENS;
      let result = null;
      // One retry at most: each attempt costs the user money
      for (let attempt = 0; attempt < 2; attempt++) {
        const answer = await current.generate({
          key,
          model: settings.models[settings.provider],
          system,
          user: MadlibGenerateFormat.userMessage({ prompt, length, retryErrors }),
          maxTokens,
          signal: job.controller.signal
        });
        result = MadlibGenerateFormat.process(answer.text, { prompt, length, truncated: answer.truncated });
        if (!result.errors.length) break;
        retryErrors = result.errors;
        if (answer.truncated) maxTokens = MAX_TOKENS_RETRY;
      }

      if (!result.errors.length) {
        finish(result);
      } else if (result.story) {
        showPartial(result);
      } else {
        showError("The model's answer couldn't be turned into a madlib. Try again, or try a different prompt.");
      }
    } catch (error) {
      if (error.kind === 'aborted' && job.reason === 'cancel') {
        // Cancelled on purpose: no message
      } else if (error.kind === 'aborted') {
        showError(errorMessage({ kind: 'network' }, settings));
      } else {
        showError(errorMessage(error, settings));
      }
    } finally {
      clearTimeout(timer);
      job = null;
      if (ui.generate.open) {
        setGenerating(false);
        if (!ui.error.hidden) ui.run.focus();
      } else {
        setGenerating(false);
      }
    }
  }

  // Open the result as a new madlib; the one that was open stays in My madlibs
  function finish(result) {
    const opened = DraftManager.openAsNew({
      v: MadlibFormat.VERSION,
      title: result.title,
      subtitle: result.subtitle,
      story: result.story
    });
    if (!opened) {
      showError("Couldn't open the madlib. Your browser's storage may be full or turned off.");
      return;
    }
    closeDialog(ui.generate);
    URLManager.showToast('Generated. Check the blanks before sharing.');
  }

  function openGenerate() {
    if (!ui.generate) buildGenerate();
    clearResults();
    updatePromptState();
    openDialog(ui.generate);
    ui.prompt.focus();
  }

  // --- Entry point ----------------------------------------------------------

  function editorHasContent() {
    return !!(StoryEditor.getStory().trim() || MetadataManager.getRawTitle().trim() || MetadataManager.getSubtitle().trim());
  }

  // Generating opens a new madlib in the editor. When something is already
  // there, say where it goes before going on.
  function buildConfirm() {
    const shell = dialogShell('Start a new madlib?', 'gen-confirm-dialog');
    ui.confirm = shell.dialog;
    const text = el('p', 'gen-confirm-text', "The generated madlib opens in the editor in place of this one. This one stays saved in My madlibs.");
    const actions = el('div', 'gen-actions gen-actions-end');
    const cancel = button('gen-btn', 'Cancel', () => closeDialog(ui.confirm));
    ui.confirmGo = button('gen-btn gen-btn-primary', 'Continue', () => {
      closeDialog(ui.confirm);
      startGenerate();
    });
    actions.append(cancel, ui.confirmGo);
    shell.body.append(text, actions);
  }

  function startGenerate() {
    const settings = loadSettings();
    if (settings.keys[settings.provider]) {
      openGenerate();
    } else {
      openSettings();
    }
  }

  function handleGenerateClick() {
    if (!editorHasContent()) {
      startGenerate();
      return;
    }
    if (!ui.confirm) buildConfirm();
    openDialog(ui.confirm);
    ui.confirmGo.focus();
  }

  function init() {
    const trigger = document.getElementById('generate-btn');
    if (!trigger || typeof MadlibGenerateFormat === 'undefined' || typeof DraftManager.openAsNew !== 'function') return;
    trigger.hidden = false;
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.addEventListener('click', handleGenerateClick);
    trigger.closest('#story-editor-section')?.classList.add('has-generate');

    // While the story is empty, a hint under the placeholder offers the same thing
    const hint = document.getElementById('generate-hint');
    if (hint) {
      hint.setAttribute('aria-haspopup', 'dialog');
      hint.addEventListener('click', handleGenerateClick);
      const sync = () => { hint.hidden = !!StoryEditor.getStory().trim(); };
      document.addEventListener('madlib:storychange', sync);
      sync();
    }

    // Leaving the page mid-request: stop it so nothing half-finished is saved
    window.addEventListener('pagehide', () => stopJob('cancel'));
  }

  return { init };
})();
