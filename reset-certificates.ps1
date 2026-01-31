# Complete Certificate Reset Script
# Run this to completely clean and regenerate certificates

Write-Host "`n=== APInox Certificate Complete Reset ===" -ForegroundColor Cyan
Write-Host ""

# Check admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (!$isAdmin) {
    Write-Host "⚠️  WARNING: Not running as Administrator" -ForegroundColor Yellow
    Write-Host "   Some operations may fail. Consider running as Admin." -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: Remove all APInox certificates from stores
Write-Host "Step 1: Removing old certificates from Windows stores..." -ForegroundColor Yellow

try {
    $localMachineCerts = Get-ChildItem -Path Cert:\LocalMachine\Root -ErrorAction SilentlyContinue | Where-Object { $_.Subject -like "*APInox*" }
    if ($localMachineCerts) {
        Write-Host "  Found $($localMachineCerts.Count) certificate(s) in LocalMachine\Root"
        foreach ($cert in $localMachineCerts) {
            Write-Host "    Removing: $($cert.Thumbprint)" -ForegroundColor Gray
            $cert | Remove-Item -ErrorAction SilentlyContinue
        }
        Write-Host "  ✅ LocalMachine\Root cleaned" -ForegroundColor Green
    } else {
        Write-Host "  ✅ No certificates in LocalMachine\Root" -ForegroundColor Green
    }
} catch {
    Write-Host "  ❌ Failed to clean LocalMachine\Root: $_" -ForegroundColor Red
}

try {
    $currentUserCerts = Get-ChildItem -Path Cert:\CurrentUser\Root -ErrorAction SilentlyContinue | Where-Object { $_.Subject -like "*APInox*" }
    if ($currentUserCerts) {
        Write-Host "  Found $($currentUserCerts.Count) certificate(s) in CurrentUser\Root"
        foreach ($cert in $currentUserCerts) {
            Write-Host "    Removing: $($cert.Thumbprint)" -ForegroundColor Gray
            $cert | Remove-Item -ErrorAction SilentlyContinue
        }
        Write-Host "  ✅ CurrentUser\Root cleaned" -ForegroundColor Green
    } else {
        Write-Host "  ✅ No certificates in CurrentUser\Root" -ForegroundColor Green
    }
} catch {
    Write-Host "  ❌ Failed to clean CurrentUser\Root: $_" -ForegroundColor Red
}

Write-Host ""

# Step 2: Delete certificate files
Write-Host "Step 2: Deleting certificate files..." -ForegroundColor Yellow

$certPath = Join-Path $env:TEMP "apinox-proxy.cer"
$keyPath = Join-Path $env:TEMP "apinox-proxy.key"

if (Test-Path $certPath) {
    Remove-Item $certPath -Force
    Write-Host "  ✅ Deleted: $certPath" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  No cert file found" -ForegroundColor Gray
}

if (Test-Path $keyPath) {
    Remove-Item $keyPath -Force
    Write-Host "  ✅ Deleted: $keyPath" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  No key file found" -ForegroundColor Gray
}

Write-Host ""

# Step 3: Instructions for regeneration
Write-Host "Step 3: Regenerate certificate in APInox" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Close this window"
Write-Host "  2. Restart APInox (as Administrator if possible)"
Write-Host "  3. Open Debug Modal (Ctrl+Shift+D)"
Write-Host "  4. Go to 'Certificate & Proxy' tab"
Write-Host "  5. Click 'Regenerate Certificate'"
Write-Host "  6. Click 'Run Certificate Check'"
Write-Host "  7. Click 'Install Certificate'" -ForegroundColor Green
Write-Host ""

Write-Host "=== Reset Complete ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "What was done:" -ForegroundColor White
Write-Host "  ✓ Removed all APInox certificates from LocalMachine\Root"
Write-Host "  ✓ Removed all APInox certificates from CurrentUser\Root"
Write-Host "  ✓ Deleted certificate files from TEMP folder"
Write-Host ""

Write-Host "Next: Start APInox and regenerate certificate" -ForegroundColor Yellow
Write-Host ""

# Pause
Read-Host "Press Enter to close"
