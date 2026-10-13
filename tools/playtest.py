#!/usr/bin/env python3
"""Scripted playthrough of Nested in headless Chrome. Saves screenshots to .devtmp/.

Run:  python3 tools/playtest.py [steps...]
"""
import json
import os
import sys

from devtest import Chrome

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '.devtmp')
URL = 'file://' + os.path.join(ROOT, 'index.html')

HELPERS = r"""
window.TT = {
  tp(x, y, d) { const me = G.me; me.x = x; me.y = y; if (d != null) me.d = d; G.cam.x = Math.round(x - G.view.w/2); G.cam.y = Math.round(y - G.view.h/2); const hp = G.link.world && G.link.world.players.get(G.state.me); if (hp) { hp.x = x; hp.y = y; } },
  tile(tx, ty, d) { this.tp(tx*16+8, ty*16+12, d); },
  target() { const t = G.target; return t ? (t.label + ' | ' + (t.alt||'')) : null; },
  modal() { return G.modal ? G.modal.constructor.name : null; },
  mats() { const m = G.state.mats, o = {}; for (const k in m) if (m[k]) o[k] = m[k]; return o; },
  objs(type, kind) { return [...G.state.objs.values()].filter(o => o.type === type && (!kind || o.kind === kind)); },
  world() { return G.link.world; },
  near(type, kind, x, y) { let best=null, bd=1e9; for (const o of this.objs(type, kind)) { const d=(o.x-x)**2+(o.y-y)**2; if (d<bd){bd=d;best=o;} } return best; },
  advance(mins) { const w = G.link.world; for (let i=0;i<mins;i++) w.tick(MS_PER_MIN); },
};
1
"""


def shot(p, name):
    p.pump(0.4)
    path = os.path.join(OUT, name + '.png')
    p.screenshot(path)
    print('  screenshot', path)


def ev(p, js):
    return p.eval(js)


