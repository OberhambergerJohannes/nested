#!/usr/bin/env python3
"""Render every generated sprite sheet with headless Chrome and save them to assets/.
Requires Google Chrome/Chromium and the 'websockets' Python package (developer tool only)."""
import base64
import os

from devtest import Chrome

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with Chrome(1200, 900) as c:
    p = c.page('file://' + os.path.join(ROOT, 'tools', 'artsheets.html'), wait=2.0)
    sheets = p.eval('window.SHEETS')
    for e in p.errors():
        print('error:', e)
    os.makedirs(os.path.join(ROOT, 'assets'), exist_ok=True)
    for name, url in sheets.items():
        data = base64.b64decode(url.split(',', 1)[1])
        path = os.path.join(ROOT, 'assets', name + '.png')
        with open(path, 'wb') as f:
            f.write(data)
        print('saved', os.path.relpath(path, ROOT), len(data), 'bytes')
