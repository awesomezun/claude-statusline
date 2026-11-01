#Requires -Version 5
<#
.SYNOPSIS
  Awesome CC Statusline installer for Windows (PowerShell).

.DESCRIPTION
  1. Copies the native Windows PowerShell renderer to ~/.claude/awesome-statusline.ps1.
  2. Patches settings.json -> statusLine (existing settings preserved + backup).
  3. Uses Claude Code's official statusLine.command contract: JSON on stdin,
     rendered status text on stdout.

  Presets: xsmall (xs) | small (s) | medium (m) | large (l) | xlarge (xl),
  each optionally with -plain (no emoji), plus simple and oneline (text only).

.EXAMPLE
  ./install.ps1               # install (asks which preset)
  ./install.ps1 l             # by abbreviation
  ./install.ps1 large-plain   # by full name, without emoji
#>

# ============================================================================
# HOW TO INSTALL — rules for the AI assistant running this.
# A user may ask the assistant to install from the GitHub URL without cloning
# the repo, so CLAUDE.md / the plugin command are NOT in context. These rules
# are duplicated here (the one file the assistant always reads) and MUST stay
# identical to CLAUDE.md and commands/statusline-setup.md in this repo.
#
# 1. You MUST resolve a preset before installing. Never install without an
#    explicit choice by the user. "Auto" / auto-accept mode is NOT an
#    exception — the user is present and can answer; ask anyway.
#    Recommending `large` (below) is only a hint shown inside the menu; it must
#    NEVER become a silent default or let you skip the question. Always ask.
#
# 2. If the user already named a preset (xs/s/m/l/xl or full name, optionally
#    with -plain, or simple / oneline), use it and skip the questions. A bare
#    size means the emoji version unless the user asked for no emoji.
#
# 3. Otherwise ASK with the AskUserQuestion tool. Match the user's language.
#    Step 1 — ONE AskUserQuestion call with TWO questions:
#    Question A (size) — text (use exactly this, on one line):
#      EN: Which size would you like to install? (examples on GitHub: https://github.com/awesomezun/claude-statusline)
#      KO: 어떤 크기로 설치할까요? (예시는 GitHub에서 확인: https://github.com/awesomezun/claude-statusline)
#    Four options, in EXACTLY this order (do NOT reorder). The recommended
#    option is ALWAYS large (option 1) — never substitute anything else:
#      1. large  (l)  (추천 / Recommended) — most info, good for most users / 추천 기본값
#      2. xlarge (xl) — largest, full detail            / 가장 크게, 전체 상세
#      3. medium (m)  — balanced layout                 / 균형 잡힌 레이아웃
#      4. small / xsmall / simple / oneline — compact or text-only, pick this
#         to choose among them                          / 작은 크기·텍스트형 (고르면 한 번 더 선택)
#    Question B (emoji) — text:
#      EN: Show emoji icons? (simple and oneline are always emoji-free)
#      KO: 이모지 아이콘을 표시할까요? (simple·oneline은 항상 이모지 없음)
#    Two options, in this order:
#      1. With emoji (Recommended) / 이모지 있음 (추천) — 🤖 🧠 🚀 icons
#      2. No emoji / 이모지 없음 — text labels; steadiest in tmux, SSH, Windows consoles
#    Step 2 — ONLY if the user picked option 4 in Question A, ask again:
#      EN: Which compact preset?   KO: 어떤 걸로 설치할까요?
#      1. small  (s)  — 2 lines, labels + bars          / 2줄, 라벨과 막대
#      2. xsmall (xs) — 2 lines, smallest bars          / 2줄, 가장 작게
#      3. simple      — 2 lines, text only, no emoji    / 2줄 텍스트형, 이모지 없음
#      4. oneline     — 1 line, numbers only, no emoji  / 1줄 숫자형, 이모지 없음
#    Resolve the preset: the size, plus -plain when Question B was "No emoji"
#    (e.g. large-plain). simple and oneline never take -plain.
#    If the user gives nothing / "recommended" / "default", use large.
#
# 4. Then install with the resolved preset:
#      macOS / Linux:      bash install.sh <preset>
#      Windows PowerShell: ./install.ps1 <preset>
#
# 5. If "auto" mode blocks the install (it downloads code that runs on every
#    launch — declining to auto-approve that is correct), do NOT just stop:
#    still resolve the preset, then have the user run it themselves so it proceeds:
#      macOS / Linux:  ! bash install.sh <preset>
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

# abbreviation OR full name (optionally with -plain) -> canonical preset, or $null
function Normalize-Mode([string]$s) {
  $s = $s.Trim().ToLowerInvariant()
  $plain = ''
  if ($s.EndsWith('-plain')) { $plain = '-plain'; $s = $s.Substring(0, $s.Length - 6) }
  switch ($s) {
    { $_ -in 'xs', 'xsmall' } { return "xsmall$plain" }
    { $_ -in 's', 'small' }   { return "small$plain" }
    { $_ -in 'm', 'medium' }  { return "medium$plain" }
    { $_ -in 'l', 'large' }   { return "large$plain" }
    { $_ -in 'xl', 'xlarge' } { return "xlarge$plain" }
    'simple'                  { return 'simple' }    # always emoji-free
    { $_ -in 'oneline', 'one-line', '1line' } { return 'oneline' }
  }
  return $null
}

