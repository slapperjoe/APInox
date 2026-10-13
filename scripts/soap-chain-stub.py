#!/usr/bin/env python3
"""
APInox traffic-workflow demo stub.

A tiny plain-HTTP SOAP service with a 3-step flow whose responses chain into
later requests, so the Proxy panel's "Create workflow" wizard can demo
auto-detected chained values end-to-end:

    1. POST /login   -> response contains <SessionToken>TKN-999</SessionToken>
    2. POST /data    -> request carries <Auth>TKN-999</Auth> (from step 1's
       response); response contains <OrderId>ORD-4829</OrderId>
    3. POST /confirm -> request carries <OrderId>ORD-4829</OrderId> (from step
       2's response); response contains <AccountNo>ACC-7Q2M1X</AccountNo>

Values are fixed on purpose: deterministic, easy to eyeball, and the wizard's
suggested variable names (tkn_999 / ord_4829) stay stable.

Run: python3 scripts/soap-chain-stub.py [port]   (default 9092)

Capture through the APInox proxy (port 8888, Proxy panel) with:

    curl -s -x http://127.0.0.1:8888 http://127.0.0.1:9092/login \
         -H 'Content-Type: text/xml; charset=utf-8' -H 'SOAPAction: "urn:apinox/demo/Login"' \
         -d '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:apinox/demo"><soapenv:Body><urn:Login><urn:User>mark</urn:User></urn:Login></soapenv:Body></soapenv:Envelope>'

    curl -s -x http://127.0.0.1:8888 http://127.0.0.1:9092/data \
         -H 'Content-Type: text/xml; charset=utf-8' -H 'SOAPAction: "urn:apinox/demo/Data"' \
         -d '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:apinox/demo"><soapenv:Body><urn:Data><urn:Auth>TKN-999</urn:Auth></urn:Data></soapenv:Body></soapenv:Envelope>'

    curl -s -x http://127.0.0.1:8888 http://127.0.0.1:9092/confirm \
         -H 'Content-Type: text/xml; charset=utf-8' -H 'SOAPAction: "urn:apinox/demo/Confirm"' \
         -d '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:apinox/demo"><soapenv:Body><urn:Confirm><urn:OrderId>ORD-4829</urn:OrderId></urn:Confirm></soapenv:Body></soapenv:Envelope>'

Then: APInox Proxy panel -> "Create workflow" -> the wizard should list the 3
requests in fire order with both chained values pre-accepted.
"""
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

NS = "urn:apinox/demo"

LOGIN_RESPONSE = (
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
    f'<soap:Body><LoginResponse xmlns="{NS}">'
    '<Result>ok</Result>'
    '<SessionToken>TKN-999</SessionToken>'
    '</LoginResponse></soap:Body></soap:Envelope>'
)

DATA_RESPONSE = (
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
    f'<soap:Body><DataResponse xmlns="{NS}">'
    '<Auth>TKN-999</Auth>'
    '<OrderId>ORD-4829</OrderId>'
    '</DataResponse></soap:Body></soap:Envelope>'
)

CONFIRM_RESPONSE = (
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
    f'<soap:Body><ConfirmResponse xmlns="{NS}">'
    '<OrderId>ORD-4829</OrderId>'
    '<AccountNo>ACC-7Q2M1X</AccountNo>'
    '</ConfirmResponse></soap:Body></soap:Envelope>'
)

ROUTES = {"/login": LOGIN_RESPONSE, "/data": DATA_RESPONSE, "/confirm": CONFIRM_RESPONSE}


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        _ = self.rfile.read(length)  # drain the request body
        body = ROUTES.get(self.path)
        if body is None:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"404: unknown route (try /login, /data, /confirm)")
            return
        data = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/xml; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format, *args):
        print("[soap-chain-stub] " + format % args, flush=True)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9092
    print(f"[soap-chain-stub] listening on http://127.0.0.1:{port} "
          f"(routes: {', '.join(ROUTES)})", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
