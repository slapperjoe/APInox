# Certificate Installation Troubleshooting

## Problem
"Certificate not installed in any trust store" warning persists even after clicking "Install Certificate" or "Fix Certificate Location".

## Possible Causes

### 1. Permission Issues (Most Common)
Installing certificates to `LocalMachine\Root` requires Administrator privileges.

#### How to Check:
```powershell
# Run this to check if you have admin rights
([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
```

#### Quick Solution:
1. Run the verification script: `.
scripts\verify-cert-installation.ps1`

```powershell
# Run PowerShell as Administrator and install the cert manually if needed
Import-Certificate -FilePath "$env:TEMP\apinox-proxy.cer" -CertStoreLocation Cert:\LocalMachine\Root
```

### 2. Thumbprint Mismatch
If you regenerated the certificate, the diagnostic might be checking for the OLD thumbprint while the NEW certificate is installed.

#### How to Check:
```powershell
# See what APInox certificates are actually installed
Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*APInox*" } | Format-List Subject, Thumbprint, NotAfter
```

#### Solution:
1. Run the verification script: `.
scripts\verify-cert-installation.ps1`
2. If multiple APInox certificates exist, remove old ones
3. In APInox: Run "Certificate Check" to get current thumbprint
4. Install fresh

### 3. PowerShell Execution Errors
The installation command might be failing silently. Check sidecar logs in Debug Modal for `[Diagnostics]` messages.

### 4. Cached Diagnostic Results
Close and reopen Debug Modal, then click "Run Certificate Check" again.

### 5. Certificate Not Generated
Ensure the proxy was started with an HTTPS target so the certificate files are generated.

### 6. Store Check Logic Issues
If unsure, run the full verification script below.

## Verification Script
Run the comprehensive verification script:
```powershell
.\scripts\verify-cert-installation.ps1
```

This will show where the certificate is installed and whether thumbprints match.

## Manual Installation Test
```powershell
# Run PowerShell as Administrator
$certPath = Join-Path $env:TEMP "apinox-proxy.cer"
Import-Certificate -FilePath $certPath -CertStoreLocation Cert:\LocalMachine\Root

# Verify
$thumbprint = (New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($certPath)).Thumbprint
Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Thumbprint -eq $thumbprint }
```

## Quick Fixes
- Run APInox as Administrator and retry installation
- Install the certificate manually with the command above
- Remove old APInox certificates and regenerate the cert if needed

## Logs to Share for Support
Provide:
1. Output of `.
scripts\verify-cert-installation.ps1`
2. Sidecar logs from Debug Modal (look for `[Diagnostics]` lines)
3. Screenshot of Certificate & Proxy diagnostics tab
4. Whether you ran APInox as Administrator
