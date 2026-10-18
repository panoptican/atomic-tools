// Languages offered in the Language menu, as Shiki ids. The extension names
// the file in the diff header so the title matches the highlighting.
export const LANGUAGES = [
  { id: 'text', label: 'Plain text', ext: 'txt' },
  { id: 'markdown', label: 'Markdown', ext: 'md' },
  { id: 'html', label: 'HTML', ext: 'html' },
  { id: 'css', label: 'CSS', ext: 'css' },
  { id: 'scss', label: 'SCSS', ext: 'scss' },
  { id: 'javascript', label: 'JavaScript', ext: 'js' },
  { id: 'typescript', label: 'TypeScript', ext: 'ts' },
  { id: 'jsx', label: 'JSX', ext: 'jsx' },
  { id: 'tsx', label: 'TSX', ext: 'tsx' },
  { id: 'json', label: 'JSON', ext: 'json' },
  { id: 'yaml', label: 'YAML', ext: 'yml' },
  { id: 'toml', label: 'TOML', ext: 'toml' },
  { id: 'xml', label: 'XML', ext: 'xml' },
  { id: 'python', label: 'Python', ext: 'py' },
  { id: 'ruby', label: 'Ruby', ext: 'rb' },
  { id: 'php', label: 'PHP', ext: 'php' },
  { id: 'go', label: 'Go', ext: 'go' },
  { id: 'rust', label: 'Rust', ext: 'rs' },
  { id: 'swift', label: 'Swift', ext: 'swift' },
  { id: 'kotlin', label: 'Kotlin', ext: 'kt' },
  { id: 'java', label: 'Java', ext: 'java' },
  { id: 'csharp', label: 'C#', ext: 'cs' },
  { id: 'c', label: 'C', ext: 'c' },
  { id: 'cpp', label: 'C++', ext: 'cpp' },
  { id: 'shellscript', label: 'Shell', ext: 'sh' },
  { id: 'sql', label: 'SQL', ext: 'sql' }
];

// Each pattern scores once per matching line, up to MAX_HITS, so one repeated
// feature can't outvote everything else. Keywords are case-sensitive: prose
// opens sentences with capitals ("For example:"), code mostly doesn't.
const MAX_HITS = 8;
const MIN_SCORE = 2;

