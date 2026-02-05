# Certificate Installation Troubleshooting

## Problem
"Certificate not installed in any trust store" warning persists even after clicking "Install Certificate" or "Fix Certificate Location".

## Possible Causes

### 1. **Permission Issues** (Most Common)
Installing certificates to `LocalMachine\Root` requires **Administrator privileges**.

#### How to Check:
```powershell
# Run this to check if you have admin rights
([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
```

#### Solutions:
- **Option A**: Run APInox as Administrator (Right-click → Run as Administrator)
- **Option B**: Install certificate manually as Administrator:
  ```powershell
  # Run PowerShell as Administrator
  Import-Certificate -FilePath "$env:TEMP\apinox-proxy.cer" -CertStoreLocation Cert:\LocalMachine\Root
  ```

### 2. **Thumbprint Mismatch**
If you regenerated the certificate, the diagnostic might be checking for the OLD thumbprint while the NEW certificate is installed.

#### How to Check:
```powershell
# See what APInox certificates are actually installed
Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*APInox*" } | Format-List Subject, Thumbprint, NotAfter
```

#### Solution:
1. Run the verification script: `.\verify-cert-installation.ps1`
2. If multiple APInox certificates exist, remove old ones
3. In APInox: Run "Certificate Check" to get current thumbprint
4. Install fresh

### 3. **PowerShell Execution Errors**
The installation command might be failing silently.

#### How to Check:
Look at sidecar logs:
1. Open Debug Modal (`Ctrl+Shift+D`)
2. Expand "Sidecar Logs"
3. Look for lines containing `[Diagnostics] Installation`

#### Solution:
- Check for error messages in logs
- If "Access denied", run as Administrator
- If "ExecutionPolicy", run:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
  ```

### 4. **Cached Diagnostic Results**
The UI might be showing stale results.

#### Solution:
1. Close and reopen Debug Modal
2. Click "Run Certificate Check" again
3. Verify timestamp in results

### 5. **Certificate Not Actually Generated**
If proxy hasn't been started with HTTPS target, certificate files don't exist.

#### How to Check:
```powershell
Test-Path "$env:TEMP\apinox-proxy.cer"
Test-Path "$env:TEMP\apinox-proxy.key"
```

#### Solution:
1. Start proxy with an HTTPS target URL
2. Proxy will generate certificate on startup
3. Then run diagnostics

### 6. **Store Check Logic Issues**
The PowerShell command checking stores might not be working correctly.

#### How to Verify Manually:
Run our comprehensive verification script:
```powershell
.\verify-cert-installation.ps1
```

This will show:
- ✅ Exactly what certificates are installed
- ✅ Where they are (LocalMachine vs CurrentUser)
- ✅ If thumbprints match
- ✅ If you have admin privileges

## Step-by-Step Diagnosis

### Step 1: Run Verification Script
```powershell
# From APInox directory
.\verify-cert-installation.ps1
```

Expected output when working:
```
=== Certificate File ===
  Path: C:\Users\...\AppData\Local\Temp\apinox-proxy.cer
  Thumbprint: 648F243C2D755178D5E3C49D322708E8F95DCA58
  ...

=== LocalMachine\Root Store ===
  ✅ FOUND in LocalMachine\Root
  ...

=== Permission Check ===
  ✅ Running as Administrator
```

### Step 2: Check Sidecar Logs
1. `Ctrl+Shift+D` → Sidecar Logs
2. Look for:
   ```
   [Diagnostics] Installing certificate to LocalMachine\Root...
   [Diagnostics] Certificate loaded: 648F243C2D755178D5E3C49D322708E8F95DCA58
   [Diagnostics] Certificate installed successfully
   [Diagnostics] Installation verified
   ```
3. If you see errors, that's the root cause

### Step 3: Manual Installation Test
```powershell
# Run PowerShell as Administrator
$certPath = Join-Path $env:TEMP "apinox-proxy.cer"
Import-Certificate -FilePath $certPath -CertStoreLocation Cert:\LocalMachine\Root

# Verify
$thumbprint = (New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($certPath)).Thumbprint
Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Thumbprint -eq $thumbprint }
```

If this works, the issue is APInox not having admin privileges.

## Quick Fixes

### Fix 1: Run as Administrator
1. Close APInox
2. Right-click APInox → "Run as Administrator"
3. Open Debug Modal → Certificate & Proxy tab
4. Click "Install Certificate"

### Fix 2: Manual PowerShell Installation
```powershell
# Run as Administrator
Import-Certificate -FilePath "$env:TEMP\apinox-proxy.cer" -CertStoreLocation Cert:\LocalMachine\Root
```

### Fix 3: Clean Slate
```powershell
# 1. Remove old APInox certificates (as Administrator)
Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*APInox*" } | Remove-Item

# 2. In APInox: Click "Regenerate Certificate"
# 3. Run APInox as Administrator
# 4. Click "Install Certificate"
```

## Verification After Fix

After installing, verify with:
```powershell
.\verify-cert-installation.ps1
```

Should show:
```
✅ FOUND in LocalMachine\Root
```

Then in APInox:
1. Click "Run Certificate Check"
2. Should show: ✅ Certificate installed in LocalMachine\Root store
3. No warning about "not installed in any trust store"

## Still Not Working?

If certificate shows as installed but .NET client still fails:

1. **Check it's the RIGHT certificate**:
   ```powershell
   # Get thumbprint from file
   $fileCert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2("$env:TEMP\apinox-proxy.cer")
   Write-Host "File thumbprint: $($fileCert.Thumbprint)"
   
   # Get installed cert
   $installedCert = Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*APInox*" }
   Write-Host "Installed thumbprint: $($installedCert.Thumbprint)"
   
   # Must match!
   ```

2. **Check certificate properties**:
   ```powershell
   $cert = Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*APInox*" } | Select-Object -First 1
   $cert | Format-List Subject, Issuer, NotBefore, NotAfter, HasPrivateKey
   ```
   Should show `HasPrivateKey: False` (it's only a public certificate)

3. **Restart Windows** (sometimes required for system-wide certificate cache refresh)

## Logs to Share for Support

If asking for help, provide:
1. Output of `.\verify-cert-installation.ps1`
2. Sidecar logs from Debug Modal (look for `[Diagnostics]` lines)
3. Screenshot of Certificate & Proxy diagnostics tab
4. Whether you ran APInox as Administrator
