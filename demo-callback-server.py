#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8") if length > 0 else ""
        try:
            payload = json.loads(body) if body else None
        except json.JSONDecodeError:
            payload = body

        print("\n=== Callback Received ===")
        print(f"Path: {self.path}")
        print(f"Headers: {dict(self.headers)}")
        print(f"Body: {payload}")

        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, format, *args):
        return


def main():
    host = "127.0.0.1"
    port = 9011
    server = HTTPServer((host, port), Handler)
    print(f"Callback server listening on http://{host}:{port}/callback")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
