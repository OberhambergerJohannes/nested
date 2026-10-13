#!/usr/bin/env python3
"""Two-browser co-op test through the relay server. Start it first: python3 server.py --port 8099"""
import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from devtest import Chrome
from playtest import HELPERS
URL = 'http://localhost:8099/'
A = Chrome(1100, 640, port=9341)
B = Chrome(1100, 640, port=9342)
try:
    pa = A.page(URL, wait=1.5)
    pb = B.page(URL, wait=1.5)
    pa.eval(HELPERS); pb.eval(HELPERS)
    print('server detected A/B:', pa.eval('G.server'), pb.eval('G.server'))
    pa.eval('localStorage.clear(); Profile.set({name:"Hannes", look:{hair:1,shirt:0,skin:0,style:0}}); G.startHosting("host", 1, "Coopvalley"); 1')
    pa.pump(1.5)
    code = pa.eval('G.roomCode')
    print('room code', code, 'rooms:', pb.eval('fetch("rooms").then(r=>r.json()).then(j=>JSON.stringify(j))'))
    pb.eval('localStorage.clear(); Profile.set({name:"Mia", look:{hair:3,shirt:1,skin:2,style:1}}); G.joinRoom("%s"); 1' % code)
    pb.pump(2.0)
    print('A players', pa.eval('JSON.stringify([...G.state.players.values()].map(p=>[p.pid,p.name]))'))
    print('B players', pb.eval('G.state && JSON.stringify([...G.state.players.values()].map(p=>[p.pid,p.name]))'), 'B mode', pb.eval('G.mode'))
    # B walks right for 1s
    pb.key('d', up=False); pb.pump(1.0); pb.key('d', down=False)
    pb.pump(0.5)
    bpos = pb.eval('JSON.stringify([G.me.x, G.me.y])')
    apos = pa.eval('JSON.stringify((()=>{const p=[...G.state.players.values()].find(p=>p.name==="Mia");return [p.x,p.y];})())')
    print('B pos (B view)', bpos, ' B pos (A view)', apos)
    # B shakes a tree near home
    trees = json.loads(pb.eval('JSON.stringify(TT.objs("tree","oak").filter(o=>o.st===2).map(o=>[o.x,o.y]))'))
    done = False
    for (x, y) in trees[:60]:
        # walk via teleport on guest: guest can't move the host record, so teleport in small steps
        pass
    # instead: B uses a nearby shrub (snap twigs) close to spawn
    sh = json.loads(pb.eval('JSON.stringify((()=>{const o=TT.near("shrub",null,44,30);return [o.id,o.x,o.y];})())'))
    print('shrub', sh)
    # move B toward the shrub by holding keys (simple steering)
    for i in range(60):
        st = json.loads(pb.eval('JSON.stringify([G.me.x, G.me.y])'))
        tx, ty = sh[1]*16+8, (sh[2]+1)*16+10
        dx, dy = tx-st[0], ty-st[1]
        if abs(dx) < 4 and abs(dy) < 4: break
        k = ('d' if dx > 0 else 'a') if abs(dx) >= abs(dy) else ('s' if dy > 0 else 'w')
        pb.key(k, up=False); pb.pump(0.12); pb.key(k, down=False)
    pb.eval('G.me.d = 3; 1'); pb.pump(0.3)
    print('B target:', pb.eval('TT.target()'))
    pb.key('e'); pb.pump(1.0)
    print('mats on A:', pa.eval('JSON.stringify(TT.mats())'), ' mats on B:', pb.eval('JSON.stringify(TT.mats())'))
    # chat from B
    pb.key('t'); pb.pump(0.2)
    for ch in 'hi!': pb.key(ch)
    pb.key('Enter'); pb.pump(0.6)
    print('A chat:', pa.eval('JSON.stringify(G.chatLog.map(c=>[c.name,c.text]))'))
        # both sleep
    pa.eval('TT.tile(44,28,3); G.send({t:"act",a:"sleep",v:true}); 1'); pa.pump(0.5)
    print('A sleep status', pa.eval('JSON.stringify([G.state.sleepN, G.state.sleepTotal])'), pa.eval('TT.modal()'))
    for i in range(60):
        st = json.loads(pb.eval('JSON.stringify([G.me.x, G.me.y])'))
        tx, ty = 44*16+8, 29*16+4
        dx, dy = tx-st[0], ty-st[1]
        if abs(dx) < 4 and abs(dy) < 4: break
        k = ('d' if dx > 0 else 'a') if abs(dx) >= abs(dy) else ('s' if dy > 0 else 'w')
        pb.key(k, up=False); pb.pump(0.12); pb.key(k, down=False)
    pb.eval('G.send({t:"act",a:"sleep",v:true}); 1'); pb.pump(1.5)
    print('A date', pa.eval('JSON.stringify(G.state.time)'), 'B date', pb.eval('JSON.stringify(G.state.time)'))
    print('A modal', pa.eval('TT.modal()'), 'B modal', pb.eval('TT.modal()'))
    # guest leaves
    pb.eval('G.quitToTitle(); 1'); pb.pump(1.0)
    print('A players after leave', pa.eval('JSON.stringify([...G.state.players.values()].map(p=>p.name))'))
    print('A errors', pa.errors()); print('B errors', pb.errors())
finally:
    A.close(); B.close()
