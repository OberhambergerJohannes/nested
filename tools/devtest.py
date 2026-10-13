#!/usr/bin/env python3
"""Tiny Chrome DevTools Protocol driver used to test Nested in headless Chrome.

Usage as a library:
    from devtest import Chrome
    with Chrome() as c:
        p = c.page('file:///.../index.html')
        print(p.eval('1+1'))
        p.screenshot('shot.png')
"""
import base64
import json
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request

from websockets.sync.client import connect

CHROME = shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')

KEYS = {
    'ArrowUp': ('ArrowUp', 38), 'ArrowDown': ('ArrowDown', 40), 'ArrowLeft': ('ArrowLeft', 37),
    'ArrowRight': ('ArrowRight', 39), 'Enter': ('Enter', 13), 'Escape': ('Escape', 27), 'Tab': ('Tab', 9),
    ' ': ('Space', 32), 'Backspace': ('Backspace', 8),
}


class Page:
    def __init__(self, ws_url):
        self.ws = connect(ws_url, max_size=64 * 1024 * 1024, open_timeout=20)
        self.mid = 0
        self.logs = []
        self.events = []
        self.cmd('Runtime.enable')
        self.cmd('Page.enable')
        self.cmd('Log.enable')

    def _handle_event(self, msg):
        m = msg.get('method')
        if m == 'Runtime.consoleAPICalled':
            args = msg['params'].get('args', [])
            text = ' '.join(str(a.get('value', a.get('description', ''))) for a in args)
            self.logs.append(('console.' + msg['params'].get('type', 'log'), text))
        elif m == 'Runtime.exceptionThrown':
            d = msg['params']['exceptionDetails']
            ex = d.get('exception', {})
            text = ex.get('description') or d.get('text')
            self.logs.append(('EXCEPTION', '%s (line %s:%s %s)' % (text, d.get('lineNumber'), d.get('columnNumber'), d.get('url', ''))))
        elif m == 'Log.entryAdded':
            e = msg['params']['entry']
            self.logs.append(('log.' + e.get('level', ''), e.get('text', '') + ' ' + e.get('url', '')))
        else:
            self.events.append(msg)

    def cmd(self, method, params=None, timeout=60):
        self.mid += 1
        mid = self.mid
        self.ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        end = time.time() + timeout
        while time.time() < end:
            msg = json.loads(self.ws.recv(timeout=timeout))
            if msg.get('id') == mid:
                if 'error' in msg:
                    raise RuntimeError('%s: %s' % (method, msg['error']))
                return msg.get('result', {})
            self._handle_event(msg)
        raise TimeoutError(method)

    def pump(self, seconds):
        end = time.time() + seconds
        while time.time() < end:
            try:
                msg = json.loads(self.ws.recv(timeout=max(0.01, end - time.time())))
                self._handle_event(msg)
            except TimeoutError:
                break

    def goto(self, url, wait=1.0):
        self.cmd('Page.navigate', {'url': url})
        end = time.time() + 30
        while time.time() < end:
            msg = json.loads(self.ws.recv(timeout=30))
            self._handle_event(msg)
            if msg.get('method') == 'Page.loadEventFired':
                break
        self.pump(wait)

    def eval(self, expr, timeout=60):
        r = self.cmd('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True}, timeout=timeout)
        if 'exceptionDetails' in r:
            d = r['exceptionDetails']
            raise RuntimeError('JS error: ' + (d.get('exception', {}).get('description') or d.get('text', '')))
        return r.get('result', {}).get('value')

    def screenshot(self, path):
        r = self.cmd('Page.captureScreenshot', {'format': 'png'})
        with open(path, 'wb') as f:
            f.write(base64.b64decode(r['data']))

    def key(self, key, down=True, up=True, hold=0.0):
        code, vk = KEYS.get(key, ('Key' + key.upper() if len(key) == 1 and key.isalpha() else ('Digit' + key if key.isdigit() else key), ord(key.upper()) if len(key) == 1 else 0))
        base = {'key': key, 'code': code, 'windowsVirtualKeyCode': vk, 'nativeVirtualKeyCode': vk}
        if down:
            p = dict(base, type='keyDown')
            if len(key) == 1:
                p['text'] = key
            self.cmd('Input.dispatchKeyEvent', p)
        if hold:
            self.pump(hold)
        if up:
            self.cmd('Input.dispatchKeyEvent', dict(base, type='keyUp'))

    def click(self, x, y, button='left'):
        for t in ('mousePressed', 'mouseReleased'):
            self.cmd('Input.dispatchMouseEvent', {'type': t, 'x': x, 'y': y, 'button': button, 'clickCount': 1})

    def mouse_move(self, x, y):
        self.cmd('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': x, 'y': y})

    def errors(self):
        return [l for l in self.logs if l[0] in ('EXCEPTION', 'console.error') or l[0] == 'log.error']

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass


class Chrome:
    def __init__(self, width=1280, height=720, port=9333):
        self.port = port
        self.profile = tempfile.mkdtemp(prefix='nested-chrome-', dir=os.path.join(os.path.dirname(__file__), '..', '.devtmp'))
        self.proc = subprocess.Popen([
            CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files',
            '--remote-debugging-port=%d' % port, '--user-data-dir=' + self.profile,
            '--window-size=%d,%d' % (width, height), 'about:blank'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                urllib.request.urlopen('http://127.0.0.1:%d/json/version' % port, timeout=1)
                break
            except Exception:
                time.sleep(0.1)
        self.pages = []

    def page(self, url=None, wait=1.0):
        req = urllib.request.Request('http://127.0.0.1:%d/json/new?about:blank' % self.port, method='PUT')
        info = json.loads(urllib.request.urlopen(req, timeout=10).read())
        p = Page(info['webSocketDebuggerUrl'])
        self.pages.append(p)
        if url:
            p.goto(url, wait)
        return p

    def close(self):
        for p in self.pages:
            p.close()
        self.proc.terminate()
        try:
            self.proc.wait(5)
        except Exception:
            self.proc.kill()
        shutil.rmtree(self.profile, ignore_errors=True)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()
