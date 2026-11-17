# 一行发布：构建 → 浏览器验收 → 提交 → 推送（源仓库 + gh-pages 站点分支）
# 纯 ASCII 脚本（PS 5.1 按 GBK 读 .ps1，中文注释会吞行）
#
# 用法:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/publish.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/publish.ps1 -Message "修正 A1 倾角"
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/publish.ps1 -SkipVerify
#
# 站点分支 gh-pages 的内容 = release/physics-3d-lab 目录，GitHub Pages 直接托管它。

param(
    [string]$Message = "",
    [switch]$SkipVerify
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$rel  = Join-Path $repo 'release\physics-3d-lab'

function Step($t) { Write-Host ""; Write-Host "== $t" -ForegroundColor Cyan }

# ---------- 1. build ----------
Step "1/4 build"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'tools\make-release.ps1')
if ($LASTEXITCODE -ne 0) { throw "make-release failed" }

# ---------- 2. verify ----------
if ($SkipVerify) {
    Step "2/4 verify  SKIPPED (-SkipVerify)"
} else {
    Step "2/4 verify"
    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $node) { $node = 'D:\DSH-apps\DS bot\resources\primary-runtime\dependencies\node\bin\node.exe' }
    if (-not (Test-Path $node)) { throw "node not found; install node or run with -SkipVerify" }
    & $node (Join-Path $repo 'tools\verify-release.mjs')
    if ($LASTEXITCODE -ne 0) { throw "verify-release failed - NOT pushing" }
}

# ---------- 3. commit ----------
Step "3/4 commit"
git -C $repo add -A
$changed = git -C $repo status --porcelain
if ($changed) {
    if (-not $Message) { $Message = "publish " + (Get-Date -Format 'yyyy-MM-dd HH:mm') }
    $tmp = Join-Path $repo '.publish-msg.tmp'
    [System.IO.File]::WriteAllText($tmp, $Message, (New-Object System.Text.UTF8Encoding($false)))
    git -C $repo commit -q -F $tmp
    Remove-Item $tmp -Force
    Write-Host "  committed: $(git -C $repo log -1 --pretty='%h %s')"
} else {
    Write-Host "  no changes to commit"
}

# ---------- 4. push ----------
Step "4/4 push"
$remote = git -C $repo remote
if (-not $remote) {
    Write-Host "  no remote configured - skipping push." -ForegroundColor Yellow
    Write-Host "  add one:  git remote add origin https://github.com/<user>/<repo>.git"
    exit 2
}

git -C $repo push -q origin HEAD
Write-Host "  pushed source -> $(git -C $repo remote get-url origin)"

# site branch: subtree of the release folder, force-pushed (it is a build output)
$sha = git -C $repo subtree split --prefix=release/physics-3d-lab HEAD
if ($sha) {
    git -C $repo push -q --force origin "${sha}:refs/heads/gh-pages"
    Write-Host "  pushed site   -> gh-pages ($($sha.Substring(0,7)))"
    Write-Host ""
    Write-Host "  page will be live at: https://<user>.github.io/<repo>/" -ForegroundColor Green
} else {
    Write-Host "  subtree split returned nothing - site branch NOT updated" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "DONE" -ForegroundColor Green