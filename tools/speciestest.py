#!/usr/bin/env python3
"""Check that every species can be nested on the generated map (runs tools/speciestest.html headless)."""
import json
import os

from devtest import Chrome

HERE = os.path.dirname(os.path.abspath(__file__))
import sys
SEED = sys.argv[1] if len(sys.argv) > 1 else '1'
with Chrome(800, 600) as c:
    p = c.page('file://' + os.path.join(HERE, 'speciestest.html') + '#' + SEED, wait=3)
    r = p.eval('window.RESULT')
    ok = True
    for k, v in r['results'].items():
        good = v.get('nested', 0) > 0
        ok = ok and good
        print(('OK  ' if good else 'FAIL') + ' ' + k.ljust(12) + ' ' + ' > '.join(v.get('steps', [])) + ('  ' + v['err'] if v.get('err') else ''))
    for e in p.errors():
        print('error:', e)
    print(('ALL SPECIES NESTED' if ok else 'SOME SPECIES FAILED') + ' (seed %s)' % SEED)
