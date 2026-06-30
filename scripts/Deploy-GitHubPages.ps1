#Requires -Version 5.1
# Sync 14_名刺印刷ソフト -> ../meishi-system-repo, merge from origin, commit, push.
[CmdletBinding()]
param(
  [string]$RepoPath = "",
  [string]$Message = ("deploy: " + (Get-Date -Format "yyyy-MM-dd HH:mm")),
  [switch]$SyncOnly,
  [switch]$IncludeConfigJs,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$SourceRoot = Split-Path -Parent $PSScriptRoot
if (-not $RepoPath) {
  $WorkboxRoot = Split-Path -Parent $SourceRoot
  $RepoPath = Join-Path $WorkboxRoot "meishi-system-repo"
}

if (-not (Test-Path -LiteralPath $RepoPath)) {
  New-Item -ItemType Directory -Path $RepoPath -Force | Out-Null
  Write-Host "Created repo folder: $RepoPath"
}
$RepoPath = (Resolve-Path -LiteralPath $RepoPath).Path

$pathsFile = Join-Path $PSScriptRoot "deploy-paths.txt"
if (-not (Test-Path -LiteralPath $pathsFile)) {
  throw "Missing deploy-paths.txt: $pathsFile"
}

$names = @(
  Get-Content -LiteralPath $pathsFile -Encoding UTF8 |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -and ($_ -notmatch "^\s*#") }
)
if ($IncludeConfigJs) { $names += "meishi-app/public/config.js" }

Write-Host "Source: $SourceRoot"
Write-Host "Repo:   $RepoPath"

$copied = 0
foreach ($name in $names) {
  $src = Join-Path $SourceRoot $name
  if (-not (Test-Path -LiteralPath $src)) {
    Write-Warning "Skip (missing source): $name"
    continue
  }
  $dest = Join-Path $RepoPath $name
  if ($DryRun) {
    Write-Host "[DRY] Copy $name"
    $copied++
    continue
  }
  $destParent = Split-Path -Parent $dest
  if (-not (Test-Path -LiteralPath $destParent)) {
    New-Item -ItemType Directory -Path $destParent -Force | Out-Null
  }
  Copy-Item -LiteralPath $src -Destination $dest -Force
  Write-Host "OK $name"
  $copied++
}

if ($copied -eq 0) {
  throw "No files copied."
}

# GitHub Pages 公開ルート（branch: main /docs → URL は /user.html 等）
$publicSrc = Join-Path $SourceRoot "meishi-app\public"
$docsDest = Join-Path $RepoPath "docs"
if (Test-Path -LiteralPath $publicSrc) {
  if (Test-Path -LiteralPath $docsDest) { Remove-Item -LiteralPath $docsDest -Recurse -Force }
  Copy-Item -LiteralPath $publicSrc -Destination $docsDest -Recurse -Force
  if ($IncludeConfigJs) {
    $cfgSrc = Join-Path $publicSrc "config.js"
    if (Test-Path -LiteralPath $cfgSrc) {
      Copy-Item -LiteralPath $cfgSrc -Destination (Join-Path $docsDest "config.js") -Force
    }
  }
  New-Item -Path (Join-Path $docsDest ".nojekyll") -ItemType File -Force | Out-Null
  Write-Host "OK docs/ (Pages publish root from meishi-app/public)"
}

if ($DryRun -or $SyncOnly) {
  Write-Host "SyncOnly or DryRun: skipping git."
  exit 0
}

if (-not (Test-Path -LiteralPath (Join-Path $RepoPath ".git"))) {
  Write-Host "Initializing git repo..."
  Push-Location $RepoPath
  try {
    git init
    git branch -M main
  } finally {
    Pop-Location
  }
}

$git = Get-Command git -ErrorAction Stop
function Invoke-RepoGit {
  param([string[]]$GitArgs)
  & $git.Source @GitArgs
  if ($LASTEXITCODE -ne 0) {
    throw "git $($GitArgs -join ' ') failed (exit $LASTEXITCODE)"
  }
}

