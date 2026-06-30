#Requires -Version 5.1
# images フォルダ内の画像ファイルから manifest.json を再生成
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ImgDir = Join-Path $Root "meishi-app\public\images"
$Manifest = Join-Path $ImgDir "manifest.json"

if (-not (Test-Path -LiteralPath $ImgDir)) {
  New-Item -ItemType Directory -Path $ImgDir -Force | Out-Null
}

$ext = @(".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg")
$items = @()
Get-ChildItem -LiteralPath $ImgDir -File | Where-Object {
  $ext -contains $_.Extension.ToLowerInvariant()
} | Sort-Object Name | ForEach-Object {
  $base = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
  $id = ($base -replace '[^a-zA-Z0-9_\-\u3040-\u30ff\u4e00-\u9fff]', '-').ToLowerInvariant()
  if (-not $id) { $id = "img-" + (Get-Random -Maximum 99999) }
  $items += [ordered]@{
    id    = $id
    file  = $_.Name
    label = $base
  }
}

$json = @{ items = $items } | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($Manifest, $json + "`n", [System.Text.UTF8Encoding]::new($false))
Write-Host "Updated: $Manifest ($($items.Count) items)"
