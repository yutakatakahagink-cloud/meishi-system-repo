#Requires -Version 5.1
param(
  [string]$StartPage = "owner.html"
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Pub = Join-Path $Root "meishi-app\public"
$Index = Join-Path $Pub "index.html"

if (-not (Test-Path -LiteralPath $Index)) {
    Write-Host "[ERROR] Missing file:" $Index -ForegroundColor Red
    exit 1
}

$StartPage = ($StartPage -replace '^\s+|\s+$', '')
if (-not $StartPage) { $StartPage = "owner.html" }
if ($StartPage -notmatch '\.html$') { $StartPage = "$StartPage.html" }

function Find-PythonExe {
    foreach ($name in @("python", "py")) {
        $g = Get-Command $name -ErrorAction SilentlyContinue
        if ($g -and $g.Source) { return $g.Source }
    }
    return $null
}

function Test-PortInUse([int]$port) {
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $c.Connect("127.0.0.1", $port)
        $c.Close()
        return $true
    } catch {
        return $false
    }
}

$pyExe = Find-PythonExe
if (-not $pyExe) {
    Write-Host "[ERROR] Python not in PATH. Install from python.org and check Add to PATH." -ForegroundColor Red
    exit 1
}

$port = 8791
while (Test-PortInUse $port) {
    $port++
    if ($port -gt 8799) {
        Write-Host "[ERROR] No free port 8791-8799." -ForegroundColor Red
        exit 1
    }
}

$url = "http://127.0.0.1:$port/$StartPage"
Write-Host "Folder:" $Pub
Write-Host "Python:" $pyExe
Write-Host "Open:  " $url
Write-Host ""

$p = Start-Process -FilePath $pyExe -ArgumentList @("-m", "http.server", "$port") -WorkingDirectory $Pub -PassThru -WindowStyle Normal

$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    if ($p.HasExited) {
        Write-Host "[ERROR] Python exited. Check the Python window for errors." -ForegroundColor Red
        exit 1
    }
    try {
        Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
        $ready = $true
        break
    } catch {
        Start-Sleep -Milliseconds 400
    }
}

if (-not $ready) {
    Write-Host "[WARN] Timeout waiting for server. Open this URL manually:" -ForegroundColor Yellow
    Write-Host $url
}

try {
    Start-Process $url
} catch {
    Write-Host "[WARN] Could not start browser. Copy URL above." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Server runs in the Python window. Close that window to stop."
Write-Host ""