def main():
    with Chrome(1280, 760) as c:
        p = c.page(URL, wait=1.5)
        ev(p, HELPERS)
        ev(p, 'localStorage.clear(); Profile.set({name:"Hannes", look:{hair:1,shirt:0,skin:0,style:0}}); G.startHosting("solo", 1, "Featherbrook"); 1')
        p.pump(1.5)
        print('view', ev(p, 'JSON.stringify(G.view)'))

        print('1) mailbox')
        ev(p, 'TT.tile(46, 29, 3)')
        p.pump(0.3)
        print('  target:', ev(p, 'TT.target()'))
        p.key('e')
        p.pump(0.5)
        print('  modal:', ev(p, 'TT.modal()'))
        shot(p, 'pt01_mail')
        p.key('Escape')
        p.pump(0.3)
        print('  quest:', ev(p, 'G.state.quest'))

        print('2) Ada')
        ev(p, 'TT.tp(npcPos("ada", G.state.clock()).x*16, npcPos("ada", G.state.clock()).y*16+14, 3)')
        p.pump(0.3)
        print('  target:', ev(p, 'TT.target()'))
        p.key('e')
        p.pump(0.6)
        print('  modal:', ev(p, 'TT.modal()'))
        shot(p, 'pt02_ada')
        for i in range(12):
            p.key('e')
            p.pump(0.15)
            if ev(p, 'TT.modal()') != 'DialogueScreen':
                break
        print('  modal after:', ev(p, 'TT.modal()'), 'quest', ev(p, 'G.state.quest'), 'bb hints', ev(p, 'G.state.journal.blackbird.h'))
        while ev(p, 'TT.modal()'):
            p.key('Escape')
            p.pump(0.2)

        print('3) shake trees')
        trees = ev(p, 'JSON.stringify(TT.objs("tree","oak").filter(o=>o.st===2).slice(0,40).map(o=>[o.x,o.y]))')
        trees = json.loads(trees)
        n = 0
        for (x, y) in trees:
            ev(p, 'TT.tile(%d, %d, 3)' % (x, y + 1))
            p.pump(0.15)
            t = ev(p, 'TT.target()')
            if t and t.startswith('Shake'):
                p.key('e')
                p.pump(0.3)
                n += 1
                if n == 1:
                    shot(p, 'pt03_shake')
            if n >= 2:
                break
        print('  mats:', ev(p, 'JSON.stringify(TT.mats())'))

        print('4) cut long grass')
        cut = 0
        cells = json.loads(ev(p, 'JSON.stringify((()=>{const S=G.state,o=[];for(let y=36;y<50;y++)for(let x=3;x<28;x++){const i=y*MAP_W+x;if(S.grass[i]===2&&S.tiles[i]===T.GRASS&&!S.occ[i]&&!S.occ[i-MAP_W])o.push([x,y]);}return o.slice(0,30);})())'))
        for (x, y) in cells:
            ev(p, 'TT.tile(%d, %d, 3)' % (x, y + 1))
            p.pump(0.1)
            t = ev(p, 'TT.target()')
            if t and 'grass' in t.lower():
                p.key('e')
                p.pump(0.25)
                cut += 1
                if cut == 1:
                    shot(p, 'pt04_grass')
            if cut >= 3:
                break
        print('  mats:', ev(p, 'JSON.stringify(TT.mats())'))

        print('5) mud')
        cells = json.loads(ev(p, 'JSON.stringify((()=>{const S=G.state,o=[];for(let y=28;y<40;y++)for(let x=40;x<56;x++){if(S.tiles[y*MAP_W+x]===T.MUD)o.push([x,y]);}return o;})())'))
        print('  mud tiles', cells[:6])
        got = 0
        for (x, y) in cells:
            for (dx, dy, d) in ((0, 1, 3), (-1, 0, 2), (0, -1, 0), (1, 0, 1)):
                ev(p, 'TT.tile(%d, %d, %d)' % (x + dx, y + dy, d))
                p.pump(0.1)
                t = ev(p, 'TT.target()')
                if t and t.startswith('Scoop'):
                    p.key('e')
                    p.pump(0.25)
                    got += 1
                    break
            if got >= 2:
                break
        print('  mats:', ev(p, 'JSON.stringify(TT.mats())'), 'quest', ev(p, 'G.state.quest'))
        shot(p, 'pt05_mud')

        print('6) nest site at a shrub')
        sh = json.loads(ev(p, 'JSON.stringify((()=>{const o=TT.near("shrub",null,38,31);return [o.id,o.x,o.y,o.kind];})())'))
        print('  shrub', sh)
        ev(p, 'TT.tile(%d, %d, 3)' % (sh[1], sh[2] + 1))
        p.pump(0.3)
        print('  target:', ev(p, 'TT.target()'))
        p.key('f')
        p.pump(0.5)
        print('  modal:', ev(p, 'TT.modal()'))
        shot(p, 'pt06_site')
        ev(p, 'G.closeModal(); G.send({t:"act", a:"nest", host:%d, sp:"blackbird"}); 1' % sh[0])
        p.pump(0.5)
        print('  nests:', ev(p, 'JSON.stringify(TT.objs("nest").map(n=>[n.kind,n.st]))'), 'quest', ev(p, 'G.state.quest'))
        shot(p, 'pt07_built')

        print('7) advance 40 min')
        ev(p, 'TT.advance(40); 1')
        p.pump(1.0)
        print('  nests:', ev(p, 'JSON.stringify(TT.objs("nest").map(n=>[n.kind,n.st]))'), 'quest', ev(p, 'G.state.quest'))
        shot(p, 'pt08_pair')

        print('8) sleep')
        ev(p, 'TT.tile(44, 28, 3)')
        p.pump(0.3)
        print('  target:', ev(p, 'TT.target()'))
        p.key('e')
        p.pump(0.4)
        print('  modal:', ev(p, 'TT.modal()'))
        p.key('e')
        p.pump(1.0)
        print('  modal:', ev(p, 'TT.modal()'), 'date', ev(p, 'JSON.stringify(G.state.time)'))
        shot(p, 'pt09_morning')
        p.key('Escape')
        p.pump(0.5)
        ev(p, 'TT.advance(60); 1')
        p.pump(0.5)
        nb = json.loads(ev(p, 'JSON.stringify((()=>{const n=TT.objs("nest")[0];const a=nestAnchor(G.state,n);return [a.x,a.y];})())'))
        ev(p, 'TT.tp(%f, %f, 3)' % (nb[0], nb[1] + 30))
        p.pump(1.2)
        shot(p, 'pt10_nest_eggs')
        ev(p, 'G.openModal(new JournalScreen()); 1')
        p.pump(0.4)
        shot(p, 'pt11_journal')
        ev(p, 'G.closeModal(); 1')

        errs = p.errors()
        print('ERRORS:' if errs else 'no errors')
        for e in errs:
            print('  ', e)
        for l in p.logs:
            if l not in errs:
                print('  log', l)


if __name__ == '__main__':
    main()
