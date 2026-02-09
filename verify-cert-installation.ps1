# Manual Certificate Verification

## Check if Certificate is Actually Installed

Run this PowerShell script to see exactly what's happening:

```powershell
# Get certificate file info
$certPath = Join-Path $env:TEMP "apinox-proxy.cer"
Write-Host "=== Certificate File ===" -ForegroundColor Cyan
if (Test-Path $certPath) {
    $fileCert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($certPath)
    Write-Host "  Path: $certPath" -ForegroundColor Green
    Write-Host "  Thumbprint: $($fileCert.Thumbprint)" -ForegroundColor Yellow
    Write-Host "  Subject: $($fileCert.Subject)"
    Write-Host "  Valid: $($fileCert.NotBefore) to $($fileCert.NotAfter)"
    
    # Check LocalMachine\Root
    Write-Host "`n=== LocalMachine\Root Store ===" -ForegroundColor Cyan
    $localMachineCerts = Get-ChildItem -Path Cert:\LocalMachine\Root -ErrorAction SilentlyContinue | Where-Object { $_.Thumbprint -eq $fileCert.Thumbprint }
    if ($localMachineCerts) {
        Write-Host "  ✅ FOUND in LocalMachine\Root" -ForegroundColor Green
        Write-Host "  Subject: $($localMachineCerts.Subject)"
    } else {
        Write-Host "  ❌ NOT FOUND in LocalMachine\Root" -ForegroundColor Red
        Write-Host "  Searching all LocalMachine\Root certs for 'APInox'..."
        $allLocalMachine = Get-ChildItem -Path Cert:\LocalMachine\Root -ErrorAction SilentlyContinue | Where-Object { $_.Subject -like "*APInox*" }
        if ($allLocalMachine) {
            Write-Host "  Found $($allLocalMachine.Count) APInox certificate(s):" -ForegroundColor Yellow
            foreach ($cert in $allLocalMachine) {
                Write-Host "    - Thumbprint: $($cert.Thumbprint)"
                Write-Host "      Subject: $($cert.Subject)"
            }
        } else {
            Write-Host "  No APInox certificates found in LocalMachine\Root" -ForegroundColor Yellow
        }
    }
    
    # Check CurrentUser\Root
    Write-Host "`n=== CurrentUser\Root Store ===" -ForegroundColor Cyan
    $currentUserCerts = Get-ChildItem -Path Cert:\CurrentUser\Root -ErrorAction SilentlyContinue | Where-Object { $_.Thumbprint -eq $fileCert.Thumbprint }
    if ($currentUserCerts) {
        Write-Host "  ✅ FOUND in CurrentUser\Root" -ForegroundColor Green
        Write-Host "  Subject: $($currentUserCerts.Subject)"
    } else {
        Write-Host "  ❌ NOT FOUND in CurrentUser\Root" -ForegroundColor Red
        Write-Host "  Searching all CurrentUser\Root certs for 'APInox'..."
        $allCurrentUser = Get-ChildItem -Path Cert:\CurrentUser\Root -ErrorAction SilentlyContinue | Where-Object { $_.Subject -like "*APInox*" }
        if ($allCurrentUser) {
            Write-Host "  Found $($allCurrentUser.Count) APInox certificate(s):" -ForegroundColor Yellow
            foreach ($cert in $allCurrentUser) {
                Write-Host "    - Thumbprint: $($cert.Thumbprint)"
                Write-Host "      Subject: $($cert.Subject)"
            }
        } else {
            Write-Host "  No APInox certificates found in CurrentUser\Root" -ForegroundColor Yellow
        }
    }
    
    # Manual installation instructions
    Write-Host "`n=== Manual Installation ===" -ForegroundColor Cyan
    Write-Host "If certificate is not found, install manually:"
    Write-Host "  1. Run PowerShell as Administrator" -ForegroundColor Yellow
    Write-Host "  2. Run this command:" -ForegroundColor Yellow
    Write-Host "     Import-Certificate -FilePath '$certPath' -CertStoreLocation Cert:\LocalMachine\Root" -ForegroundColor White
    
} else {
    Write-Host "  ❌ Certificate file not found!" -ForegroundColor Red
    Write-Host "  Expected at: $certPath"
    Write-Host "  Generate by starting proxy with HTTPS target"
}

Write-Host "`n=== Permission Check ===" -ForegroundColor Cyan
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if ($isAdmin) {
    Write-Host "  ✅ Running as Administrator" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  NOT running as Administrator" -ForegroundColor Yellow
    Write-Host "  Installing to LocalMachine\Root requires admin privileges"
}
```

## Common Issues

### Issue 1: Multiple Certificates
If you regenerated the certificate multiple times, there might be old certificates in the store with different thumbprints.

**Solution**: Remove old APInox certificates manually:
```powershell
# List all APInox certificates
Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*APInox*" }

# Remove a specific certificate by thumbprint
Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Thumbprint -eq "OLD_THUMBPRINT_HERE" } | Remove-Item
```

### Issue 2: Permissions
The Node.js process may not have permission to install to LocalMachine\Root.

**Solution**: Run APInox as Administrator, or install certificate manually:
```powershell
# Run as Administrator
Import-Certificate -FilePath "$env:TEMP\apinox-proxy.cer" -CertStoreLocation Cert:\LocalMachine\Root
```

### Issue 3: Thumbprint Mismatch
The certificate file might have been regenerated, but the old thumbprint is being checked.

**Solution**: 
1. Click "Regenerate Certificate" in diagnostics
2. Wait for success message
3. Click "Run Certificate Check" to get new thumbprint
4. Click "Install Certificate"

### Issue 4: Cached Results
The diagnostic check might be showing cached results.

**Solution**: Restart APInox and run diagnostics again.

### Issue 5: PowerShell Execution Policy
PowerShell might be blocking script execution.

**Solution**: Run as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

Then try installing again through APInox.

## Verification Command

Quick check if certificate is installed:
```powershell
$thumbprint = "YOUR_THUMBPRINT_HERE"  # Replace with actual thumbprint
$cert = Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Thumbprint -eq $thumbprint }
if ($cert) {
    Write-Host "✅ Certificate IS installed in LocalMachine\Root" -ForegroundColor Green
} else {
    Write-Host "❌ Certificate NOT installed in LocalMachine\Root" -ForegroundColor Red
}
```
