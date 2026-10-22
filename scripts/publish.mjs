#!/usr/bin/env node
/**
 * Build the public site in dist/ for Cloudflare Pages, using an include list
 * like spidleweb's publisher. No dependencies; Node 20 or later.
 *
 * Add new page files to FILES and new runtime asset directories to FOLDERS.
 * Design sources, local fonts, notes and Worker code are never copied.
 * Staging completes before dist/ is replaced; a failed copy preserves it.
 */
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync,
  realpathSync, renameSync, rmSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const OUT = join(ROOT, 'dist');
const FILES = [
  'index.html', '404.html', 'robots.txt', 'sitemap.xml',
  'nothing/index.html',
  'wordle-checker/index.html',
  'madlib-maker/index.html', 'madlib-maker/styles.css',
  'rich-text-markdown/index.html', 'rich-text-markdown/app.js',
  'rich-text-markdown/converter.js',
  'text-diff/index.html', 'text-diff/app.js', 'text-diff/language.js',
];
const OPTIONAL_FILES = ['_headers', '_redirects'];
const FOLDERS = ['assets', 'madlib-maker/js', 'madlib-maker/css'];
const ASSET_TYPES = new Set([
  '.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif',
  '.ico', '.webmanifest', '.mp3', '.mp4', '.webm', '.ogg', '.wav',
]);

const stat = (path) => lstatSync(path, { throwIfNoEntry: false });
function requireInput(path) {
  const info = stat(path);
  if (!info) throw new Error(`missing site input: ${path}`);
  if (info.isSymbolicLink()) throw new Error(`refusing symbolic-link input: ${path}`);
  if (!info.isDirectory() && !info.isFile()) throw new Error(`unsupported site input: ${path}`);
  return info;
}

function copySite(staged) {
  for (const name of [...FILES, ...OPTIONAL_FILES.filter((name) => existsSync(join(ROOT, name)))]) {
    const src = join(ROOT, name);
    // Check each parent as well: a directory symlink must not escape the site.
    for (let path = src; path !== ROOT; path = dirname(path)) requireInput(path);
    if (!stat(src).isFile()) throw new Error(`expected site file: ${src}`);
    mkdirSync(dirname(join(staged, name)), { recursive: true });
    cpSync(src, join(staged, name));
  }
  for (const name of FOLDERS) {
    const src = join(ROOT, name);
    for (let path = src; path !== ROOT; path = dirname(path)) requireInput(path);
    if (!stat(src).isDirectory()) throw new Error(`expected asset directory: ${src}`);
    cpSync(src, join(staged, name), {
      recursive: true,
      filter(path) {
        const info = requireInput(path);
        if (basename(path).startsWith('.')) return false;
        return info.isDirectory() || ASSET_TYPES.has(extname(path).toLowerCase());
      },
    });
  }
}

function publish() {
  if (process.argv.length > 2) throw new Error('publish accepts no arguments; output is always dist/');
  const previous = stat(OUT);
  if (previous && (!previous.isDirectory() || previous.isSymbolicLink())) {
    throw new Error('refusing non-directory or symbolic-link output: dist/');
  }
  const workspace = mkdtempSync(join(ROOT, '.atomic-tools-publish-'));
  const staged = join(workspace, 'site');
  const backup = join(workspace, 'previous');
  let preserveWorkspace = false;
  mkdirSync(staged);
  try {
    copySite(staged);
    const current = stat(OUT);
    if (current?.dev !== previous?.dev || current?.ino !== previous?.ino) {
      throw new Error('dist/ changed during publishing; leaving it untouched');
    }
    if (previous) renameSync(OUT, backup);
    try {
      renameSync(staged, OUT);
    } catch (error) {
      if (previous) {
        try { renameSync(backup, OUT); } catch (restoreError) {
          preserveWorkspace = true;
          throw new Error(`could not restore dist/; recovery files are at ${workspace}`, {
            cause: new AggregateError([error, restoreError]),
          });
        }
      }
      throw error;
    }
    const count = readdirSync(OUT, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile()).length;
    console.log(`Published ${count} public files to dist/`);
  } finally {
    if (!preserveWorkspace) rmSync(workspace, { recursive: true, force: true });
  }
}

publish();
