# Awesome Statusline renderer for Windows PowerShell (5.1+) and PowerShell 7+.
# Claude Code runs this from statusLine.command, sends the session JSON on
# stdin, and shows whatever this script writes to stdout.
#
#   powershell -NoProfile -File awesome-statusline.ps1 -Size <preset>
#
# Presets (same as the bash renderer, scripts/awesome-statusline.sh):
#   xsmall | small | medium | large | xlarge    classic layouts (xs s m l xl)
#   <size>-plain                                 same layout without emoji
#   simple                                       2 lines, text only (no emoji)
#   oneline                                      1 line, numbers only (no emoji)
#
# Usage limits: each window (five_hour, seven_day) is optional on its own. The
# Ultra plan has no 5-hour limit, so a seven_day-only payload gets a weekly
# layout with a per-day budget; Pro / Max show 5H + 7D. "loading.." appears
# only while rate_limits is missing altogether (before the first response).
param([string]$Size = 'large')

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'

try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$Inv = [Globalization.CultureInfo]::InvariantCulture

# ---------------------------------------------------------------- preset
$Preset = if ($Size) { $Size.ToLowerInvariant() } else { 'large' }
$Plain = $false
if ($Preset.EndsWith('-plain')) { $Plain = $true; $Preset = $Preset.Substring(0, $Preset.Length - 6) }
switch ($Preset) {
  { $_ -in 'xs', 'xsmall' }               { $Mode = 'xsmall' }
  { $_ -in 's', 'small' }                 { $Mode = 'small' }
  { $_ -in 'm', 'medium' }                { $Mode = 'medium' }
  { $_ -in 'xl', 'xlarge' }               { $Mode = 'xlarge' }
  'simple'                                { $Mode = 'simple'; $Plain = $true }
  { $_ -in 'oneline', 'one-line', '1line' } { $Mode = 'oneline'; $Plain = $true }
  default                                 { $Mode = 'large' }
}

# ---------------------------------------------------------------- parse
# Read stdin as UTF-8 explicitly. Windows PowerShell 5.1 otherwise decodes it
# with the system ANSI code page (e.g. CP949 on Korean systems), so any
# non-ASCII text in the payload (such as a Korean session_name) corrupts the
# JSON and the status line silently falls back to defaults. Wrapping the raw
# stream also avoids [Console]::InputEncoding, which can throw without a console.
$StdinReader = [System.IO.StreamReader]::new([Console]::OpenStandardInput(), [System.Text.UTF8Encoding]::new($false))
$InputJson = $StdinReader.ReadToEnd()
try { $Data = $InputJson | ConvertFrom-Json } catch { $Data = $null }

function Get-JsonValue($Object, [string[]]$Path, $Default) {
  $Current = $Object
  foreach ($Part in $Path) {
    if ($null -eq $Current) { return $Default }
    if ($Current.PSObject.Properties.Name -contains $Part) { $Current = $Current.$Part } else { return $Default }
  }
  if ($null -eq $Current) { return $Default }
  return $Current
}

function As-Number($Value) {
  if ($null -eq $Value) { return $null }
  $d = 0.0
  if ([double]::TryParse("$Value", [Globalization.NumberStyles]::Float, $Inv, [ref]$d)) { return $d }
  return $null
}

# Round half up (like the bash renderer) and clamp to 0-100; $null when absent.
function As-Pct($Value) {
  $n = As-Number $Value
  if ($null -eq $n) { return $null }
  $p = [int][Math]::Floor($n + 0.5)
  if ($p -lt 0) { return 0 }
  if ($p -gt 100) { return 100 }
  return $p
}

