/**
 * Markdown ↔ Rich Text — conversion, detection, clipboard helpers.
 * Depends on TurndownService, turndownPluginGfm, markdownit (CDN).
 */
(function (global) {
  'use strict';

  var convertersReady = Boolean(
    global.TurndownService && global.turndownPluginGfm && global.markdownit
  );
  var turndown = null;
  var mdi = null;

  var SEMANTIC_TAGS =
    /<(h[1-6]|ul|ol|li|table|thead|tbody|tr|th|td|strong|em|del|blockquote|pre|code|a\s|img\s|hr)[^>]*>/i;
  var MSO_PATTERNS = /(?:mso-|class="Mso|MsoListParagraph|MsoNormal)/i;
  var SHEETS_PATTERNS = /(?:google-sheets-html-origin|data-sheets-)/i;

  function getAlignment(node) {
    var style = node.getAttribute('style') || '';
    var align = node.getAttribute('align') || '';
    var match = style.match(/text-align\s*:\s*(left|center|right)/i);
    var val = match ? match[1].toLowerCase() : align.toLowerCase();
    return val || 'left';
  }

  function escapePipes(text) {
    return text.replace(/\|/g, '\\|');
  }

  function initConverters() {
    if (!convertersReady || turndown) return;

    turndown = new global.TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
      strongDelimiter: '**',
      hr: '---'
    });
    turndown.use(global.turndownPluginGfm.gfm);

    turndown.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: function (content) {
        return '~~' + content + '~~';
      }
    });

    turndown.addRule('fencedCodeBlock', {
      filter: function (node) {
        return node.nodeName === 'PRE' && node.firstChild && node.firstChild.nodeName === 'CODE';
      },
      replacement: function (_content, node) {
        var code = node.firstChild;
        var className = code.getAttribute('class') || '';
        var langMatch = className.match(/(?:lang(?:uage)?|highlight)-(\w+)/);
        var lang = langMatch ? langMatch[1] : '';
        var text = code.textContent || '';
        return '\n```' + lang + '\n' + text + '\n```\n';
      }
    });

    turndown.addRule('styledBold', {
      filter: function (node) {
        if (node.nodeName !== 'SPAN') return false;
        var style = node.getAttribute('style') || '';
        return /font-weight\s*:\s*(bold|[7-9]\d{2})/i.test(style);
      },
      replacement: function (content) {
        return '**' + content + '**';
      }
    });

    turndown.addRule('styledItalic', {
      filter: function (node) {
        if (node.nodeName !== 'SPAN') return false;
        var style = node.getAttribute('style') || '';
        return (
          /font-style\s*:\s*italic/i.test(style) &&
          !/font-weight\s*:\s*(bold|[7-9]\d{2})/i.test(style)
        );
      },
      replacement: function (content) {
        return '*' + content + '*';
      }
    });

    turndown.addRule('table', {
      filter: 'table',
      replacement: function (_content, node) {
        var rows = Array.from(node.querySelectorAll('tr'));
        if (rows.length === 0) return '';
        var result = '';
        for (var i = 0; i < rows.length; i++) {
          var cells = Array.from(rows[i].querySelectorAll('th, td'));
          var isHeader = cells.length > 0 && cells[0].nodeName === 'TH';
          var cellTexts = cells.map(function (c) {
            return ' ' + escapePipes((c.textContent || '').trim().replace(/\n+/g, ' ')) + ' ';
          });
          result += '|' + cellTexts.join('|') + '|\n';
          if (isHeader) {
            var sep = cells.map(function (cell) {
              var a = getAlignment(cell);
              return a === 'center' ? ' :---: ' : a === 'right' ? ' ---: ' : ' --- ';
            }).join('|');
            result += '|' + sep + '|\n';
          }
        }
        return '\n' + result + '\n';
      }
    });

    mdi = global.markdownit({ html: false, linkify: true, typographer: false, breaks: false });
  }

  initConverters();

  function detectDirection(htmlData, textData) {
    if (
      htmlData &&
      (SEMANTIC_TAGS.test(htmlData) || MSO_PATTERNS.test(htmlData) || SHEETS_PATTERNS.test(htmlData))
    ) {
      return 'html-to-md';
    }
    if (textData) return 'md-to-html';
    return null;
  }

  function preProcessHtml(html) {
    var c = html;
    c = c.replace(/<!(--\[if[\s\S]*?\[endif\]--|--[\s\S]*?--)>/gi, '');
    c = c.replace(/<!\[if !supportLists\]>[\s\S]*?<!\[endif\]>/gi, '');
    c = c.replace(/<meta[^>]*>/gi, '');
    c = c.replace(/<style[\s\S]*?<\/style>/gi, '');
    c = c.replace(/<xml[\s\S]*?<\/xml>/gi, '');
    c = c.replace(/<o:p>[\s\S]*?<\/o:p>/gi, '');
    c = c.replace(/<\/?ac:[^>]*>/gi, '');
    c = c.replace(/<colgroup[\s\S]*?<\/colgroup>/gi, '');
    c = c.replace(/<col[^>]*>/gi, '');
    c = c.replace(/\s*data-sheets-[a-z]+='[^']*'/gi, '');
    c = c.replace(/\s*data-sheets-[a-z]+="[^"]*"/gi, '');
    c = c.replace(/\s*xmlns(?::[a-z]+)?="[^"]*"/gi, '');

    var parser = new DOMParser();
    var doc = parser.parseFromString(c, 'text/html');

    var listPs = doc.querySelectorAll('p[style*="mso-list"], p.MsoListParagraph');
    if (listPs.length > 0) {
      var currentList = null;
      listPs.forEach(function (p) {
        var style = p.getAttribute('style') || '';
        var cls = p.getAttribute('class') || '';
        if (style.indexOf('mso-list') !== -1 || cls.indexOf('MsoListParagraph') !== -1) {
          if (!currentList) {
            currentList = doc.createElement('ul');
            p.parentNode.insertBefore(currentList, p);
          }
          var li = doc.createElement('li');
          var t = p.innerHTML;
          t = t.replace(/<span[^>]*font-family\s*:\s*Symbol[^>]*>[\s\S]*?<\/span>/gi, '');
          t = t.replace(/<span[^>]*font-family\s*:\s*"Symbol"[^>]*>[\s\S]*?<\/span>/gi, '');
          t = t.replace(/^(\s|&nbsp;|\u00B7|\u2022|o|\u00A7|\u25AA)+(\s|&nbsp;)*/i, '');
          li.innerHTML = t.trim();
          currentList.appendChild(li);
          p.remove();
        } else {
          currentList = null;
        }
      });
    }

    var processed = doc.body.innerHTML;
    processed = processed.replace(/mso-[a-z-]+\s*:[^;"]+;?/gi, '');
    processed = processed.replace(/\s*class="Mso[^"]*"/gi, '');

    var doc2 = parser.parseFromString(processed, 'text/html');
    doc2.querySelectorAll('table').forEach(function (table) {
      if (!table.querySelector('thead')) {
        var firstRow = table.querySelector('tr');
        if (firstRow) {
          firstRow.querySelectorAll('td').forEach(function (td) {
            var th = doc2.createElement('th');
            th.innerHTML = td.innerHTML;
            var s = td.getAttribute('style');
            if (s) th.setAttribute('style', s);
            var a = td.getAttribute('align');
            if (a) th.setAttribute('align', a);
            td.replaceWith(th);
          });
          var thead = doc2.createElement('thead');
          thead.appendChild(firstRow.cloneNode(true));
          firstRow.remove();
          table.insertBefore(thead, table.firstChild);
          var remaining = table.querySelectorAll('tr');
          if (remaining.length > 0 && !table.querySelector('tbody')) {
            var tbody = doc2.createElement('tbody');
            remaining.forEach(function (r) {
              tbody.appendChild(r);
            });
            table.appendChild(tbody);
          }
        }
      }
    });

    return doc2.body.innerHTML;
  }

  function assertConvertersReady() {
    if (!convertersReady || !turndown || !mdi) {
      throw new Error('Conversion libraries did not load. Check your connection and reload.');
    }
  }

  function sanitizePreviewHtml(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    var allowedTags = {
      A: true,
      BLOCKQUOTE: true,
      BR: true,
      CODE: true,
      DEL: true,
      EM: true,
      H1: true,
      H2: true,
      H3: true,
      H4: true,
      H5: true,
      H6: true,
      HR: true,
      IMG: true,
      LI: true,
      OL: true,
      P: true,
      PRE: true,
      S: true,
      STRONG: true,
      TABLE: true,
      TBODY: true,
      TD: true,
      TH: true,
      THEAD: true,
      TR: true,
      UL: true
    };
    doc.body.querySelectorAll('*').forEach(function (el) {
      if (!allowedTags[el.tagName]) {
        el.replaceWith(doc.createTextNode(el.textContent || ''));
        return;
      }
      Array.from(el.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        var value = attr.value || '';
        var isSafeHref = name === 'href' && /^(https?:|mailto:|#|\/)/i.test(value);
        var isSafeImg =
          el.tagName === 'IMG' &&
          name === 'src' &&
          /^(https?:|data:image\/(?:png|gif|jpeg|webp);|\/)/i.test(value);
        var isAlt = el.tagName === 'IMG' && name === 'alt';
        if (!isSafeHref && !isSafeImg && !isAlt) el.removeAttribute(attr.name);
      });
      if (el.tagName === 'A') {
        el.setAttribute('rel', 'noopener noreferrer');
        el.setAttribute('target', '_blank');
      }
    });
    return doc.body.innerHTML;
  }

  function convertHtmlToMd(html) {
    assertConvertersReady();
    return turndown.turndown(preProcessHtml(html));
  }

  function convertMdToHtml(md) {
    assertConvertersReady();
    return sanitizePreviewHtml(mdi.render(md));
  }

  function copyTextFallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }

  function copyRichFallback(html) {
    var el = document.createElement('div');
    el.innerHTML = html;
    el.style.cssText =
      'position:fixed;left:-9999px;top:-9999px;opacity:0;color:initial;background:transparent';
    document.body.appendChild(el);
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    if (!sel) {
      document.body.removeChild(el);
      return false;
    }
    sel.removeAllRanges();
    sel.addRange(range);
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {}
    sel.removeAllRanges();
    document.body.removeChild(el);
    return ok;
  }

  async function copyMd(markdown) {
    if (copyTextFallback(markdown)) return true;
    if (!navigator.clipboard || !navigator.clipboard.writeText) return false;
    try {
      await navigator.clipboard.writeText(markdown);
      return true;
    } catch (e) {
      return false;
    }
  }

  function neutralizeRichHtml(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    doc.body.querySelectorAll('*').forEach(function (el) {
      el.removeAttribute('class');
      el.removeAttribute('style');
      el.removeAttribute('bgcolor');
      el.removeAttribute('color');
      Array.from(el.attributes).forEach(function (attr) {
        if (attr.name.indexOf('data-') === 0) el.removeAttribute(attr.name);
      });
    });
    return doc.body.innerHTML;
  }

  function richTextPlainFallback(html) {
    var parser = new DOMParser();
    return parser.parseFromString(html, 'text/html').body.textContent || html;
  }

  async function copyRich(html) {
    var cleanHtml = neutralizeRichHtml(html);
    var plainText = richTextPlainFallback(cleanHtml);
    if (navigator.clipboard && navigator.clipboard.write && global.ClipboardItem) {
      try {
        var htmlBlob = new Blob([cleanHtml], { type: 'text/html' });
        var textBlob = new Blob([plainText], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
        ]);
        return true;
      } catch (e) {
        // Fall through to execCommand.
      }
    }
    if (copyRichFallback(cleanHtml)) return true;
    return copyTextFallback(plainText);
  }

  global.RtmConverter = {
    ready: function () {
      return convertersReady;
    },
    detectDirection: detectDirection,
    convertHtmlToMd: convertHtmlToMd,
    convertMdToHtml: convertMdToHtml,
    copyMd: copyMd,
    copyRich: copyRich
  };
})(window);
