#Requires -Version 5
<#
.SYNOPSIS
  Awesome CC Statusline installer for Windows (PowerShell).

.DESCRIPTION
  1. Copies the native Windows PowerShell renderer to ~/.claude/awesome-statusline.ps1.
  2. Patches settings.json -> statusLine (existing settings preserved + backup).
  3. Uses Claude Code's official statusLine.command contract: JSON on stdin,
     rendered status text on stdout.

  Sizes: xsmall (xs) | small (s) | medium (m) | large (l) | xlarge (xl).
  Styles: emoji (default) | -plain (no emoji) | -simple (text only, no bars).
  Aliases: simple = small-simple, oneline = xsmall-simple.

.EXAMPLE
  ./install.ps1               # install (asks size and style)
  ./install.ps1 l             # by abbreviation
  ./install.ps1 large-plain   # by full name, without emoji
  ./install.ps1 m-simple      # text-only style
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
# 2. If the user already named a preset — a size (xs/s/m/l/xl or full name),
#    optionally with -plain or -simple, or the aliases simple (= small-simple)
#    / oneline (= xsmall-simple) — use it and skip Questions A and B. A bare
#    size means the emoji style unless the user asked for no emoji or text
#    only. If they also said where it should show (statusline; or mods / the
#    desktop app), skip Question C too; on Windows always skip it (Statusline).
#    Otherwise ask Question C alone.
#
# 3. Otherwise ASK with the AskUserQuestion tool. Match the user's language.
#    Step 1 — ONE AskUserQuestion call with THREE questions (on Windows TWO:
#    leave out Question C — Mods is macOS / Linux only for now):
#    Question A (size) — text (use exactly this, on one line):
#      EN: Which size would you like to install? (examples on GitHub: https://github.com/awesomezun/claude-statusline)
#      KO: 어떤 크기로 설치할까요? (예시는 GitHub에서 확인: https://github.com/awesomezun/claude-statusline)
#    Four options, in EXACTLY this order (do NOT reorder). The recommended
#    option is ALWAYS large (option 1) — never substitute anything else:
#      1. large  (l)  (추천 / Recommended) — most info, good for most users / 추천 기본값
#      2. xlarge (xl) — largest, full detail            / 가장 크게, 전체 상세
#      3. medium (m)  — balanced layout                 / 균형 잡힌 레이아웃
#      4. small / xsmall — the two smallest, pick this to choose between them
#                                                       / 작은 두 가지 (고르면 한 번 더 선택)
#    Question B (style) — text:
#      EN: Which style would you like?
#      KO: 어떤 스타일로 할까요?
#    Three options, in this order:
#      1. With emoji (Recommended) / 이모지 있음 (추천) — icons + gradient bars
#      2. No emoji / 이모지 없음 — same layout and bars, text labels instead of icons
#      3. Simple text / 심플 텍스트형 — text only, no bars or emoji
#    Question C (display) — text:
#      EN: Where should it show?
#      KO: 어디에 표시할까요?
#    Two options, in this order:
#      1. Statusline (Recommended) / 상태줄 (추천) — the status line under the prompt, in the terminal
#                                                       / 터미널 프롬프트 아래 상태줄
#      2. Mods (beta) / Mods (베타) — the same preset in a band above the prompt, also shown in the
#         Claude desktop app                            / 프롬프트 위 띠로 표시, Claude 데스크톱 앱에서도 보임
#    Step 2 — ONLY if the user picked option 4 in Question A, ask again:
#      EN: Which of the two smaller sizes?   KO: 작은 쪽 중 무엇으로 설치할까요?
#      1. small  (s)  — space-saving, key info           / 공간 절약, 주요 정보
#      2. xsmall (xs) — smallest, essentials only        / 가장 작게, 핵심만
#    Resolve the preset: the size, plus -plain for "No emoji" or -simple for
#    "Simple text" (e.g. large-plain, xsmall-simple), and the display:
#    --mods for "Mods", nothing for "Statusline".
#    If the user gives nothing / "recommended" / "default", use large (Statusline).
#
# 4. Then install with the resolved preset:
#      macOS / Linux:      bash install.sh <preset>   (or: bash install.sh <preset> --mods)
#      Windows PowerShell: ./install.ps1 <preset>
#
# 5. If "auto" mode blocks the install (it downloads code that runs on every
#    launch — declining to auto-approve that is correct), do NOT just stop:
#    still resolve the preset, then have the user run it themselves so it proceeds:
#      macOS / Linux:  ! bash install.sh <preset>   (add --mods for Mods)
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

