#!/usr/bin/env python3
"""Nested co-op server.

Serves the game files and relays messages between a hosting player and their guests.
Only the Python standard library is used - no installation needed.

    python3 server.py            # then open http://localhost:8080
    python3 server.py --port 9000

Everyone on the same network opens the address printed below in a browser.
One player chooses "Host Co-op", the others choose "Join Co-op".
"""
import argparse
import asyncio
import base64
import hashlib
import json
import os
import socket
import struct
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
MAX_MSG = 16 * 1024 * 1024
MAX_GUESTS = 5
QUEUE_LIMIT = 2000
TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.png': 'image/png', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
}


class Closed(Exception):
    pass


class WS:
    """A minimal server-side WebSocket connection (RFC 6455) with a send queue."""

    def __init__(self, reader, writer):
        self.r = reader
        self.w = writer
        self.q = asyncio.Queue()
        self.alive = True
        self.task = asyncio.ensure_future(self._writer())

    async def _writer(self):
        try:
            while True:
                frame = await self.q.get()
                if frame is None:
                    break
                self.w.write(frame)
                await self.w.drain()
        except Exception:
            pass
        finally:
            self.alive = False
            try:
                self.w.close()
            except Exception:
                pass

    @staticmethod
    def _frame(opcode, payload):
        n = len(payload)
        if n < 126:
            head = struct.pack('!BB', 0x80 | opcode, n)
        elif n < 65536:
            head = struct.pack('!BBH', 0x80 | opcode, 126, n)
        else:
            head = struct.pack('!BBQ', 0x80 | opcode, 127, n)
        return head + payload

    def send(self, text):
        if not self.alive:
            return
        if self.q.qsize() > QUEUE_LIMIT:
            # this client can't keep up; drop it rather than stalling everyone
            self.close()
            return
        self.q.put_nowait(self._frame(0x1, text.encode('utf-8')))

    def close(self, code=1000):
        if self.alive:
            self.alive = False
            try:
                self.q.put_nowait(self._frame(0x8, struct.pack('!H', code)))
            except Exception:
                pass
            self.q.put_nowait(None)

    async def _read_exact(self, n):
        try:
            return await self.r.readexactly(n)
        except (asyncio.IncompleteReadError, ConnectionError):
            raise Closed()

    async def recv(self):
        """Return the next text message, or None when the connection closes."""
        parts = []
        total = 0
        while True:
            try:
                b0, b1 = await self._read_exact(2)
            except Closed:
                return None
            fin = b0 & 0x80
            op = b0 & 0x0F
            masked = b1 & 0x80
            n = b1 & 0x7F
            try:
                if n == 126:
                    n = struct.unpack('!H', await self._read_exact(2))[0]
                elif n == 127:
                    n = struct.unpack('!Q', await self._read_exact(8))[0]
                if n > MAX_MSG:
                    self.close(1009)
                    return None
                key = await self._read_exact(4) if masked else b'\0\0\0\0'
                data = bytearray(await self._read_exact(n))
            except Closed:
                return None
            if masked:
                for i in range(n):
                    data[i] ^= key[i & 3]
            if op == 0x8:
                self.close()
                return None
            if op == 0x9:
                if self.alive:
                    self.q.put_nowait(self._frame(0xA, bytes(data)))
                continue
            if op == 0xA:
                continue
            parts.append(bytes(data))
            total += n
            if total > MAX_MSG:
                self.close(1009)
                return None
            if fin:
                try:
                    return b''.join(parts).decode('utf-8')
                except UnicodeDecodeError:
                    self.close(1007)
                    return None


class Room:
    def __init__(self, code, host, name, valley):
        self.code = code
        self.host = host
        self.name = name
        self.valley = valley
        self.guests = {}
        self.next_id = 1


rooms = {}


def clean(s, n):
    return ''.join(ch for ch in (s or '') if ch.isprintable() and ch not in '<>')[:n]


async def run_host(ws, q):
    code = clean(q.get('room', [''])[0], 8).upper()
    if not (len(code) == 4 and code.isalpha()):
        ws.send('@bad')
        ws.close()
        return
    if code in rooms:
        ws.send('@taken')
        ws.close()
        return
    room = Room(code, ws, clean(q.get('name', ['Host'])[0], 14) or 'Host', clean(q.get('valley', ['Valley'])[0], 18) or 'Valley')
    rooms[code] = room
    ws.send('@ok|' + code)
    print('  valley "%s" opened by %s (room %s)' % (room.valley, room.name, code))
    try:
        while True:
            msg = await ws.recv()
            if msg is None:
                break
            bar = msg.find('|')
            if bar < 0:
                continue
            target, body = msg[:bar], msg[bar + 1:]
            if target == '*':
                for g in list(room.guests.values()):
                    g.send(body)
            else:
                g = room.guests.get(target)
                if g:
                    g.send(body)
    finally:
        rooms.pop(code, None)
        for g in list(room.guests.values()):
            g.send('@hostleft')
            g.close()
        print('  valley "%s" closed (room %s)' % (room.valley, code))


