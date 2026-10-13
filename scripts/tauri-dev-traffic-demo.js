#!/usr/bin/env node
/**
 * Boot the APInox traffic-workflow demo: the local SOAP chain stub + the
 * Tauri dev build, in one command.
 *
 *   npm run tauri:dev:traffic-demo
 *
 * The stub (scripts/soap-chain-stub.py) serves a deterministic 3-step SOAP
 * flow on http://127.0.0.1:9092 whose responses chain into the next
 * requests (TKN-999 -> ORD-4829 -> ACC-7Q2M1X). Capture those calls through
 * the Proxy panel (port 8888) using the curl lines printed at startup, then
 * hit "Create workflow" in the Proxy panel to drive the wizard.
 *
 * Ctrl+C tears the stub down (SIGKILL, so it never survives the session).
 */
"use strict";

const { spawn } = require("child_process");
const path = require("path");

const STUB_PORT = process.env.SOAP_STUB_PORT || "9092";
const PROXY_PORT = process.env.APINOX_PROXY_PORT || "8888";
const stubPath = path.join(__dirname, "soap-chain-stub.py");

const python = process.platform === "win32" ? "python" : "python3";

const stub = spawn(python, [stubPath, STUB_PORT], { stdio: "inherit" });

const child = spawn("npm", ["run", "tauri:dev"], { stdio: "inherit", shell: true });

let cleaned = false;
function cleanup() {
    if (cleaned) return;
    cleaned = true;
    try { stub.kill("SIGKILL"); } catch { /* already gone */ }
}

child.on("exit", (code) => {
    cleanup();
    // Let the stub's death settle before exiting.
    setTimeout(() => process.exit(code == null ? 0 : code), 100);
});

process.on("SIGINT", () => {
    cleanup();
    child.kill("SIGINT");
});
process.on("SIGTERM", () => {
    cleanup();
    child.kill("SIGTERM");
});

stub.on("exit", (code, signal) => {
    if (cleaned) return; // we killed it on teardown
    console.error(`[tauri:dev:traffic-demo] stub exited unexpectedly (code=${code} signal=${signal}); tearing down.`);
    child.kill("SIGINT");
});

console.log(`
[tauri:dev:traffic-demo] SOAP chain stub on http://127.0.0.1:${STUB_PORT}
[tauri:dev:traffic-demo] start the APInox Proxy (panel default port ${PROXY_PORT}), then run:

  curl -s -x http://127.0.0.1:${PROXY_PORT} http://127.0.0.1:${STUB_PORT}/login \\
       -H 'Content-Type: text/xml; charset=utf-8' -H 'SOAPAction: "urn:apinox/demo/Login"' \\
       -d '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:apinox/demo"><soapenv:Body><urn:Login><urn:User>mark</urn:User></urn:Login></soapenv:Body></soapenv:Envelope>'

  curl -s -x http://127.0.0.1:${PROXY_PORT} http://127.0.0.1:${STUB_PORT}/data \\
       -H 'Content-Type: text/xml; charset=utf-8' -H 'SOAPAction: "urn:apinox/demo/Data"' \\
       -d '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:apinox/demo"><soapenv:Body><urn:Data><urn:Auth>TKN-999</urn:Auth></urn:Data></soapenv:Body></soapenv:Envelope>'

  curl -s -x http://127.0.0.1:${PROXY_PORT} http://127.0.0.1:${STUB_PORT}/confirm \\
       -H 'Content-Type: text/xml; charset=utf-8' -H 'SOAPAction: "urn:apinox/demo/Confirm"' \\
       -d '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:apinox/demo"><soapenv:Body><urn:Confirm><urn:OrderId>ORD-4829</urn:OrderId></urn:Confirm></soapenv:Body></soapenv:Envelope>'

[tauri:dev:traffic-demo] then: Proxy panel -> "Create workflow"
`);