# Reset times are kept in UTC: subtracting two *local* DateTimes ignores a DST
# change in between and is off by an hour. Only display converts to local time.
function Parse-Reset($Value) {
  if ($null -eq $Value -or "$Value" -eq '') { return $null }
  # PowerShell 7's ConvertFrom-Json already turns ISO-8601 strings into DateTime
  if ($Value -is [DateTime]) { return $Value.ToUniversalTime() }
  $n = As-Number $Value
  if ($null -ne $n) {
    $Epoch = [DateTime]::SpecifyKind([DateTime]'1970-01-01T00:00:00', [DateTimeKind]::Utc)
    return $Epoch.AddSeconds([Math]::Floor($n))
  }
  $Styles = [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal
  try { return [DateTime]::Parse("$Value", $Inv, $Styles) } catch { return $null }
}

$Model = [string](Get-JsonValue $Data @('model', 'display_name') 'Unknown')
$CurDir = [string](Get-JsonValue $Data @('workspace', 'current_dir') (Get-JsonValue $Data @('cwd') '.'))
$Style = [string](Get-JsonValue $Data @('output_style', 'name') '')
$Effort = [string](Get-JsonValue $Data @('effort', 'level') '')
$ThinkingRaw = Get-JsonValue $Data @('thinking', 'enabled') $false
$Thinking = ($ThinkingRaw -eq $true) -or ("$ThinkingRaw".ToLowerInvariant() -eq 'true')
$CtxSize = As-Number (Get-JsonValue $Data @('context_window', 'context_window_size') $null)
if ($null -eq $CtxSize) { $CtxSize = 200000 }
$CtxUsage = Get-JsonValue $Data @('context_window', 'current_usage') $null
$CtxUsedPct = As-Pct (Get-JsonValue $Data @('context_window', 'used_percentage') $null)
$CtxLeftPct = As-Pct (Get-JsonValue $Data @('context_window', 'remaining_percentage') $null)
$Cost = As-Number (Get-JsonValue $Data @('cost', 'total_cost_usd') 0); if ($null -eq $Cost) { $Cost = 0 }
$DurMs = As-Number (Get-JsonValue $Data @('cost', 'total_duration_ms') 0); if ($null -eq $DurMs) { $DurMs = 0 }

$RateLimits = Get-JsonValue $Data @('rate_limits') $null
$HasRL = ($RateLimits -is [System.Management.Automation.PSCustomObject]) -and (@($RateLimits.PSObject.Properties).Count -gt 0)
$FivePct = As-Pct (Get-JsonValue $Data @('rate_limits', 'five_hour', 'used_percentage') $null)
$SevenPct = As-Pct (Get-JsonValue $Data @('rate_limits', 'seven_day', 'used_percentage') $null)
$FiveReset = Parse-Reset (Get-JsonValue $Data @('rate_limits', 'five_hour', 'resets_at') $null)
$SevenReset = Parse-Reset (Get-JsonValue $Data @('rate_limits', 'seven_day', 'resets_at') $null)
$Now = [DateTime]::UtcNow

# ---------------------------------------------------------------- palette
$E = [char]27
$Rst = "${E}[0m"
$Bld = "${E}[1m"
$Clr = "${E}[K"
function Rgb([int]$r, [int]$g, [int]$b) { return "${E}[38;2;${r};${g};${b}m" }
$cSub1 = Rgb 186 194 222; $cSub0 = Rgb 166 173 200
$cOv2 = Rgb 147 153 178;  $cOv1 = Rgb 127 132 156;  $cOv0 = Rgb 108 112 134
$cSurf2 = Rgb 88 91 112
$cTeal = Rgb 148 226 213; $cPink = Rgb 245 194 231; $cPeach = Rgb 250 179 135
$cGreen = Rgb 166 227 161; $cLav = Rgb 180 190 254; $cYellow = Rgb 249 226 175
$cRed = Rgb 243 139 168;  $cMaroon = Rgb 235 160 172
$cLGreen = Rgb 64 160 43; $cLYellow = Rgb 223 142 29

$Sep = "$cSurf2 │ $Rst"
$Dot = "$cOv0 · $Rst"

# Emoji are only ever the first glyph of a segment, so a terminal that draws
# them 1 cell wide shifts every line the same way and columns stay aligned.
if ($Plain) {
  $iModel = ''; $iDir = ''; $iBranch = ''; $iGit = ''; $iClean = ''; $iStyle = ''; $iEnv = ''; $iCost = ''; $iTime = ''
  $iCtx = ''; $i5h = ''; $i7d = ''; $i7dxl = ''
} else {
  $iModel = '🤖 '; $iDir = '📂 '; $iBranch = '🌿'; $iGit = '📝 '; $iClean = '✅ '; $iStyle = '🎨 '; $iEnv = '🐍 '; $iCost = '💰 '; $iTime = '⏰ '
  $iCtx = '🧠 '; $i5h = '🚀 '; $i7d = '⭐ '; $i7dxl = '🌟 '
}

# ---------------------------------------------------------------- helpers
# Integer division that truncates like bash $(( a / b )) for a >= 0.
function IDiv([long]$a, [long]$b) { return [long][Math]::Floor($a / $b) }

# Same gradients as the bash renderer → "r;g;b"
function Grad([string]$Kind, [int]$p) {
  if ($p -lt 0) { $p = 0 }; if ($p -gt 100) { $p = 100 }
  switch ($Kind) {
    'ctx' {
      if ($p -lt 30) { $t = IDiv ($p * 100) 30; $r = 245 - (IDiv (15 * $t) 100); $g = 194 - (IDiv (125 * $t) 100); $b = 231 - (IDiv (148 * $t) 100) }
      elseif ($p -lt 70) { $t = IDiv (($p - 30) * 100) 40; $r = 230 - (IDiv (20 * $t) 100); $g = 69 - (IDiv (54 * $t) 100); $b = 83 - (IDiv (26 * $t) 100) }
      else { $r = 210; $g = 15; $b = 57 }
    }
    '7d' {
      if ($p -lt 50) { $t = $p * 2; $r = 249 + (IDiv (5 * $t) 100); $g = 226 - (IDiv (126 * $t) 100); $b = 175 - (IDiv (164 * $t) 100) }
      else { $t = ($p - 50) * 2; $r = 254 - (IDiv (44 * $t) 100); $g = 100 - (IDiv (85 * $t) 100); $b = 11 + (IDiv (46 * $t) 100) }
    }
    default {
      if ($p -lt 50) { $t = $p * 2; $r = 180 - (IDiv (150 * $t) 100); $g = 190 - (IDiv (88 * $t) 100); $b = 254 - (IDiv (9 * $t) 100) }
      else { $t = ($p - 50) * 2; $r = 30 + (IDiv (180 * $t) 100); $g = 102 - (IDiv (87 * $t) 100); $b = 245 - (IDiv (188 * $t) 100) }
    }
  }
  return "$r;$g;$b"
}

function Bar([string]$Kind, [int]$p, [int]$w) {
  $f = IDiv ($p * $w + 50) 100
  if ($f -gt $w) { $f = $w }
  $end = Grad $Kind $p
  $sb = New-Object System.Text.StringBuilder
  for ($i = 0; $i -lt $f; $i++) { [void]$sb.Append("${E}[38;2;$(Grad $Kind (IDiv ($i * 100) $w))m█") }
  [void]$sb.Append("${E}[38;2;${end}m")
  for ($i = $f; $i -lt $w; $i++) { [void]$sb.Append('░') }
  return $sb.ToString() + $Rst
}

# Bold, right-aligned "  7%" / " 34%" / "100%" in the bar's end colour
function PctV([string]$Kind, [int]$p) { return "$Bld${E}[38;2;$(Grad $Kind $p)m$('{0,3}%' -f $p)$Rst" }

function Rel([double]$Seconds) {
  if ($Seconds -lt 0) { $Seconds = 0 }
  $m = [long][Math]::Floor($Seconds / 60)
  if ($m -ge 1440) { return "$(IDiv $m 1440)d$(IDiv ($m % 1440) 60)h" }
  if ($m -ge 60) { return "$(IDiv $m 60)h$('{0:00}' -f ($m % 60))m" }
  return "${m}m"
}
function SecLeft($dt) { if ($null -eq $dt) { return $null }; $s = ($dt - $Now).TotalSeconds; if ($s -lt 0) { $s = 0 }; return $s }
function Fmt($dt, [string]$f) { return $dt.ToLocalTime().ToString($f, $Inv) }
function AmPm($dt) { $l = $dt.ToLocalTime(); $h = $l.Hour % 12; if ($h -eq 0) { $h = 12 }; $ap = if ($l.Hour -ge 12) { 'pm' } else { 'am' }; return "${h}:$(Fmt $dt 'mm')$ap" }
function LongDate($dt) { $l = $dt.ToLocalTime(); $h = $l.Hour % 12; if ($h -eq 0) { $h = 12 }; $ap = if ($l.Hour -ge 12) { 'pm' } else { 'am' }; return "$(Fmt $dt 'ddd MMM d'), $h$ap" }

# Usage vs. elapsed share of the window: green under, yellow even, red ahead (or ≥ 90%)
function PaceCol([int]$Used, $Left, [double]$Span) {
  $pace = -1
  if ($null -ne $Left) { $pace = [int][Math]::Floor(($Span - $Left) * 100 / $Span) }
  if ($pace -lt 10) {
    if ($Used -ge 85) { return $cRed }; if ($Used -ge 60) { return $cYellow }; return $cGreen
  }
  $d = $Used - $pace
  if ($Used -ge 90 -or $d -ge 8) { return $cRed }
  if ($d -gt -5) { return $cYellow }
  return $cGreen
}

function JoinSep([string[]]$Parts) { return (@($Parts | Where-Object { $_ }) -join $Sep) }

# ---------------------------------------------------------------- derived values
$Short = $Model -replace '^Claude\s+', ''
$Short = $Short -replace '\s*\(.*$', ''
$Short = $Short -replace '\s+[0-9].*$', ''

$CtxTok = 0
if ($null -ne $CtxUsage) {
  if ($CtxUsage.PSObject.Properties.Name -contains 'input_tokens') {
    foreach ($k in 'input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens') {
      $v = As-Number $CtxUsage.$k; if ($null -ne $v) { $CtxTok += $v }
    }
  } else { $v = As-Number $CtxUsage; if ($null -ne $v) { $CtxTok = $v } }
}
$CtxTok = [long][Math]::Floor($CtxTok)
if ($CtxTok -gt $CtxSize) { $CtxSize = 1000000 }   # stale 200k report on a 1M session
if ($CtxTok -gt 0 -and $CtxSize -gt 0) { $CtxPct = [int](IDiv ($CtxTok * 100) $CtxSize) }
elseif ($null -ne $CtxUsedPct) { $CtxPct = $CtxUsedPct }
elseif ($null -ne $CtxLeftPct) { $CtxPct = 100 - $CtxLeftPct }
else { $CtxPct = 0 }
if ($CtxPct -gt 100) { $CtxPct = 100 }
$TokK = "$(IDiv $CtxTok 1000)k"
$SizeK = if ($CtxSize -ge 1000000 -and ($CtxSize % 1000000) -eq 0) { "$(IDiv $CtxSize 1000000)M" } else { "$(IDiv $CtxSize 1000)k" }

$CostFmt = '$' + $Cost.ToString('0.00', $Inv)
$DurS = [long][Math]::Floor($DurMs / 1000)
if ($DurS -ge 3600) { $Dur = "$(IDiv $DurS 3600)h$(IDiv ($DurS % 3600) 60)m" }
elseif ($DurS -ge 60) { $Dur = "$(IDiv $DurS 60)m" }
else { $Dur = "${DurS}s" }

$HomeDir = [Environment]::GetFolderPath('UserProfile')
$DirShow = $CurDir
if ($HomeDir -and $CurDir.StartsWith($HomeDir, [StringComparison]::OrdinalIgnoreCase)) { $DirShow = '~' + $CurDir.Substring($HomeDir.Length) }
$DirBase = Split-Path -Leaf $CurDir.TrimEnd('\', '/')
if (-not $DirBase) { $DirBase = $DirShow }

$EnvName = [Environment]::GetEnvironmentVariable('CONDA_DEFAULT_ENV')
if (-not $EnvName) { $Venv = [Environment]::GetEnvironmentVariable('VIRTUAL_ENV'); if ($Venv) { $EnvName = Split-Path -Leaf $Venv } }

$FiveLeft = if ($null -ne $FivePct) { SecLeft $FiveReset } else { $null }
$SevenLeft = if ($null -ne $SevenPct) { SecLeft $SevenReset } else { $null }

# Weekly budget: "22%/day" while a day or more is left, else "9% left"
$Budget = ''
if ($null -ne $SevenPct -and $null -ne $SevenLeft) {
  if ($SevenLeft -ge 86400) { $Budget = "$([long][Math]::Floor(((100 - $SevenPct) * 86400 + [Math]::Floor($SevenLeft / 2)) / [Math]::Floor($SevenLeft)))%/day" }
  else { $Budget = "$(100 - $SevenPct)% left" }
}

# ---------------------------------------------------------------- git (one call)
$GitOk = $false; $Branch = ''; $Oid = ''; $Ahead = 0; $Behind = 0; $Staged = 0; $Unstaged = 0; $Untracked = 0
if ((Get-Command git -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath $CurDir)) {
  # --no-optional-locks: never take index.lock, so a refreshing statusline
  # can't collide with the user's own git commands.
  $GitOut = & git --no-optional-locks -C $CurDir status --porcelain=v2 --branch 2>$null
  if ($LASTEXITCODE -eq 0) {
    $GitOk = $true
    foreach ($line in @($GitOut)) {
      if ($line.StartsWith('# branch.head ')) { $Branch = $line.Substring(14) }
      elseif ($line.StartsWith('# branch.oid ')) { $Oid = $line.Substring(13) }
      elseif ($line.StartsWith('# branch.ab ')) {
        $ab = $line.Substring(12) -split ' '
        $Ahead = [int]($ab[0].TrimStart('+')); $Behind = [int]($ab[1].TrimStart('-'))
      }
      elseif ($line.StartsWith('1 ') -or $line.StartsWith('2 ')) {
        if ($line[2] -ne '.') { $Staged++ }
        if ($line[3] -ne '.') { $Unstaged++ }
      }
      elseif ($line.StartsWith('u ')) { $Unstaged++ }
      elseif ($line.StartsWith('? ')) { $Untracked++ }
    }
    if ($Branch -eq '(detached)' -and $Oid.Length -ge 7) { $Branch = $Oid.Substring(0, 7) }
  }
}
$Dirty = ($Staged + $Unstaged + $Untracked) -gt 0

$GcParts = @()
if ($Staged) { $GcParts += "$cGreen+$Staged$Rst" }
if ($Unstaged) { $GcParts += "$cYellow!$Unstaged$Rst" }
if ($Untracked) { $GcParts += "${cOv1}?$Untracked$Rst" }   # braces: '?' is legal in PS variable names
$GC = $GcParts -join ' '
$AB = ''
if ($Ahead) { $AB += " ↑$Ahead" }
if ($Behind) { $AB += " ↓$Behind" }

# ---------------------------------------------------------------- shared segments
function Ident([string]$Which, [string]$ThinkWord) {
  $m = if ($Which -eq 'short') { $Short } else { $Model }
  $s = "$iModel$Bld$cTeal$m$Rst"
  if (-not $Plain) {
    if ($Effort) { $s += " $cPeach⚡$Effort$Rst" }
    if ($Thinking) { $s += " $cYellow💡$Rst" }
  } else {
    if ($Effort) { $s += "$Dot$cPeach$Effort$Rst" }
    if ($Thinking) { $s += "$Dot$cYellow$ThinkWord$Rst" }
  }
  return $s
}
function GitSeg([string]$Word) {
  if (-not $GitOk) { return '' }
  if ($Dirty) { $w = if ($Word) { "$cLYellow$Word$Rst " } else { '' }; return "$iGit$w$GC" }
  return "$iClean${cLGreen}clean$Rst"
}
function BranchSeg([bool]$WithAB) {
  if (-not ($GitOk -and $Branch)) { return '' }
  $a = if ($WithAB) { $AB } else { '' }
  return " $iBranch$cLGreen($Branch$a)$Rst"
}
$SS = if ($Style -and $Style -ne 'default') { "$iStyle$cPeach$Style$Rst" } else { '' }
$ES = if ($EnvName) { "$iEnv$cGreen$EnvName$Rst" } else { '' }

$Loading = "${cOv0}loading..$Rst"
$Dash = "$Bld$cOv0  --$Rst"
$Lines = New-Object System.Collections.Generic.List[string]

# ================================================================ layouts
switch ($Mode) {
  'xsmall' {
    $L1 = "$(Ident 'short' 'think')  $iDir$cSub0$DirBase$Rst"
    if ($GitOk -and $Branch) { $L1 += " $iBranch$cLGreen$Branch$Rst"; if ($Dirty) { $L1 += "$Bld$cYellow*$Rst" } }
    $L2 = if ($Plain) { "${cPink}ctx $Rst" } else { "${cPink}🧠 $Rst" }
    $L2 += "$(Bar 'ctx' $CtxPct 6)$(PctV 'ctx' $CtxPct)"
    if (-not $HasRL) {
      $L2 += "  ${cLav}5h $Rst$(Bar '5h' 0 6)$Dash  ${cYellow}7d $Rst$(Bar '7d' 0 6)$Dash  $Loading"
    } elseif ($null -ne $FivePct) {
      $L2 += "  ${cLav}5h $Rst$(Bar '5h' $FivePct 6)$(PctV '5h' $FivePct)"
      if ($null -ne $SevenPct) { $L2 += "  ${cYellow}7d $Rst$(Bar '7d' $SevenPct 6)$(PctV '7d' $SevenPct)" }
    } elseif ($null -ne $SevenPct) {
      $L2 += "  ${cYellow}wk $Rst$(Bar '7d' $SevenPct 6)$(PctV '7d' $SevenPct)"
      if ($null -ne $SevenLeft) { $L2 += " $cOv1↻$(Rel $SevenLeft)$Rst" }
    }
    $Lines.Add($L1); $Lines.Add($L2)
  }
  'small' {
    $PathSeg = "$iDir$cSub0$DirShow$Rst$(BranchSeg $false)"
    if ($GC) { $PathSeg += " $GC" }
    $Lines.Add((JoinSep @((Ident 'full' 'thinking'), $PathSeg, $SS)))
    $L2 = "$iCtx${cPink}Context$Rst $(Bar 'ctx' $CtxPct 10) $(PctV 'ctx' $CtxPct)"
    if (-not $HasRL) {
      $L2 += "$Sep${cLav}5H$Rst $(Bar '5h' 0 10)$Dash$Sep${cYellow}7D$Rst $(Bar '7d' 0 10)$Dash  $Loading"
    } elseif ($null -ne $FivePct) {
      $L2 += "$Sep${cLav}5H$Rst $(Bar '5h' $FivePct 10) $(PctV '5h' $FivePct)"
      if ($null -ne $FiveLeft) { $L2 += " $cOv2$(Rel $FiveLeft)$Rst" }
      if ($null -ne $SevenPct) {
        $L2 += "$Sep${cYellow}7D$Rst $(Bar '7d' $SevenPct 10) $(PctV '7d' $SevenPct)"
        if ($null -ne $SevenLeft) { $L2 += " $cOv2$(Fmt $SevenReset 'ddd')$Rst" }
      }
    } elseif ($null -ne $SevenPct) {
      $L2 += "$Sep${cYellow}Week$Rst $(Bar '7d' $SevenPct 10) $(PctV '7d' $SevenPct)"
      if ($null -ne $SevenLeft) { $L2 += " $cOv2$(Fmt $SevenReset 'ddd HH:mm') · $(Rel $SevenLeft)$Rst" }
    }
    $Lines.Add($L2)
  }
  'medium' {
    $Lines.Add((JoinSep @((Ident 'full' 'thinking'), (GitSeg ''), $ES, $SS)))
    $Lines.Add("$iDir$cSub0$DirShow$Rst$(BranchSeg $true)")
    $Lines.Add("$iCtx$cPink$('Context'.PadRight(9))$Rst$(Bar 'ctx' $CtxPct 40) $(PctV 'ctx' $CtxPct)$cOv2  $TokK/$SizeK$Rst")
    $UL = 'Usage'.PadRight(9)
    if (-not $HasRL) {
      $Lines.Add("$i5h$cLav${UL}5H $Rst$(Bar '5h' 0 14)$Dash$Sep${cYellow}7D $Rst$(Bar '7d' 0 14)$Dash  $Loading")
    } elseif ($null -ne $FivePct) {
      $L4 = "$i5h$cLav${UL}5H $Rst$(Bar '5h' $FivePct 14) $(PctV '5h' $FivePct)"
      if ($null -ne $FiveLeft) { $L4 += " $cOv2$(Rel $FiveLeft)$Rst" }
      if ($null -ne $SevenPct) {
        $L4 += "$Sep${cYellow}7D $Rst$(Bar '7d' $SevenPct 14) $(PctV '7d' $SevenPct)"
        if ($null -ne $SevenLeft) { $L4 += " $cOv2$(Fmt $SevenReset 'ddd')$Rst" }
      }
      $Lines.Add($L4)
    } elseif ($null -ne $SevenPct) {
      # Weekly only (Ultra): full-width bar in the same column as Context
      $L4 = "$i7d$cYellow$('Weekly'.PadRight(9))$Rst$(Bar '7d' $SevenPct 40) $(PctV '7d' $SevenPct)"
      if ($null -ne $SevenLeft) {
        $L4 += "$cOv2  $(Fmt $SevenReset 'ddd HH:mm') · $(Rel $SevenLeft)"
        if ($Budget) { $L4 += " · $Budget" }
        $L4 += $Rst
      }
      $Lines.Add($L4)
    }
  }
  'xlarge' {
    $Lines.Add((JoinSep @((Ident 'full' 'thinking'), $SS, (GitSeg 'dirty'), $ES)))
    $Lines.Add((JoinSep @("$iDir$cSub0$DirShow$Rst$(BranchSeg $true)", "$iCost$cYellow$CostFmt$Rst", "$iTime$cSub0$Dur$Rst")))
    $Lines.Add("$iCtx$cMaroon$('Context'.PadRight(10))$Rst$(Bar 'ctx' $CtxPct 40) $(PctV 'ctx' $CtxPct)$cOv2  used ($TokK / $(IDiv $CtxSize 1000)k)$Rst")
    if (-not $HasRL) {
      $Lines.Add("$i5h$cLav$('5H Limit'.PadRight(10))$Rst$(Bar '5h' 0 40)$Dash  $Loading")
      $Lines.Add("$i7dxl$cYellow$('7D Limit'.PadRight(10))$Rst$(Bar '7d' 0 40)$Dash  $Loading")
    } else {
      if ($null -ne $FivePct) {
        $L = "$i5h$cLav$('5H Limit'.PadRight(10))$Rst$(Bar '5h' $FivePct 40) $(PctV '5h' $FivePct)"
        if ($null -ne $FiveLeft) { $L += "$cOv2  resets in $(Rel $FiveLeft) ($(AmPm $FiveReset))$Rst" }
        $Lines.Add($L)
      }
      if ($null -ne $SevenPct) {
        $Lbl = if ($null -ne $FivePct) { '7D Limit' } else { 'Weekly' }
        $L = "$i7dxl$cYellow$($Lbl.PadRight(10))$Rst$(Bar '7d' $SevenPct 40) $(PctV '7d' $SevenPct)"
        if ($null -ne $SevenLeft) {
          $L += "$cOv2  resets $(LongDate $SevenReset) (in $(Rel $SevenLeft))"
          if ($null -eq $FivePct -and $Budget) { $L += " · ≈$Budget" }
          $L += $Rst
        }
        $Lines.Add($L)
      }
    }
  }
  'simple' {
    $L1 = "$(Ident 'full' 'thinking')   $cSub0$DirShow$Rst"
    if ($GitOk -and $Branch) { $L1 += " $cGreen$Branch$Rst"; if ($GC) { $L1 += " $GC" } }
    $L2 = "${cOv1}ctx $Rst$Bld${E}[38;2;$(Grad 'ctx' $CtxPct)m$CtxPct%$Rst"
    if (-not $HasRL) {
      $L2 += "   ${cOv1}limits $Rst$Loading"
    } elseif ($null -ne $FivePct) {
      $L2 += "   ${cOv1}5h $Rst$Bld$(PaceCol $FivePct $FiveLeft 18000)$FivePct%$Rst"
      if ($null -ne $FiveLeft) { $L2 += " $cOv2$(Rel $FiveLeft)$Rst" }
      if ($null -ne $SevenPct) {
        $L2 += "   ${cOv1}7d $Rst$Bld$(PaceCol $SevenPct $SevenLeft 604800)$SevenPct%$Rst"
        if ($null -ne $SevenLeft) { $L2 += " $cOv2$(Fmt $SevenReset 'ddd HH:mm')$Rst" }
      }
    } elseif ($null -ne $SevenPct) {
      $L2 += "   ${cOv1}week $Rst$Bld$(PaceCol $SevenPct $SevenLeft 604800)$SevenPct%$Rst"
      if ($null -ne $SevenLeft) {
        $L2 += " $cOv2$(Fmt $SevenReset 'ddd HH:mm')"
        if ($Budget) { $L2 += " · $Budget" }
        $L2 += $Rst
      }
    }
    $L2 += "   ${cOv1}cost $Rst$Bld$cYellow$CostFmt$Rst   ${cOv1}time $Rst$Bld$cSub1$Dur$Rst"
    $Lines.Add($L1); $Lines.Add($L2)
  }
  'oneline' {
    $L = "$(Ident 'short' 'think')$Sep${cOv1}ctx $Rst$Bld${E}[38;2;$(Grad 'ctx' $CtxPct)m$CtxPct%$Rst"
    if (-not $HasRL) {
      $L += "$Sep${cOv1}5h $Rst$cOv0--$Rst$Sep${cOv1}7d $Rst$cOv0--$Rst"
    } else {
      if ($null -ne $FivePct) { $L += "$Sep${cOv1}5h $Rst$Bld$(PaceCol $FivePct $FiveLeft 18000)$FivePct%$Rst" }
      if ($null -ne $SevenPct) {
        $Lbl = if ($null -ne $FivePct) { '7d' } else { 'wk' }
        $L += "$Sep${cOv1}$Lbl $Rst$Bld$(PaceCol $SevenPct $SevenLeft 604800)$SevenPct%$Rst"
        if ($null -eq $FivePct -and $null -ne $SevenLeft) { $L += " $cOv1↻$(Rel $SevenLeft)$Rst" }
      }
    }
    if ($GitOk -and $Branch) { $L += "$Sep$cLGreen$Branch$Rst"; if ($Dirty) { $L += "$Bld$cYellow*$Rst" } }
    $Lines.Add($L)
  }
  default {
    # large
    $Lines.Add((JoinSep @((Ident 'full' 'thinking'), (GitSeg ''), $ES, $SS)))
    $Lines.Add((JoinSep @("$iDir$cSub0$DirShow$Rst$(BranchSeg $true)", "$iCost$cYellow$CostFmt$Rst", "$iTime$cSub0$Dur$Rst")))
    $Lines.Add("$iCtx$cPink$('Context'.PadRight(10))$Rst$(Bar 'ctx' $CtxPct 20) $(PctV 'ctx' $CtxPct)$cOv2  $TokK/$SizeK$Rst")
    if (-not $HasRL) {
      $Lines.Add("$i5h$cLav$('Usage 5H'.PadRight(10))$Rst$(Bar '5h' 0 20)$Dash  $Loading")
      $Lines.Add("$i7d$cYellow$('Usage 7D'.PadRight(10))$Rst$(Bar '7d' 0 20)$Dash  $Loading")
    } else {
      if ($null -ne $FivePct) {
        $L = "$i5h$cLav$('Usage 5H'.PadRight(10))$Rst$(Bar '5h' $FivePct 20) $(PctV '5h' $FivePct)"
        if ($null -ne $FiveLeft) { $L += "$cOv2  resets in $(Rel $FiveLeft) · $(Fmt $FiveReset 'HH:mm')$Rst" }
        $Lines.Add($L)
      }
      if ($null -ne $SevenPct) {
        $Lbl = if ($null -ne $FivePct) { 'Usage 7D' } else { 'Weekly' }
        $L = "$i7d$cYellow$($Lbl.PadRight(10))$Rst$(Bar '7d' $SevenPct 20) $(PctV '7d' $SevenPct)"
        if ($null -ne $SevenLeft) {
          $L += "$cOv2  resets $(Fmt $SevenReset 'ddd HH:mm') · $(Rel $SevenLeft)"
          if ($null -eq $FivePct -and $Budget) { $L += " · ≈$Budget" }
          $L += $Rst
        }
        $Lines.Add($L)
      }
    }
  }
}

foreach ($Line in $Lines) { [Console]::WriteLine("$Line$Clr") }
