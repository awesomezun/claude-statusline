#Requires -Version 5
<#
.SYNOPSIS
  Awesome CC Statusline installer for Windows (PowerShell).

.DESCRIPTION
  1. Copies the native Windows PowerShell renderer to ~/.claude/awesome-statusline.ps1.
  2. Patches settings.json -> statusLine (existing settings preserved + backup).
  3. Uses Claude Code's official statusLine.command contract: JSON on stdin,
     rendered status text on stdout.

.EXAMPLE
  ./install.ps1            # install
  ./install.ps1 l          # by abbreviation
  ./install.ps1 large      # by full name
#>

# ============================================================================
# HOW TO INSTALL — rules for the AI assistant running this.
# A user may ask the assistant to install from the GitHub URL without cloning
# the repo, so CLAUDE.md / the plugin command are NOT in context. These rules
# are duplicated here (the one file the assistant always reads) and MUST stay
# identical to CLAUDE.md and commands/statusline-setup.md in this repo.
#
# 1. You MUST resolve a size before installing. Never install without an
#    explicit size chosen by the user. "Auto" / auto-accept mode is NOT an
#    exception — the user is present and can answer; ask anyway.
#    Recommending `large` (below) is only a hint shown inside the menu; it must
#    NEVER become a silent default or let you skip the question. Always ask.
#
# 2. If the user already named a size (xs/s/m/l/xl or full name), use it; skip
#    the question.
#
# 3. Otherwise ASK with the AskUserQuestion tool, in TWO steps so all five
#    presets fit the tool's 4-option limit. Match the user's language.
#    Step 1 — question text (use exactly this, on one line):
#      EN: Which size would you like to install? (size examples on GitHub: https://github.com/awesomezun/claude-statusline)
#      KO: 어떤 크기로 설치할까요? (크기 예시는 GitHub에서 확인: https://github.com/awesomezun/claude-statusline)
#    Step 1 — four options, in EXACTLY this order (do NOT reorder). The
#    recommended option is ALWAYS large (option 1) — never substitute medium
#    or anything else as the recommendation:
#      1. large  (l)  (추천 / Recommended) — most info, good for most users / 추천 기본값
#      2. xlarge (xl) — largest, full detail            / 가장 크게, 전체 상세
#      3. medium (m)  — balanced layout                 / 균형 잡힌 레이아웃
#      4. small / xsmall — the two smallest, pick this to choose between them
#                                                       / 작은 두 가지 (고르면 한 번 더 선택)
#    Step 2 — ONLY if the user picked option 4, ask again:
#      EN: Which of the two smaller sizes?   KO: 작은 쪽 중 무엇으로 설치할까요?
#      1. small  (s)  — space-saving, key info           / 공간 절약, 주요 정보
#      2. xsmall (xs) — smallest, essentials only        / 가장 작게, 핵심만
#    If the user gives nothing / "recommended" / "default", use large.
#
# 4. Then install with the resolved size:
#      macOS / Linux:      bash install.sh <size>
#      Windows PowerShell: ./install.ps1 <size>
#
# 5. If "auto" mode blocks the install (it downloads code that runs on every
#    launch — declining to auto-approve that is correct), do NOT just stop:
#    still resolve the size, then have the user run it themselves so it proceeds:
#      macOS / Linux:  ! bash install.sh <size>
#      Windows:        ! irm https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.ps1 | iex
#    or have them leave auto mode (shift+tab) for the one install step.
#
# 6. Only a truly headless one-shot run (claude -p / hook / cron, no way to get
#    a reply) may default to large — and you must say that you did.
# ============================================================================

param([string]$Size)

$ErrorActionPreference = 'Stop'
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {}

function Write-Info($m) { Write-Host $m -ForegroundColor Cyan }
function Write-Ok($m)   { Write-Host $m -ForegroundColor Green }
function Write-Err($m)  { Write-Host $m -ForegroundColor Red }

