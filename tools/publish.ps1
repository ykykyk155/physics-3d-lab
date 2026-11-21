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

# github from here drops connections in bursts; HTTP/1.1 upload + retries is what makes it land
git -C $repo config http.version HTTP/1.1
git -C $repo config http.postBuffer 524288000

function Push-Ref([string]$spec, [string]$what) {
    for ($i = 1; $i -le 6; $i++) {
        $out = git -C $repo push -q --force origin $spec 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0) {
            Write-Host ("  pushed {0} (attempt {1})" -f $what, $i) -ForegroundColor Green
            return $true
        }
        $tail = ($out -split "`n" | Where-Object { $_ -match 'error|fatal' } | Select-Object -First 1)
        Write-Host ("  {0} attempt {1} failed: {2}" -f $what, $i, "$tail".Trim()) -ForegroundColor Yellow
        Start-Sleep -Seconds 8
    }
    return $false
}

if (-not (Push-Ref "HEAD:refs/heads/main" "source (main)")) {
    Write-Host "  [FAIL] source push failed 6 times - site NOT updated" -ForegroundColor Red
    exit 1
}

# site branch: build a commit whose tree is exactly the release folder.
# Uses git plumbing (write-tree / commit-tree) instead of `git subtree`: not every
# git build ships subtree, and it silently vanished after a git upgrade once.
$siteTmpIndex = Join-Path $repo '.git\gh-pages.index'
if (Test-Path $siteTmpIndex) { Remove-Item $siteTmpIndex -Force }
$env:GIT_INDEX_FILE = $siteTmpIndex
try {
    git -C $repo read-tree --empty
    git -C $repo --work-tree="$rel" add -A -f -- . 2>&1 | Out-Null
    $tree = (git -C $repo write-tree).Trim()
} finally {
    Remove-Item Env:\GIT_INDEX_FILE -ErrorAction SilentlyContinue
    if (Test-Path $siteTmpIndex) { Remove-Item $siteTmpIndex -Force }
}

if ($tree -and $tree -match '^[0-9a-f]{40,64}$') {
    $siteCommit = (git -C $repo commit-tree $tree -m "site build $(Get-Date -Format 'yyyy-MM-dd HH:mm')").Trim()
    if ($siteCommit -and $siteCommit -match '^[0-9a-f]{40,64}$') {
        if (-not (Push-Ref "${siteCommit}:refs/heads/gh-pages" "site (gh-pages $($siteCommit.Substring(0,7)))")) {
            Write-Host "  [FAIL] site push failed 6 times - page NOT updated" -ForegroundColor Red
            exit 1
        }
        Write-Host ""
        Write-Host "  page will be live at: https://<user>.github.io/<repo>/" -ForegroundColor Green
    } else {
        Write-Host "  commit-tree returned nothing - site branch NOT updated" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  write-tree returned nothing - site branch NOT updated" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "DONE" -ForegroundColor Green