async def run_guest(ws, q):
    code = clean(q.get('room', [''])[0], 8).upper()
    room = rooms.get(code)
    if not room:
        ws.send('@noroom')
        ws.close()
        return
    if len(room.guests) >= MAX_GUESTS:
        ws.send('@full')
        ws.close()
        return
    gid = str(room.next_id)
    room.next_id += 1
    room.guests[gid] = ws
    room.host.send('@join|' + gid)
    try:
        while True:
            msg = await ws.recv()
            if msg is None:
                break
            if rooms.get(code) is not room:
                break
            room.host.send(gid + '|' + msg)
    finally:
        room.guests.pop(gid, None)
        if rooms.get(code) is room:
            room.host.send('@leave|' + gid)


async def respond(writer, status, ctype, body, extra=''):
    head = 'HTTP/1.1 %s\r\nContent-Type: %s\r\nContent-Length: %d\r\nCache-Control: no-cache\r\nConnection: close\r\n%s\r\n' % (status, ctype, len(body), extra)
    writer.write(head.encode('latin-1') + body)
    try:
        await writer.drain()
    except Exception:
        pass
    writer.close()


async def handle(reader, writer):
    try:
        line = await asyncio.wait_for(reader.readline(), 15)
        if not line:
            writer.close()
            return
        parts = line.decode('latin-1').split()
        if len(parts) < 2:
            writer.close()
            return
        method, target = parts[0], parts[1]
        headers = {}
        while True:
            h = await asyncio.wait_for(reader.readline(), 15)
            if h in (b'\r\n', b'\n', b''):
                break
            k, _, v = h.decode('latin-1').partition(':')
            headers[k.strip().lower()] = v.strip()
    except Exception:
        writer.close()
        return

    url = urllib.parse.urlparse(target)
    path = urllib.parse.unquote(url.path)
    q = urllib.parse.parse_qs(url.query)

    if path == '/ws' and headers.get('upgrade', '').lower() == 'websocket':
        key = headers.get('sec-websocket-key', '')
        accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        writer.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                      'Sec-WebSocket-Accept: %s\r\n\r\n' % accept).encode())
        await writer.drain()
        ws = WS(reader, writer)
        try:
            role = q.get('role', [''])[0]
            if role == 'host':
                await run_host(ws, q)
            elif role == 'guest':
                await run_guest(ws, q)
        finally:
            ws.close()
        return

    if method != 'GET':
        await respond(writer, '405 Method Not Allowed', 'text/plain', b'')
        return

    if path in ('/rooms', '/rooms/'):
        data = [{'code': r.code, 'host': r.name, 'valley': r.valley, 'players': len(r.guests)} for r in rooms.values()]
        await respond(writer, '200 OK', 'application/json', json.dumps(data).encode())
        return

    if path.endswith('/'):
        path += 'index.html'
    rel = os.path.normpath(path.lstrip('/'))
    full = os.path.join(ROOT, rel)
    ext = os.path.splitext(full)[1].lower()
    ok = (os.path.commonpath([ROOT, os.path.abspath(full)]) == ROOT and not any(p.startswith('.') for p in rel.split(os.sep))
          and ext in TYPES and os.path.isfile(full) and not rel.startswith('tools'))
    if not ok:
        await respond(writer, '404 Not Found', 'text/plain; charset=utf-8', b'Not found')
        return
    with open(full, 'rb') as f:
        body = f.read()
    await respond(writer, '200 OK', TYPES[ext], body)


def lan_addresses():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ips.add(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            ips.add(ip)
    except Exception:
        pass
    return sorted(ip for ip in ips if not ip.startswith('127.'))


def main():
    ap = argparse.ArgumentParser(description='Nested co-op server')
    ap.add_argument('--port', type=int, default=8080)
    ap.add_argument('--bind', default='0.0.0.0', help='address to listen on (default: all interfaces)')
    args = ap.parse_args()

    async def serve():
        server = await asyncio.start_server(handle, args.bind, args.port)
        print('\n  Nested is running!\n')
        print('  On this computer:      http://localhost:%d' % args.port)
        for ip in lan_addresses():
            print('  On your network:       http://%s:%d' % (ip, args.port))
        print('\n  One player chooses "Host Co-op", friends choose "Join Co-op".')
        print('  Press Ctrl+C to stop.\n')
        async with server:
            await server.serve_forever()

    try:
        asyncio.run(serve())
    except KeyboardInterrupt:
        print('\n  Bye!')
    except OSError as e:
        print('Could not start the server: %s' % e)
        print('Is another program using port %d? Try: python3 server.py --port 8090' % args.port)
        sys.exit(1)


if __name__ == '__main__':
    main()
