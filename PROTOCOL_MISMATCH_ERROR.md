# EPROTO: wrong version number - Protocol Mismatch

## The Real Problem

The error `EPROTO: write EPROTO ... wrong version number` means:
**Your .NET client is using the WRONG protocol (HTTP vs HTTPS) to connect to the proxy.**

This is NOT a certificate issue - it's a URL protocol mismatch!

## Root Cause

When APInox proxy targets an HTTPS URL:
- ✅ Proxy becomes an **HTTPS server** on port 9000
- ❌ Your .NET client is connecting with **HTTP** (not HTTPS)

The server expects a TLS handshake, but the client sends plain HTTP - hence "wrong version number".

## How to Fix

### Option 1: Fix Your .NET Client URL (RECOMMENDED)

Change your .NET client endpoint to use **https://** not **http://**:

```csharp
// WRONG - causes "wrong version number" error
var endpoint = new EndpointAddress("http://localhost:9000/YourService");

// CORRECT - matches HTTPS proxy
var endpoint = new EndpointAddress("https://localhost:9000/YourService");
```

### Option 2: Use HTTP Target in Proxy

If your .NET client MUST use HTTP:
1. In APInox, set proxy target to HTTP (not HTTPS)
2. Proxy will be HTTP server, client connects with HTTP
3. No certificate needed

## Verification

### Check What Protocol Proxy Is Using:

Look at APInox logs when proxy starts:
```
[ProxyService] APInox Proxy listening on port 9000 (HTTPS)  ← Proxy is HTTPS
[ProxyService] APInox Proxy listening on port 9000 (HTTP)   ← Proxy is HTTP
```

### Check What Protocol Your Client Uses:

In your .NET code, look at the endpoint URL:
```csharp
// If proxy target is HTTPS, this MUST be https://
var endpoint = new EndpointAddress("https://localhost:9000/YourService");
```

## The Rule

**Simple rule: Match your client protocol to proxy server protocol**

| Proxy Target URL | Proxy Server Protocol | Client Must Use |
|------------------|----------------------|-----------------|
| `https://api.example.com` | HTTPS (port 9000) | `https://localhost:9000` |
| `http://api.example.com` | HTTP (port 9000) | `http://localhost:9000` |

## Why This Happens

1. User sets APInox proxy target: `https://realserver.com/api`
2. APInox starts **HTTPS** proxy on port 9000
3. .NET client connects to: `http://localhost:9000` (HTTP)
4. Proxy expects TLS handshake, gets HTTP request
5. Error: "wrong version number" (TLS version bytes don't match HTTP bytes)

## Visual Explanation

```
❌ WRONG (Causes Error):
.NET Client (HTTP) → http://localhost:9000 → Proxy (HTTPS expecting TLS) → ERROR!

✅ CORRECT:
.NET Client (HTTPS) → https://localhost:9000 → Proxy (HTTPS) → Target (HTTPS)
```

## Quick Test

Test with curl to confirm:

```bash
# If proxy is HTTPS, this should work:
curl -k https://localhost:9000

# If proxy is HTTPS, this will give "wrong version number":
curl http://localhost:9000
```

## Certificate Is NOT The Problem

The certificate warnings you saw earlier are **separate** from this protocol error.

**This specific error** (`wrong version number`) means:
- ❌ NOT a certificate trust issue
- ❌ NOT a certificate corruption issue
- ✅ **Protocol mismatch (HTTP vs HTTPS)**

## Fix Checklist

- [ ] Check APInox logs - is proxy HTTPS or HTTP?
- [ ] Check .NET client code - using `https://` or `http://`?
- [ ] Match client protocol to proxy protocol
- [ ] Test with curl to verify proxy protocol
- [ ] Restart proxy after fixing client URL

## After Fixing

Once protocols match, you might see:
- Certificate trust errors (expected with self-signed cert)
- TLS handshake errors (if cert not installed)

But you will NOT see "wrong version number" anymore.

## Summary

**The error means: Client speaks HTTP, Server speaks HTTPS (or vice versa)**

Fix: Change your .NET client URL from `http://localhost:9000` to `https://localhost:9000`

That's it! No certificate regeneration needed for this error.
