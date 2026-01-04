<#
.SYNOPSIS
    Diagnoses network connectivity to a WSDL endpoint, including proxy and DNS resolution.

.DESCRIPTION
    This script performs three levels of checks:
    1. Prints current Proxy configuration.
    2. Attempts DNS resolution for the target host.
    3. Attempts a direct HttpWebRequest connection to the URL, enforcing TLS 1.2/1.3.

.PARAMETER Url
    The full URL of the WSDL endpoint to test (e.g., "https://example.com/service?wsdl").

.EXAMPLE
    .\debug-wsdl.ps1 -Url "https://messaging.example.com/soap?wsdl"

.NOTES
    Run this script in a PowerShell terminal. If you are behind a corporate proxy, 
    ensure your terminal session inherits the system proxy or has HTTP_PROXY/HTTPS_PROXY environment variables set.
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Url
)

Write-Host "--- WSDL Connectivity Diagnostic (PowerShell) ---" -ForegroundColor Cyan
Write-Host "Target URL: $Url"

# 1. Print Proxy Configuration
Write-Host "`n1. Checking Proxy Configuration..." -ForegroundColor Yellow
$proxy = [System.Net.WebRequest]::DefaultWebProxy
if ($proxy) {
    Write-Host "DefaultWebProxy is set."
    Write-Host "Address: $($proxy.Address)"
    $creds = $proxy.Credentials
    if ($creds) {
        Write-Host "Credentials present: Yes"
    } else {
        Write-Host "Credentials present: No"
    }
} else {
    Write-Host "DefaultWebProxy is NULL (Direct connection)."
}

# Environment Variables
Write-Host "`nEnvironment Variables:"
Write-Host "HTTP_PROXY: $env:HTTP_PROXY"
Write-Host "HTTPS_PROXY: $env:HTTPS_PROXY"
Write-Host "NO_PROXY: $env:NO_PROXY"

# 2. DNS Resolution
try {
    $uri = [System.Uri]$Url
    Write-Host "`n2. DNS Resolution for $($uri.Host)..." -ForegroundColor Yellow
    $dns = [System.Net.Dns]::GetHostAddresses($uri.Host)
    $dns | ForEach-Object { Write-Host " - $_" }
} catch {
    Write-Host "DNS Resolution Failed: $_" -ForegroundColor Red
}

# 3. Connection Test
Write-Host "`n3. Testing Connection..." -ForegroundColor Yellow
try {
    # Force TLS 1.2/1.3
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13
    
    $request = [System.Net.WebRequest]::Create($Url)
    $request.Timeout = 10000 # 10 seconds
    
    # Use default credentials if needed
    $request.UseDefaultCredentials = $true
    
    # Log SSL callbacks?
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {
        param($sender, $certificate, $chain, $sslPolicyErrors)
        Write-Host "SSL Certificate Validation: $sslPolicyErrors"
        if ($certificate) {
            Write-Host " - Subject: $($certificate.Subject)"
            Write-Host " - Issuer: $($certificate.Issuer)"
        }
        return $true
    }

    $response = $request.GetResponse()
    Write-Host "Response Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Content Type: $($response.ContentType)"
    $stream = $response.GetResponseStream()
    $reader = [System.IO.StreamReader]::new($stream)
    $content = $reader.ReadToEnd()
    Write-Host "Content Preview: $($content.Substring(0, [Math]::Min($content.Length, 200)))..."
    
    $response.Close()
} catch {
    Write-Host "Connection FAILED: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode)"
    }
}
Write-Host "`n--- End Diagnostic ---" -ForegroundColor Cyan