function Normalize-Mode([string]$s) {
  switch ($s.ToLower()) {
    'xs'     { 'xsmall' } 'xsmall' { 'xsmall' }
    's'      { 'small' }  'small'  { 'small' }
    'm'      { 'medium' } 'medium' { 'medium' }
    'l'      { 'large' }  'large'  { 'large' }
    'xl'     { 'xlarge' } 'xlarge' { 'xlarge' }
    default  { $null }
  }
}

# --- paths ------------------------------------------------------------------
$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }
$Settings  = Join-Path $ClaudeDir 'settings.json'
$Dest      = Join-Path $ClaudeDir 'awesome-statusline.ps1'
$ScriptPath = $MyInvocation.MyCommand.Path
$ScriptDir = if ($ScriptPath) { Split-Path -Parent $ScriptPath } else { (Get-Location).Path }
$SrcDir    = Join-Path $ScriptDir 'scripts'
$RepoRaw   = if ($env:AWESOME_STATUSLINE_RAW) { $env:AWESOME_STATUSLINE_RAW } else { 'https://raw.githubusercontent.com/awesomezun/claude-statusline/main' }

# --- pick size --------------------------------------------------------------
# Precedence: explicit argument > interactive prompt > 'large' default.
# When no size is given and a real console is attached, ask (default large).
# In non-interactive contexts (e.g. `irm ... | iex`, CI) we never block — the
# input-redirection guard falls straight through to 'large'.
$Mode = 'large'
if ($Size) {
  $Mode = Normalize-Mode $Size
  if (-not $Mode) {
    Write-Err "Unknown size: '$Size'"
    Write-Err "Valid: xsmall|xs  small|s  medium|m  large|l  xlarge|xl"
    exit 1
  }
} elseif ([Environment]::UserInteractive) {
  # Korean UI culture? Show the prompt in Korean; otherwise default to English.
  $isKo = ([Globalization.CultureInfo]::CurrentUICulture.TwoLetterISOLanguageName -eq 'ko')
  Write-Host ""
  if ($isKo) {
    Write-Host "statusline을 어떤 사이즈로 설치할까요? (XSmall-Small-Medium-Large-XLarge, 예시는 github에서 확인)"
    Write-Host "  예시: https://github.com/awesomezun/claude-statusline"
    Write-Host ""
    Write-Host "  1. xsmall (xs)"
    Write-Host "     가장 작게 — 핵심 정보만 최소 표시. 좁은 화면용."
    Write-Host "  2. small (s)"
    Write-Host "     작게 — 공간 절약, 주요 정보만."
    Write-Host "  3. medium (m)"
    Write-Host "     중간 — 정보량과 공간의 균형."
    Write-Host "  4. large (l)"
    Write-Host "     크게 — 현재 기본값. 대부분 정보 표시."
    Write-Host "  5. xlarge (xl)"
    Write-Host "     가장 크게 — 모든 정보 표시 (git ahead/behind, env)."
    Write-Host ""
    Write-Host -NoNewline "선택 [기본값: 4]: "
  } else {
    Write-Host "Which size would you like to install? (XSmall-Small-Medium-Large-XLarge; see examples on GitHub)"
    Write-Host "  Examples: https://github.com/awesomezun/claude-statusline"
    Write-Host ""
    Write-Host "  1. xsmall (xs)"
    Write-Host "     Smallest — only the essentials. For narrow screens."
    Write-Host "  2. small (s)"
    Write-Host "     Small — space-saving, key info only."
    Write-Host "  3. medium (m)"
    Write-Host "     Medium — balance of detail and space."
    Write-Host "  4. large (l)"
    Write-Host "     Large — current default. Shows most info."
    Write-Host "  5. xlarge (xl)"
    Write-Host "     Largest — full detail (git ahead/behind, env)."
    Write-Host ""
    Write-Host -NoNewline "Choice [default: 4]: "
  }
  # Under `irm ... | iex` the downloaded script occupies the pipeline, so a plain
  # Read-Host can be skipped (the PowerShell analog of the bash `curl | bash`
  # stdin problem fixed via /dev/tty). Read from the console host directly; if no
  # real console is attached (CI, non-interactive host) ReadLine throws and we
  # fall through to the 'large' default instead of blocking.
  $answer = ''
  try { $answer = $Host.UI.ReadLine() } catch { $answer = '' }
  $answer = $answer.Trim()
  switch ($answer) {
    '1'  { $Mode = 'xsmall' }
    '2'  { $Mode = 'small'  }
    '3'  { $Mode = 'medium' }
    '4'  { $Mode = 'large'  }
    ''   { $Mode = 'large'  }
    '5'  { $Mode = 'xlarge' }
    default {
      # Allow typing a size name/alias directly instead of a number.
      $Mode = Normalize-Mode $answer
      if (-not $Mode) {
        if ($isKo) { Write-Host "알 수 없는 입력 '$answer' — 'large'로 설치합니다." }
        else       { Write-Host "Unknown input '$answer', using 'large'." }
        $Mode = 'large'
      }
    }
  }
}

