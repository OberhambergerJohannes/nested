#!/usr/bin/env python3
"""Bundle Nested into a single self-contained HTML file: dist/nested.html

    python3 build.py

The single file runs anywhere (just double-click it) for solo play.
Co-op needs server.py, which serves the normal multi-file version.
"""
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))


def main():
    with open(os.path.join(ROOT, 'index.html'), encoding='utf-8') as f:
        html = f.read()
    scripts = re.findall(r'<script src="([^"]+)"></script>', html)
    parts = []
    for src in scripts:
        with open(os.path.join(ROOT, src), encoding='utf-8') as f:
            code = f.read()
        # one shared scope: drop the per-file 'use strict' and keep a single one at the top
        code = re.sub(r"^'use strict';\s*", '', code)
        parts.append('// ---- %s ----\n%s' % (src, code))
    bundle = "'use strict';\n" + '\n'.join(parts)
    bundle = bundle.replace('</script', '<\\/script')
    first = html.index('<script src=')
    last = html.rindex('</script>') + len('</script>')
    out = html[:first] + '<script>\n' + bundle + '\n</script>' + html[last:]
    out = re.sub(r'\n<!-- (core|simulation|generated|client)[^>]*-->', '', out)
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    path = os.path.join(ROOT, 'dist', 'nested.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(out)
    print('Wrote %s (%d KB, %d scripts bundled)' % (path, len(out) // 1024, len(scripts)))


if __name__ == '__main__':
    main()
