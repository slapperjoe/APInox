# Fixing .NET WCF TLS Connection to APInox Proxy

## Problem
.NET WCF client throws: `WebException: The underlying connection was closed: An unexpected error occurred on a send.`
Inner exception: `The handshake failed due to an unexpected packet format.`

All diagnostics pass green, but connection still fails.

## Root Cause
Even though Node.js can use the certificate, .NET WCF has stricter requirements and may not support the same TLS protocols/ciphers.

## Solutions Applied

### 1. Enhanced Proxy TLS Configuration
**File**: `src/services/ProxyService.ts`

Added .NET WCF compatibility:
- **Min TLS version**: TLSv1.2 (matches .NET default)
- **Max TLS version**: TLSv1.3
- **Cipher suites**: Added .NET-compatible ciphers (AES-GCM, AES-SHA)
- **TLS error logging**: See what's failing in real-time

### 2. TLS Error Monitoring
The proxy now logs TLS handshake errors:
```
[ProxyService] TLS Error: ECONNRESET - socket hang up
```

Check the sidecar logs (Ctrl+Shift+D → Logs tab) when your .NET client connects.

### 3. New Diagnostic: Test Proxy Connection
Added `testProxyConnection` command that:
- Makes an actual HTTPS request to the proxy
- Reports the exact TLS protocol and cipher used
- Shows the same error your .NET client sees

## How to Diagnose

### Step 1: Run Diagnostics in APInox
1. Press `Ctrl+Shift+D` to open Debug modal
2. Click "🔧 Certificate & Proxy" tab
3. Click "Run Certificate Check"
4. **New test added**: "Testing connection to running proxy..."
   - If this fails with same error as .NET, the issue is TLS compatibility
   - If this passes, the issue is .NET-specific configuration

### Step 2: Run Test Script
```bash
node test-proxy-tls.js
```

This will:
- Check certificate properties (CA flag, key usage, SAN)
- Test TLS 1.2 and 1.3 connections
- Try .NET-compatible cipher suites
- Show which protocol/cipher works

### Step 3: Check Sidecar Logs
1. Open Debug modal (`Ctrl+Shift+D`)
2. Expand "Sidecar Logs"
3. Look for:
   ```
   [ProxyService] TLS Client Error: ...
   [ProxyService] Secure connection established: Protocol=TLSv1.2, Cipher=ECDHE-RSA-AES256-GCM-SHA384
   ```

## .NET Client Configuration

Your .NET WCF client may need these settings:

### 1. Force TLS 1.2
```csharp
// Before creating WCF client
ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls13;
```

### 2. Correct Endpoint URL
```csharp
// MUST use HTTPS when proxy targets HTTPS
var endpoint = new EndpointAddress("https://localhost:9000/YourService");
```

### 3. WCF Binding Security
```xml
<basicHttpBinding>
  <binding name="YourBinding">
    <security mode="Transport">
      <transport clientCredentialType="None" />
    </security>
  </binding>
</basicHttpBinding>
```

### 4. Trust Certificate Programmatically (testing only)
```csharp
// ONLY for testing - bypasses certificate validation
ServicePointManager.ServerCertificateValidationCallback = 
    (sender, certificate, chain, sslPolicyErrors) => true;
```

## Common Issues

### Issue 1: Certificate not in LocalMachine store
**Symptom**: Error 1312, or .NET can't find certificate
**Fix**: Click "Fix Certificate Location" in diagnostics tab

### Issue 2: TLS version mismatch
**Symptom**: "protocol version" error
**Fix**: Check test-proxy-tls.js output - if TLS 1.2 fails, proxy needs older protocols

### Issue 3: Cipher suite mismatch
**Symptom**: "no shared cipher" or "handshake failure"
**Fix**: Proxy now supports .NET ciphers (AES-GCM-SHA384, AES-GCM-SHA256, etc.)

### Issue 4: SNI (Server Name Indication) mismatch
**Symptom**: TLS error about server name
**Fix**: 
- Use "localhost" in your .NET client URL (not 127.0.0.1)
- Certificate has SAN: DNS=localhost

### Issue 5: Certificate has cA: true flag
**Symptom**: Some clients reject it as invalid server cert
**Fix**: Click "Regenerate Certificate" - new cert has `cA: false`

## Verification Steps

1. **Restart APInox** after building to load new proxy code
2. **Start proxy** with HTTPS target
3. **Run diagnostics** - all should be green INCLUDING "Proxy connection successful"
4. **Check logs** for TLS connection messages
5. **Test .NET client** - check sidecar logs for TLS errors when client connects
6. If still failing, **run test-proxy-tls.js** and share output

## Expected Output (Working)

### Diagnostics Tab
```
✅ Certificate exists
✅ Certificate in LocalMachine\Root
✅ HTTPS server test passed
✅ Proxy connection successful
   Protocol: TLSv1.2, Cipher: ECDHE-RSA-AES256-GCM-SHA384
```

### Sidecar Logs
```
[ProxyService] Secure connection established: Protocol=TLSv1.2, Cipher=ECDHE-RSA-AES256-GCM-SHA384
```

### Test Script
```
✅ Testing TLS 1.2... SUCCESS - Protocol: TLSv1.2, Cipher: ECDHE-RSA-AES256-GCM-SHA384
✅ Connection successful with .NET-compatible ciphers
```

## Still Not Working?

If diagnostics show "Proxy connection successful" but .NET still fails:

1. **Check .NET app code**:
   - Using `https://` not `http://`
   - SecurityProtocol set to TLS 1.2
   - Correct port (9000)

2. **Check binding configuration**:
   - Security mode: Transport
   - ClientCredentialType: None

3. **Share diagnostic output**:
   - Screenshot of diagnostics tab
   - Sidecar logs when .NET client connects
   - Output of test-proxy-tls.js
   - .NET exception stack trace

## Quick Fix Checklist

- [ ] Rebuild sidecar: `cd sidecar && npm run build`
- [ ] Restart APInox
- [ ] Click "Regenerate Certificate" in diagnostics (gets new cert with correct properties)
- [ ] Click "Fix Certificate Location" (moves to LocalMachine)
- [ ] Start proxy with HTTPS target
- [ ] Run diagnostics - verify "Proxy connection successful"
- [ ] Add `ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;` to .NET code
- [ ] Verify .NET uses `https://localhost:9000` URL
- [ ] Test .NET client
