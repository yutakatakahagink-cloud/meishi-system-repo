#Requires -Version 5.1
# 名刺ログイン情報を Firebase（hh_data/meishi_auth）へ公開する
param(
  [string]$OwnerId = "",
  [string]$OwnerPass = "",
  [string]$Title = "名刺印刷システム",
  [switch]$OpenOwnerPage
)

$ErrorActionPreference = "Stop"
$DbUrl = "https://hiyarihatt-report-default-rtdb.asia-southeast1.firebasedatabase.app"
$AuthPath = "hh_data/meishi_auth.json"

$secretsFile = Join-Path $PSScriptRoot "meishi-auth.local.json"
if ((-not $OwnerId -or -not $OwnerPass) -and (Test-Path -LiteralPath $secretsFile)) {
  $sec = Get-Content -LiteralPath $secretsFile -Raw -Encoding UTF8 | ConvertFrom-Json
  if (-not $OwnerId) { $OwnerId = [string]$sec.ownerId }
  if (-not $OwnerPass) { $OwnerPass = [string]$sec.ownerPass }
  if ($sec.title) { $Title = [string]$sec.title }
}

if ($OpenOwnerPage -or (-not $OwnerId) -or (-not $OwnerPass)) {
  $url = "https://yutakatakahagink-cloud.github.io/meishi-system-repo/owner.html?v=20250619d"
  Write-Host "所有者ページを開きます（基本・URL で保存すると携帯と共有されます）: $url"
  Start-Process $url
  if (-not $OwnerId -or -not $OwnerPass) {
    Write-Host "ID/PW を直接書き込む場合は scripts/meishi-auth.local.json を作成するか -OwnerId / -OwnerPass を指定してください。"
    exit 0
  }
}

$body = @{
  ownerId   = $OwnerId.Trim()
  ownerPass = $OwnerPass
  title     = $Title.Trim()
} | ConvertTo-Json -Compress

Invoke-RestMethod -Method Put -Uri "$DbUrl/$AuthPath" -ContentType "application/json; charset=utf-8" -Body $body
Write-Host "OK: hh_data/meishi_auth にログイン情報を書き込みました（ownerId=$OwnerId）"
