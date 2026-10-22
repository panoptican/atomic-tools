"""Exercise the complete Pages publishing copy without changing project sources.

Run: python3 -m unittest discover -s tests -p 'test_publish.py' -v
"""
import hashlib
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Publish(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='atomic-publish-test-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / 'site'
        shutil.copytree(ROOT, self.root, ignore=shutil.ignore_patterns(
            '.git', 'dist', 'node_modules', '.pnpm-store', 'resources',
            '__pycache__', '.atomic-tools-publish-*'))
        self.out = self.root / 'dist'

    def build(self):
        return subprocess.run(['node', 'scripts/publish.mjs'], cwd=self.root,
                              capture_output=True, text=True)

    def build_ok(self):
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stderr)

    def snapshot(self, root):
        return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in root.rglob('*') if p.is_file() and not p.is_symlink()
                and not p.is_relative_to(self.out)}

    def resolve(self, source, reference):
        parts = urlsplit(reference)
        if parts.scheme or parts.netloc or not parts.path:
            return None
        path = unquote(parts.path)
        target = ((self.out / path.lstrip('/')) if path.startswith('/')
                  else source.parent / path).resolve()
        self.assertTrue(target.is_relative_to(self.out.resolve()), reference)
        return target / 'index.html' if target.is_dir() else target

    def test_site_routes_and_local_dependencies_are_complete(self):
        self.build_ok()
        pages = ['index.html', '404.html', 'nothing/index.html',
                 'madlib-maker/index.html', 'wordle-checker/index.html',
                 'text-diff/index.html', 'rich-text-markdown/index.html']
        for name in [*pages, 'robots.txt', 'sitemap.xml']:
            self.assertTrue((self.out / name).is_file(), name)
        for page in self.out.rglob('*.html'):
            for ref in re.findall(r'''(?:src|href)=["']([^"']+)["']''', page.read_text()):
                target = self.resolve(page, ref)
                if target is not None:
                    self.assertTrue(target.is_file(), f'{page.name}: {ref}')
        for source in [*self.out.rglob('*.css'), *self.out.rglob('*.js')]:
            contents = source.read_text()
            refs = re.findall(r'''url\(["']?([^\s"')]+)''', contents)
            refs += re.findall(r'''(?:from\s*|import\s*\()["'](\.[^"']+)["']''', contents)
            for ref in refs:
                target = self.resolve(source, ref)
                if target is not None:
                    self.assertTrue(target.is_file(), f'{source}: {ref}')
        for route in re.findall(r'<loc>https://tools\.spidleweb\.net(/[^<]*)</loc>',
                                (self.out / 'sitemap.xml').read_text()):
            self.assertTrue(self.resolve(self.out / 'index.html', route).is_file(), route)

    def test_designs_notes_fonts_and_backend_sources_stay_off_site(self):
        for name in ['assets/private.elyx', 'madlib-maker/js/notes.md',
                     'resources/fonts/licensed.woff2', 'new-private-page.html']:
            p = self.root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text('not for publication')
        self.build_ok()
        for name in ['tokens', 'controls', 'blocks', 'foundations', 'resources',
                     'screens', 'scripts', 'tests', 'specs', 'elyx.json',
                     'new-private-page.html', 'wordle-checker/worker.js',
                     'madlib-maker/worker.js', 'wordle-checker/test-worker.js']:
            self.assertFalse((self.out / name).exists(), name)
        for file in self.out.rglob('*'):
            if file.is_file():
                self.assertNotIn(file.suffix, ['.elyx', '.md', '.toml', '.woff', '.woff2'])
                self.assertFalse(any(p.startswith('.') for p in file.relative_to(self.out).parts))

    def test_build_preserves_sources_and_removes_stale_output(self):
        before = self.snapshot(self.root)
        self.build_ok()
        (self.out / 'obsolete.elyx').write_text('previous output')
        self.build_ok()
        self.assertFalse((self.out / 'obsolete.elyx').exists())
        self.assertEqual(self.snapshot(self.root), before)

    def test_missing_site_file_preserves_last_complete_output(self):
        self.build_ok()
        before = {str(p.relative_to(self.out)): p.read_bytes()
                  for p in self.out.rglob('*') if p.is_file()}
        (self.root / 'madlib-maker/styles.css').unlink()
        result = self.build()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual({str(p.relative_to(self.out)): p.read_bytes()
                          for p in self.out.rglob('*') if p.is_file()}, before)
        self.assertEqual(list(self.root.glob('.atomic-tools-publish-*')), [])

    def test_symlink_inputs_and_outputs_are_rejected(self):
        target = Path(self.tmp.name) / 'external'
        target.mkdir()
        (target / 'keep.txt').write_text('keep')
        self.out.symlink_to(target, target_is_directory=True)
        self.assertNotEqual(self.build().returncode, 0)
        self.assertEqual((target / 'keep.txt').read_text(), 'keep')
        self.out.unlink()
        (self.root / 'assets/linked.js').symlink_to(target / 'keep.txt')
        self.assertNotEqual(self.build().returncode, 0)
        self.assertFalse(self.out.exists())


if __name__ == '__main__':
    unittest.main()
