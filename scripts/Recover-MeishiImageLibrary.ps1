#Requires -Version 5.1
# Edge Local Storage から画像保存ボックスを復元し Firebase hh_data/meishi_image_library へ投入
param(
  [string]$ConfigJs = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceRoot = Split-Path -Parent $ScriptDir
if (-not $ConfigJs) {
  $ConfigJs = Join-Path $SourceRoot "meishi-app\public\config.js"
}
if (-not (Test-Path -LiteralPath $ConfigJs)) {
  throw "config.js not found: $ConfigJs"
}
$cfgText = Get-Content -LiteralPath $ConfigJs -Raw -Encoding UTF8
if ($cfgText -notmatch 'apiKey:\s*"([^"]+)"') { throw "apiKey not found in config.js" }
$apiKey = $Matches[1]
if ($cfgText -notmatch 'databaseURL:\s*"([^"]+)"') { throw "databaseURL not found in config.js" }
$DbUrl = $Matches[1].TrimEnd('/')

$ldb = Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data\Default\Local Storage\leveldb"
if (-not (Test-Path -LiteralPath $ldb)) {
  throw "Edge leveldb not found: $ldb"
}

$urls = @{}
Get-ChildItem -LiteralPath $ldb -Filter *.ldb | ForEach-Object {
  $text = [IO.File]::ReadAllText($_.FullName)
  foreach ($m in [regex]::Matches($text, 'data:image/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\r\n]+')) {
    $src = ($m.Value -replace '\s', '')
    $key = $src.Substring(0, [Math]::Min(80, $src.Length))
    if (-not $urls.ContainsKey($key)) { $urls[$key] = $src }
  }
}
$sortedUrls = $urls.Values | Sort-Object { $_.Length }
if (-not $sortedUrls.Count) { throw "No data:image found in Edge leveldb" }

$cfgJson = (Invoke-WebRequest -Uri "$DbUrl/hh_data/meishi_config.json" -UseBasicParsing).Content
$libIds = [regex]::Matches($cfgJson, '"libId":"(lib-[^"]+)"') |
  ForEach-Object { $_.Groups[1].Value } |
  Sort-Object { [long]($_.Split('-')[1]) } -Unique
if (-not $libIds.Count) { throw "No libId in hh_data/meishi_config" }

$library = @()
for ($i = 0; $i -lt [Math]::Min($libIds.Count, $sortedUrls.Count); $i++) {
  $library += [ordered]@{
    id    = $libIds[$i]
    src   = $sortedUrls[$i]
    label = "復元画像$($i + 1)"
    file  = "recovered$($i + 1).png"
  }
}

$outPath = Join-Path $ScriptDir "recovered-image-library.json"
$library | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $outPath -Encoding UTF8
Write-Host "Recovered $($library.Count) images -> $outPath"

if ($DryRun) { exit 0 }

$auth = Invoke-RestMethod -Method Post `
  -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$apiKey" `
  -ContentType "application/json" -Body '{"returnSecureToken":true}'
$token = $auth.idToken
$body = ($library | ConvertTo-Json -Depth 4 -Compress)
Invoke-RestMethod -Method Put `
  -Uri "$DbUrl/hh_data/meishi_image_library.json?auth=$token" `
  -ContentType "application/json" -Body $body | Out-Null
Write-Host "Firebase hh_data/meishi_image_library updated ($($library.Count) items)"
