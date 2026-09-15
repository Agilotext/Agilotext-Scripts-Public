#!/usr/bin/env python3
"""Sert la fixture tour v2 sous /app/premium/dashboard pour Chrome headless."""
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURE = os.path.join(ROOT, "tests/fixtures/agilo-tour-v2-recette.html")
RESULT = os.path.join("/tmp", "agilo-tour-v2-recette.json")
APP_PATHS = {
    "/",
    "/app/premium/dashboard",
    "/app/free/dashboard",
    "/app/premium/mes-transcripts",
    "/app/premium/editor",
    "/app/premium/dashboard/anonymiser",
    "/app/premium/support",
    "/tests/fixtures/agilo-tour-v2-recette.html",
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_HEAD(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path != "/recette-result":
            self.send_error(404)
            return
        n = int(self.headers.get("Content-Length", "0") or 0)
        body = self.rfile.read(n)
        with open(RESULT, "wb") as f:
            f.write(body)
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/recette-result":
            if not os.path.isfile(RESULT):
                self.send_error(404)
                return
            return self._send_file(RESULT, "application/json; charset=utf-8")
        if path in APP_PATHS:
            return self._send_file(FIXTURE, "text/html; charset=utf-8")
        if path.endswith(".js"):
            full = os.path.join(ROOT, path.lstrip("/"))
            if os.path.isfile(full):
                return self._send_file(full, "application/javascript; charset=utf-8")
        self.send_error(404)

    def _send_file(self, full, ctype):
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    try:
        os.remove(RESULT)
    except OSError:
        pass
    port = int(os.environ.get("PORT", "8765"))
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
