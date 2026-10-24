"""سرور ساختگی BigBlueButton برای آزمون: checksum را بررسی می‌کند و حاضران/ضبط‌ها را از /control می‌گیرد"""
import hashlib, json, time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qsl
SECRET = 'testsecret'
STATE = {'meetings': {}, 'attendees': {}, 'recordings': {}, 'calls': []}
def ok(body=''): return f'<response><returncode>SUCCESS</returncode>{body}</response>'
def fail(key, msg=''): return f'<response><returncode>FAILED</returncode><messageKey>{key}</messageKey><message>{msg}</message></response>'
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body, ctype='text/xml'):
        b = body.encode(); self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0)); d = json.loads(self.rfile.read(n) or b'{}')
        if self.path == '/control': STATE['attendees'].update(d.get('attendees', {})); STATE['recordings'].update(d.get('recordings', {})); return self.send(200, '{}', 'application/json')
    def do_GET(self):
        u = urlparse(self.path)
        if u.path == '/state': return self.send(200, json.dumps(STATE), 'application/json')
        call = u.path.rsplit('/', 1)[-1]; q = u.query
        base, _, cs = q.rpartition('&checksum=')
        if hashlib.sha1((call + base + SECRET).encode()).hexdigest() != cs: return self.send(200, fail('checksumError', 'bad checksum'))
        p = dict(parse_qsl(base)); STATE['calls'].append({'call': call, **p})
        mid = p.get('meetingID')
        if call == 'create': STATE['meetings'][mid] = p; return self.send(200, ok(f'<meetingID>{mid}</meetingID>'))
        if call == 'join': return self.send(200, '<html>joined</html>', 'text/html')
        if call == 'getMeetingInfo':
            if mid not in STATE['meetings']: return self.send(200, fail('notFound'))
            a = ''.join(f'<attendee><userID>{x}</userID><fullName>x</fullName></attendee>' for x in STATE['attendees'].get(mid, []))
            return self.send(200, ok(f'<running>true</running><attendees>{a}</attendees>'))
        if call == 'getRecordings':
            rs = STATE['recordings'].get(mid, [])
            if not rs: return self.send(200, ok('<recordings></recordings><messageKey>noRecordings</messageKey>'))
            x = ''.join(f'<recording><recordID>{r}</recordID><startTime>{int(time.time()*1000)-3600000}</startTime><endTime>{int(time.time()*1000)}</endTime><playback><format><type>presentation</type><url>https://bbb.test/playback/{r}</url></format></playback></recording>' for r in rs)
            return self.send(200, ok(f'<recordings>{x}</recordings>'))
        if call == 'deleteRecordings': return self.send(200, ok('<deleted>true</deleted>'))
        return self.send(200, fail('unsupported'))
HTTPServer(('127.0.0.1', 9300), H).serve_forever()