# --- install the script -----------------------------------------------------
New-Item -ItemType Directory -Force -Path $ClaudeDir | Out-Null
$Src = Join-Path $SrcDir 'awesome-statusline-windows.ps1'
if (Test-Path $Src) {
  Copy-Item $Src $Dest -Force
} else {
  Write-Info "Local scripts/ not found, downloading Windows renderer from repo..."
  Invoke-WebRequest -Uri "$RepoRaw/scripts/awesome-statusline-windows.ps1" -OutFile $Dest
}

# Force UTF-8 *with* BOM. The renderer body contains non-ASCII glyphs
# (progress-bar blocks U+2588/U+2591, emoji). Windows PowerShell 5.1 does not
# auto-detect UTF-8: with no BOM it reads .ps1 files using the system ANSI code
# page (e.g. CP949 on Korean systems), corrupting those bytes into garbage
# tokens that break the parser and leave the status line blank. Writing the BOM
# explicitly guarantees correct parsing on every host (PS 5.1 and 7+).
$scriptText = [System.IO.File]::ReadAllText($Dest, [System.Text.UTF8Encoding]::new($false))
$utf8Bom = [System.Text.UTF8Encoding]::new($true)
[System.IO.File]::WriteAllText($Dest, $scriptText, $utf8Bom)

# --- patch settings.json ----------------------------------------------------
$CommandPath = $Dest.Replace('\', '/')
$Command = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$CommandPath`" -Size $Mode"
$slObj = [pscustomobject]@{ type = 'command'; command = $Command }
if (Test-Path $Settings) {
  $backup = "$Settings.backup-" + (Get-Date -Format 'yyyyMMdd-HHmmss')
  Copy-Item $Settings $backup -Force
  # -Encoding UTF8: PS 5.1 would otherwise read settings.json with the ANSI code
  # page and fail on any non-ASCII text already in it.
  $json = Get-Content $Settings -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($json.PSObject.Properties.Name -contains 'statusLine') {
    $json.statusLine = $slObj
  } else {
    $json | Add-Member -NotePropertyName 'statusLine' -NotePropertyValue $slObj
  }
  $json | ConvertTo-Json -Depth 20 | Set-Content $Settings -Encoding UTF8
  Write-Info "Existing settings backed up to: $backup"
} else {
  [pscustomobject]@{ statusLine = $slObj } | ConvertTo-Json -Depth 20 | Set-Content $Settings -Encoding UTF8
}

Write-Ok "Installed Awesome CC Statusline (size: $Mode)"
Write-Host "  script:   $Dest"
Write-Host "  settings: $Settings  (statusLine set)"
Write-Host "  command:  $Command"
Write-Host ""
Write-Host "Restart Claude Code to see it."
Write-Host "To switch size later, just ask your AI agent to reinstall at the size you want."
Write-Host ""
Write-Host "Star this repo if you find it useful - it really helps:"
Write-Host "  https://github.com/awesomezun/claude-statusline"