const SIGNALS = {
  javascript: [
    /\b(const|let|var)\s+[\w${}[\],\s]+=/,
    /=>/,
    /\bfunction\b\s*\*?\s*\w*\s*\(/,
    /\bconsole\.\w+\(/,
    /^\s*import\s.+\sfrom\s+['"]/,
    /^\s*export\s+(default|const|let|function|class|async)\b/,
    /\brequire\(['"]/,
    /\b(document|window)\.\w+/,
    /===|!==/
  ],
  typescript: [
    /^\s*(export\s+)?(interface|type|enum)\s+\w+/,
    /\w\??\s*:\s*(string|number|boolean|void|any|unknown|never|Record<|Promise<)/,
    /^\s*import\s+type\s/,
    /\bas\s+(const|string|number|unknown|any)\b/,
    // Typed fields only; bare `public class` is just as likely Java or C#
    /\b(private|public|protected|readonly)\s+\w+\??\s*:/
  ],
  python: [
    /^\s*(async\s+)?def\s+\w+\s*\(.*\)\s*(->\s*[^:]+)?:\s*$/,
    /^\s*class\s+\w+(\(.*\))?:\s*$/,
    /^\s*(from\s+[\w.]+\s+import\s+[\w*,\s()]+|import\s+[\w.]+(\s+as\s+\w+)?(\s*,\s*[\w.]+)*)\s*$/,
    /\bself\./,
    /^\s*(if|elif|else|for|while|with|try|except|finally)\b.*:\s*$/,
    /\bprint\(/,
    /\b(None|True|False)\b/
  ],
  ruby: [
    /^\s*def\s+[\w.]+[?!]?(\(.*\))?\s*$/,
    /^\s*end\s*$/,
    /^\s*puts\s/,
    /^\s*require(_relative)?\s+['"]/,
    /\bdo\s*\|[\w,\s]+\|/,
    /\battr_(accessor|reader|writer)\b/,
    /^\s*module\s+[A-Z]/
  ],
  php: [
    /<\?php/,
    /\$\w+\s*=[^=]/,
    /\$this->/,
    /\bfunction\s+\w+\s*\(\s*\$/,
    /^\s*echo\s/
  ],
  go: [
    /^package\s+\w+\s*$/,
    /^\s*func\s+(\([^)]*\)\s*)?\w+\s*\(/,
    /:=/,
    /\bfmt\.\w+/,
    /^\s*import\s+\(\s*$/,
    /\berr\s*!=\s*nil\b/
  ],
  rust: [
    /\bfn\s+\w+\s*[<(]/,
    /\blet\s+mut\b/,
    /^\s*impl\b/,
    /^\s*use\s+\w+(::[\w{}*, ]+)+;/,
    /\b(println|vec|format|panic)!\(/,
    /\bpub\s+(fn|struct|enum|mod|trait)\b/,
    /&mut\s|&self\b/,
    /\bmatch\s+\w+\s*\{/
  ],
  swift: [
    /^\s*import\s+(SwiftUI|Foundation|UIKit|Combine)\s*$/,
    /^\s*(private\s+|public\s+)?func\s+\w+\s*\(/,
    /\bguard\s+let\b|\bif\s+let\b/,
    /\b(var|let)\s+\w+\s*:\s*[A-Z][\w<>?\[\]]*/,
    /@(State|Binding|Published|MainActor|ObservedObject|Environment)\b/,
    /->\s*some\s+View\b/,
    /^\s*(struct|class|extension)\s+\w+\s*:\s*\w+/
  ],
  kotlin: [
    /^\s*(private\s+|override\s+)?fun\s+\w+\s*\(/,
    /^\s*val\s+\w+/,
    /^\s*package\s+[\w.]+\s*$/,
    /^\s*data\s+class\s/,
    /\bprintln\(/
  ],
  java: [
    /\bpublic\s+(static\s+)?(final\s+)?(class|void|int|String|boolean)\b/,
    /\bSystem\.out\./,
    /^\s*import\s+java\./,
    /^\s*package\s+[\w.]+;\s*$/,
    /@Override\b/,
    /\bprivate\s+(final\s+)?[A-Z]\w*(<.*>)?\s+\w+\s*[;=]/
  ],
  csharp: [
    /^\s*using\s+System/,
    /^\s*namespace\s+[\w.]+/,
    /\bConsole\.Write/,
    /\bpublic\s+(async\s+)?(Task|string|int|void|bool)\b/,
    /\{\s*get;\s*(set;)?\s*\}/,
    /\bvar\s+\w+\s*=\s*new\b/
  ],
  c: [
    /^\s*#include\s*[<"]/,
    /\bint\s+main\s*\(/,
    /\bprintf\s*\(/,
    /\b(malloc|free|sizeof)\s*\(/,
    /^\s*#define\s/,
    /\b(unsigned|char|void|int)\s*\*\s*\w/
  ],
  cpp: [
    /\bstd::/,
    /\bcout\s*<</,
    /^\s*template\s*</,
    /^\s*#include\s*<(iostream|vector|string|map|memory)>/,
    /^\s*class\s+\w+\s*(:\s*public\s+\w+)?\s*\{/
  ],
  shellscript: [
    /^\s*\$\s+\w/,
    /^\s*(sudo|echo|cd|export|npm|npx|pnpm|yarn|git|brew|curl|wget|grep|mkdir|chmod|ls|cat|rm|cp|mv|apt|apt-get|docker|ssh|source)\s/,
    /^\s*(fi|done|esac)\s*$/,
    /^\s*(if|while|for)\s.*;\s*(then|do)\s*$/,
    /\s--?[a-z][\w-]*(=|\s|$)/
  ],
  sql: [
    /\b(SELECT|select)\b.*\b(FROM|from)\b/,
    /\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+(TABLE|INDEX|VIEW)|ALTER\s+TABLE|DROP\s+TABLE)\b/i,
    /\b(WHERE|JOIN|GROUP BY|ORDER BY|LIMIT|VALUES)\b/
  ],
  css: [
    /^\s*[^\s{}();=][^{}();=]*\{\s*$/,
    /^\s*-{0,2}[a-z][a-z-]*\s*:\s*[^;{}]+;\s*$/,
    /^\s*@(media|import|font-face|keyframes|supports|layer|container)\b/
  ],
  scss: [
    /^\s*\$[\w-]+\s*:/,
    /^\s*@(mixin|include|extend|use|forward)\b/,
    /^\s*&[:.\-_\w[]/
  ],
  html: [
    /<\/?(html|head|body|div|span|p|a|ul|ol|li|section|article|header|footer|nav|main|h[1-6]|img|button|form|input|label|table|tr|td|script|style|link|meta)\b[^>]*>/,
    /<\/[a-z][\w-]*>/
  ],
  markdown: [
    /^#{1,6}\s+\S/,
    /^\s*(```|~~~)/,
    /\[[^\]\n]+\]\([^)\s]+\)/,
    /\*\*[^*\n]+\*\*|__[^_\n]+__/,
    /^\s*>\s/,
    /^\s*([-*+]|\d+\.)\s+\S/
  ]
};

// Languages that only refine another one: their score adds to the base's.
const DIALECTS = { typescript: 'javascript', scss: 'css', cpp: 'c' };

function countHits(lines, pattern) {
  let hits = 0;
  for (const line of lines) {
    if (pattern.test(line) && ++hits === MAX_HITS) break;
  }
  return hits;
}

function looksLikeJson(trimmed) {
  if (!/^[{[]/.test(trimmed)) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch (e) {
    // Half-pasted or mid-edit JSON still reads as quoted keys
    return /^\s*"[^"\n]+"\s*:/m.test(trimmed);
  }
}

// YAML is mostly `key: value` lines, which prose also produces ("Note: ..."),
// so it only counts when most of the text is shaped that way.
function yamlScore(lines) {
  const content = lines.filter((line) => line.trim() && !/^\s*#/.test(line));
  if (content.length < 2) return 0;
  const shaped = content.filter((line) =>
    /^\s*(-\s+)?[\w.-]+:(\s+[^;{}]*)?$/.test(line) || /^\s*-\s+\S/.test(line) || /^---\s*$/.test(line)
  ).length;
  return shaped / content.length >= 0.7 ? shaped : 0;
}

// TOML and INI share `key = value` with ordinary code; a [table] header decides it.
function tomlScore(lines) {
  const tables = countHits(lines, /^\s*\[{1,2}[\w.-]+\]{1,2}\s*$/);
  if (!tables) return 0;
  return tables * 2 + countHits(lines, /^\s*[\w.-]+\s*=\s*("|'|\d|true|false|\[|\{)/);
}

/**
 * Best guess at the Shiki language for pasted text, or 'text' when nothing
 * stands out. Prose should land on 'text', so a guess needs MIN_SCORE.
 */
export function detectLanguage(text) {
  const sample = text.slice(0, 20000);
  const trimmed = sample.trim();
  if (!trimmed) return 'text';

  const shebang = trimmed.match(/^#!.*\b(bash|sh|zsh|python3?|node|ruby|php)\b/);
  if (shebang) {
    return { python: 'python', python3: 'python', node: 'javascript', ruby: 'ruby', php: 'php' }[shebang[1]] || 'shellscript';
  }
  if (/^<\?php/.test(trimmed)) return 'php';
  if (/^<\?xml|^<svg[\s>]|\sxmlns(:\w+)?=/.test(trimmed)) return 'xml';
  if (/^(<!doctype html|<html[\s>])/i.test(trimmed)) return 'html';
  if (looksLikeJson(trimmed)) return 'json';

  const lines = sample.split('\n');
  const scores = {};
  for (const [lang, patterns] of Object.entries(SIGNALS)) {
    scores[lang] = patterns.reduce((sum, pattern) => sum + countHits(lines, pattern), 0);
  }
  for (const [dialect, base] of Object.entries(DIALECTS)) {
    // A dialect needs its own evidence; then it outranks the base it extends.
    scores[dialect] = scores[dialect] ? scores[base] + scores[dialect] * 2 : 0;
  }
  scores.yaml = yamlScore(lines);
  scores.toml = tomlScore(lines);

  // Markup that opens with a tag is HTML even when an inline <script> outscores it
  if (/^<[a-z!]/i.test(trimmed) && scores.html) return 'html';

  let best = 'text';
  let bestScore = MIN_SCORE - 1;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }

  // JSX is JavaScript or TypeScript that returns or nests tags
  if ((best === 'javascript' || best === 'typescript') &&
      /\bclassName=|return\s*\(?\s*<[A-Za-z>]|<\/[A-Za-z][\w.]*>|<[A-Z]\w*[\s/>]/.test(sample)) {
    return best === 'typescript' ? 'tsx' : 'jsx';
  }
  return best;
}
