"""Serve the local game and its own ISO-derived resources; no remote services."""
import http.server
import pathlib
import functools
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=3737)
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent / 'dist'

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def log_message(self, fmt, *args):
        if args and '404' in str(args):
            super().log_message(fmt, *args)

server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), functools.partial(Handler, directory=str(root)))
print(f'Moment 37 is running at http://localhost:{args.port}', flush=True)
server.serve_forever()