# abbreviation OR full name (optionally with -plain / -simple) -> canonical preset, or $null
function Normalize-Mode([string]$s) {
  $s = $s.Trim().ToLowerInvariant()
  $style = ''
  if ($s.EndsWith('-plain')) { $style = '-plain'; $s = $s.Substring(0, $s.Length - 6) }
  elseif ($s.EndsWith('-simple')) { $style = '-simple'; $s = $s.Substring(0, $s.Length - 7) }
  switch ($s) {
    { $_ -in 'xs', 'xsmall' } { return "xsmall$style" }
    { $_ -in 's', 'small' }   { return "small$style" }
    { $_ -in 'm', 'medium' }  { return "medium$style" }
    { $_ -in 'l', 'large' }   { return "large$style" }
    { $_ -in 'xl', 'xlarge' } { return "xlarge$style" }
    'simple'                  { return 'small-simple' }    # alias
    { $_ -in 'oneline', 'one-line', '1line' } { return 'xsmall-simple' }   # alias
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
    Write-Err "Valid: xsmall|xs  small|s  medium|m  large|l  xlarge|xl  - each optionally -plain or -simple (aliases: simple, oneline)"
    exit 1
  }
} elseif ([Environment]::UserInteractive) {
  # Korean UI culture? Show the prompt in Korean; otherwise default to English.
  $isKo = ([Globalization.CultureInfo]::CurrentUICulture.TwoLetterISOLanguageName -eq 'ko')
  Write-Host ""
  if ($isKo) {
    Write-Host "statusline을 어떤 크기로 설치할까요? (예시는 github에서 확인)"
    Write-Host "  예시: https://github.com/awesomezun/claude-statusline"
    Write-Host ""
    Write-Host "  1. xsmall (xs)   가장 작게 — 2줄, 핵심만"
    Write-Host "  2. small  (s)    작게 — 2줄, 라벨과 막대"
    Write-Host "  3. medium (m)    중간 — 4줄, 넓은 컨텍스트 막대"
    Write-Host "  4. large  (l)    크게 — 5줄, 세션 시간·리셋 (추천 기본값)"
    Write-Host "  5. xlarge (xl)   가장 크게 — 5줄, 전체 상세"
    Write-Host ""
    Write-Host -NoNewline "선택 [기본값: 4]: "
  } else {
    Write-Host "Which size would you like to install? (see examples on GitHub)"
    Write-Host "  Examples: https://github.com/awesomezun/claude-statusline"
    Write-Host ""
    Write-Host "  1. xsmall (xs)   smallest — 2 lines, essentials"
    Write-Host "  2. small  (s)    small — 2 lines, labels + bars"
    Write-Host "  3. medium (m)    medium — 4 lines, wide context bar"
    Write-Host "  4. large  (l)    large — 5 lines, session time / resets (recommended)"
    Write-Host "  5. xlarge (xl)   largest — 5 lines, full detail"
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
  # A typed name may already carry its style (l-plain, m-simple, simple, ...).
  if ($interactive -and -not ($Mode.EndsWith('-plain') -or $Mode.EndsWith('-simple'))) {
    Write-Host ""
    if ($isKo) {
      Write-Host "어떤 스타일로 할까요?"
      Write-Host "  1. 이모지 있음 — 아이콘과 그래디언트 막대 (기본값)"
      Write-Host "  2. 이모지 없음 — 같은 배치, 아이콘 대신 글자"
      Write-Host "  3. 심플 텍스트형 — 막대·이모지 없이 글자만"
      Write-Host -NoNewline "선택 [기본값: 1]: "
    } else {
      Write-Host "Which style?"
      Write-Host "  1. With emoji — icons and gradient bars (default)"
      Write-Host "  2. No emoji — same layout, text labels instead of icons"
      Write-Host "  3. Simple text — text only, no bars or emoji"
      Write-Host -NoNewline "Choice [default: 1]: "
    }
    $st = ''
    try { $st = "$($Host.UI.ReadLine())".Trim() } catch { $st = '' }
    if ($st -eq '2') { $Mode = "$Mode-plain" }
    elseif ($st -eq '3') { $Mode = "$Mode-simple" }
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