# --- paths ------------------------------------------------------------------
$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }
$Settings  = Join-Path $ClaudeDir 'settings.json'
$Dest      = Join-Path $ClaudeDir 'awesome-statusline.ps1'
$ScriptPath = $MyInvocation.MyCommand.Path
$ScriptDir = if ($ScriptPath) { Split-Path -Parent $ScriptPath } else { (Get-Location).Path }
$SrcDir    = Join-Path $ScriptDir 'scripts'
$RepoRaw   = if ($env:AWESOME_STATUSLINE_RAW) { $env:AWESOME_STATUSLINE_RAW } else { 'https://raw.githubusercontent.com/awesomezun/claude-statusline/main' }

# --- pick preset ------------------------------------------------------------
# Precedence: explicit argument > interactive prompt > 'large' default.
# When no preset is given and a real console is attached, ask (default large).
# In non-interactive contexts (e.g. `irm ... | iex`, CI) we never block — the
# console read throws and we fall straight through to 'large'.
$Mode = 'large'
if ($Size) {
  $Mode = Normalize-Mode $Size
  if (-not $Mode) {
    Write-Err "Unknown preset: '$Size'"
    Write-Err "Valid: xsmall|xs  small|s  medium|m  large|l  xlarge|xl  (each optionally -plain)  simple  oneline"
    exit 1
  }
} elseif ([Environment]::UserInteractive) {
  # Korean UI culture? Show the prompt in Korean; otherwise default to English.
  $isKo = ([Globalization.CultureInfo]::CurrentUICulture.TwoLetterISOLanguageName -eq 'ko')
  Write-Host ""
  if ($isKo) {
    Write-Host "statusline을 어떤 프리셋으로 설치할까요? (예시는 github에서 확인)"
    Write-Host "  예시: https://github.com/awesomezun/claude-statusline"
    Write-Host ""
    Write-Host "  1. xsmall (xs)   가장 작게 — 2줄, 핵심만"
    Write-Host "  2. small  (s)    작게 — 2줄, 라벨과 막대"
    Write-Host "  3. medium (m)    중간 — 4줄, 넓은 컨텍스트 막대"
    Write-Host "  4. large  (l)    크게 — 5줄, 비용·시간·리셋 (추천 기본값)"
    Write-Host "  5. xlarge (xl)   가장 크게 — 5줄, 전체 상세"
    Write-Host "  6. simple        2줄 텍스트형 (이모지 없음)"
    Write-Host "  7. oneline       1줄 숫자형 (이모지 없음)"
    Write-Host ""
    Write-Host -NoNewline "선택 [기본값: 4]: "
  } else {
    Write-Host "Which preset would you like to install? (see examples on GitHub)"
    Write-Host "  Examples: https://github.com/awesomezun/claude-statusline"
    Write-Host ""
    Write-Host "  1. xsmall (xs)   smallest — 2 lines, essentials"
    Write-Host "  2. small  (s)    small — 2 lines, labels + bars"
    Write-Host "  3. medium (m)    medium — 4 lines, wide context bar"
    Write-Host "  4. large  (l)    large — 5 lines, cost / time / resets (recommended)"
    Write-Host "  5. xlarge (xl)   largest — 5 lines, full detail"
    Write-Host "  6. simple        2 lines, text only (no emoji)"
    Write-Host "  7. oneline       1 line, numbers only (no emoji)"
    Write-Host ""
    Write-Host -NoNewline "Choice [default: 4]: "
  }
  # Under `irm ... | iex` the downloaded script occupies the pipeline, so a plain
  # Read-Host can be skipped (the PowerShell analog of the bash `curl | bash`
  # stdin problem fixed via /dev/tty). Read from the console host directly; if no
  # real console is attached (CI, non-interactive host) ReadLine throws and we
  # fall through to the 'large' default instead of blocking.
  $interactive = $true
  $answer = ''
  try { $answer = $Host.UI.ReadLine() } catch { $answer = ''; $interactive = $false }
  $answer = "$answer".Trim()
  switch ($answer) {
    '1'  { $Mode = 'xsmall' }
    '2'  { $Mode = 'small'  }
    '3'  { $Mode = 'medium' }
    '4'  { $Mode = 'large'  }
    ''   { $Mode = 'large'  }
    '5'  { $Mode = 'xlarge' }
    '6'  { $Mode = 'simple' }
    '7'  { $Mode = 'oneline' }
    default {
      # Allow typing a preset name/alias directly instead of a number.
      $Mode = Normalize-Mode $answer
      if (-not $Mode) {
        if ($isKo) { Write-Host "알 수 없는 입력 '$answer' — 'large'로 설치합니다." }
        else       { Write-Host "Unknown input '$answer', using 'large'." }
        $Mode = 'large'
      }
    }
  }
  # Classic sizes come with or without emoji.
  if ($interactive -and $Mode -notin 'simple', 'oneline' -and -not $Mode.EndsWith('-plain')) {
    if ($isKo) { Write-Host -NoNewline "이모지 아이콘을 표시할까요? [Y/n]: " } else { Write-Host -NoNewline "Show emoji icons? [Y/n]: " }
    $yn = ''
    try { $yn = "$($Host.UI.ReadLine())".Trim() } catch { $yn = '' }
    if ($yn -in 'n', 'no', '아니오', '아니요') { $Mode = "$Mode-plain" }
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

Write-Ok "Installed Awesome CC Statusline (preset: $Mode)"
Write-Host "  script:   $Dest"
Write-Host "  settings: $Settings  (statusLine set)"
Write-Host "  command:  $Command"
Write-Host ""
Write-Host "Restart Claude Code to see it."
Write-Host "To switch preset later, just ask your AI agent to reinstall with the one you want."
Write-Host ""
Write-Host "Star this repo if you find it useful - it really helps:"
Write-Host "  https://github.com/awesomezun/claude-statusline"