Push-Location $RepoPath
try {
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  $email = & $git.Source "config" "user.email" 2>$null
  $namec = & $git.Source "config" "user.name" 2>$null
  $remote = & $git.Source "remote" "get-url" "origin" 2>$null
  $ErrorActionPreference = $prevEap
  if (-not [string]::IsNullOrWhiteSpace($email)) { $email = $email.Trim() }
  if (-not [string]::IsNullOrWhiteSpace($namec)) { $namec = $namec.Trim() }
  if (-not $email -or -not $namec) {
    if ($env:DEPLOY_GIT_EMAIL -and $env:DEPLOY_GIT_NAME) {
      Invoke-RepoGit @("config", "user.email", $env:DEPLOY_GIT_EMAIL)
      Invoke-RepoGit @("config", "user.name", $env:DEPLOY_GIT_NAME)
    }
    else {
      throw "Set git user in repo (user.email and user.name), or env DEPLOY_GIT_EMAIL and DEPLOY_GIT_NAME"
    }
  }

  if (-not $remote) {
    Invoke-RepoGit @("remote", "add", "origin", "https://github.com/yutakatakahagink-cloud/meishi-system-repo.git")
    Write-Host "Added origin remote."
  }

  $fetchOk = $false
  try {
    Invoke-RepoGit @("fetch", "origin")
    $fetchOk = $true
  }
  catch {
    Write-Host "fetch skipped (remote may not exist yet): $($_.Exception.Message)" -ForegroundColor DarkYellow
  }
  if ($fetchOk) {
    $prevEap2 = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    $mainRef = & $git.Source "ls-remote" "--heads" "origin" "main" 2>$null
    $ErrorActionPreference = $prevEap2
    if ($mainRef -and $mainRef.Trim()) {
      Invoke-RepoGit @("pull", "origin", "main", "--no-rebase", "-X", "ours")
    }
    else {
      Write-Host "No main on remote yet; skipping pull (first push)." -ForegroundColor DarkYellow
    }
  }
  else {
    Write-Host "No main on remote yet; skipping pull (first push)." -ForegroundColor DarkYellow
  }

  Invoke-RepoGit @("add", "-A")
  if ($IncludeConfigJs) {
    $cfgRel = "meishi-app/public/config.js"
    $cfgAbs = Join-Path $RepoPath $cfgRel
    if (Test-Path -LiteralPath $cfgAbs) {
      Invoke-RepoGit @("add", "-f", $cfgRel)
      Write-Host "Force-added (gitignored): $cfgRel"
    }
  }
  $st = & $git.Source "status" "--porcelain"
  if (-not $st) {
    Write-Host "No local changes to commit after pull."
  }
  else {
    Invoke-RepoGit @("commit", "-m", $Message)
  }

  $curBranch = (& $git.Source "rev-parse" "--abbrev-ref" "HEAD" 2>$null)
  if ($LASTEXITCODE -eq 0 -and $curBranch -eq "master") {
    Invoke-RepoGit @("branch", "-M", "main")
  }

  Invoke-RepoGit @("push", "-u", "origin", "main")
  Write-Host "Push OK."

  try {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "git"
    $psi.Arguments = "credential fill"
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.UseShellExecute = $false
    $proc = [System.Diagnostics.Process]::Start($psi)
    $proc.StandardInput.WriteLine("protocol=https")
    $proc.StandardInput.WriteLine("host=github.com")
    $proc.StandardInput.WriteLine("")
    $proc.StandardInput.Close()
    $credOut = $proc.StandardOutput.ReadToEnd()
    $proc.WaitForExit()
    if ($credOut -match "password=(.+)") {
      $ghToken = $Matches[1].Trim()
      $ghHeaders = @{
        Authorization = "Bearer $ghToken"
        Accept        = "application/vnd.github+json"
        "X-GitHub-Api-Version" = "2022-11-28"
      }
      $pagesBody = '{"source":{"branch":"main","path":"/docs"}}'
      try {
        Invoke-RestMethod -Uri "https://api.github.com/repos/yutakatakahagink-cloud/meishi-system-repo/pages" -Method Post -Headers $ghHeaders -Body $pagesBody -ContentType "application/json" | Out-Null
        Write-Host "GitHub Pages enabled (main /docs)."
      }
      catch {
        try {
          Invoke-RestMethod -Uri "https://api.github.com/repos/yutakatakahagink-cloud/meishi-system-repo/pages" -Method Put -Headers $ghHeaders -Body $pagesBody -ContentType "application/json" | Out-Null
          Write-Host "GitHub Pages updated (main /docs)."
        }
        catch {
          Write-Warning "GitHub Pages API skipped: $($_.Exception.Message)"
        }
      }
    }
  }
  catch {
    Write-Warning "GitHub Pages enable skipped: $($_.Exception.Message)"
  }
}
finally {
  Pop-Location
}
