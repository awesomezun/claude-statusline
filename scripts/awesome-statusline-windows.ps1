# Awesome Statusline renderer for Windows PowerShell.
# Claude Code runs this command from statusLine.command, sends JSON on stdin,
# and renders whatever this script writes to stdout.
param([string]$Size = 'large')

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'

try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

function Normalize-Mode([string]$s) {
  $Key = if ($s) { $s.ToLowerInvariant() } else { '' }
  switch ($Key) {
    'xs'     { return 'xsmall' }
    'xsmall' { return 'xsmall' }
    's'      { return 'small' }
    'small'  { return 'small' }
    'm'      { return 'medium' }
    'medium' { return 'medium' }
    'l'      { return 'large' }
    'large'  { return 'large' }
    'xl'     { return 'xlarge' }
    'xlarge' { return 'xlarge' }
    default  { return 'large' }
  }
}

$Mode = Normalize-Mode $Size
# Read stdin as UTF-8 explicitly. Windows PowerShell 5.1 otherwise decodes it
# with the system ANSI code page (e.g. CP949 on Korean systems), so any
# non-ASCII text in the payload (such as a Korean session_name) corrupts the
# JSON and the status line silently falls back to defaults. Wrapping the raw
# stream also avoids [Console]::InputEncoding, which can throw without a console.
$StdinReader = [System.IO.StreamReader]::new([Console]::OpenStandardInput(), [System.Text.UTF8Encoding]::new($false))
$InputJson = $StdinReader.ReadToEnd()
try {
  $Data = $InputJson | ConvertFrom-Json
} catch {
  $Data = $null
}

function Get-JsonValue($Object, [string[]]$Path, $Default) {
  $Current = $Object
  foreach ($Part in $Path) {
    if ($null -eq $Current) { return $Default }
    if ($Current.PSObject.Properties.Name -contains $Part) {
      $Current = $Current.$Part
    } else {
      return $Default
    }
  }
  if ($null -eq $Current) { return $Default }
  return $Current
}

function As-Number($Value, [double]$Default = 0) {
  if ($null -eq $Value) { return $Default }
  try { return [double]$Value } catch { return $Default }
}

function Clamp-Pct([double]$Pct) {
  if ($Pct -lt 0) { return 0 }
  if ($Pct -gt 100) { return 100 }
  return [int][Math]::Round($Pct)
}

$Esc = [char]27
$Reset = "$Esc[0m"
$Bold = "$Esc[1m"
$ClearLine = "$Esc[K"

function Rgb([int]$r, [int]$g, [int]$b) { return "$Esc[38;2;$r;$g;${b}m" }

$C = @{
  Teal        = (Rgb 148 226 213)
  Pink        = (Rgb 245 194 231)
  Peach       = (Rgb 250 179 135)
  Green       = (Rgb 166 227 161)
  Subtext     = (Rgb 166 173 200)
  Lavender    = (Rgb 180 190 254)
  Yellow      = (Rgb 249 226 175)
  Overlay     = (Rgb 108 112 134)
  LatteGreen  = (Rgb 64 160 43)
  LatteRed    = (Rgb 210 15 57)
  LatteBlue   = (Rgb 30 102 245)
  LattePeach  = (Rgb 254 100 11)
  LatteYellow = (Rgb 223 142 29)
}

function Context-Color([int]$Pct) {
  if ($Pct -lt 30) {
    $t = $Pct * 100 / 30
    return @(
      [int](245 + (230 - 245) * $t / 100),
      [int](194 + (69 - 194) * $t / 100),
      [int](231 + (83 - 231) * $t / 100)
    )
  }
  if ($Pct -lt 70) {
    $t = ($Pct - 30) * 100 / 40
    return @(
      [int](230 + (210 - 230) * $t / 100),
      [int](69 + (15 - 69) * $t / 100),
      [int](83 + (57 - 83) * $t / 100)
    )
  }
  return @(210, 15, 57)
}

function Usage-Color([int]$Pct) {
  if ($Pct -lt 50) {
    $t = $Pct * 2
    return @(
      [int](180 + (30 - 180) * $t / 100),
      [int](190 + (102 - 190) * $t / 100),
      [int](254 + (245 - 254) * $t / 100)
    )
  }
  $t = ($Pct - 50) * 2
  return @(
    [int](30 + (210 - 30) * $t / 100),
    [int](102 + (15 - 102) * $t / 100),
    [int](245 + (57 - 245) * $t / 100)
  )
}

function Usage7D-Color([int]$Pct) {
  if ($Pct -lt 50) {
    $t = $Pct * 2
    return @(
      [int](249 + (254 - 249) * $t / 100),
      [int](226 + (100 - 226) * $t / 100),
      [int](175 + (11 - 175) * $t / 100)
    )
  }
  $t = ($Pct - 50) * 2
  return @(
    [int](254 + (210 - 254) * $t / 100),
    [int](100 + (15 - 100) * $t / 100),
    [int](11 + (57 - 11) * $t / 100)
  )
}

function Bar([int]$Pct, [int]$Width, [string]$Type) {
  $Pct = Clamp-Pct $Pct
  $Filled = [Math]::Min($Width, [Math]::Max(0, [int][Math]::Round($Pct * $Width / 100)))
  switch ($Type) {
    'context' { $End = Context-Color $Pct }
    '7d'      { $End = Usage7D-Color $Pct }
    default   { $End = Usage-Color $Pct }
  }

  $Out = ''
  for ($i = 0; $i -lt $Filled; $i++) {
    $BlockPct = [int]($i * 100 / $Width)
    switch ($Type) {
      'context' { $Color = Context-Color $BlockPct }
      '7d'      { $Color = Usage7D-Color $BlockPct }
      default   { $Color = Usage-Color $BlockPct }
    }
    $Out += "$(Rgb $($Color[0]) $($Color[1]) $($Color[2]))█"
  }
  for ($i = 0; $i -lt ($Width - $Filled); $i++) {
    $Out += "$(Rgb $($End[0]) $($End[1]) $($End[2]))░"
  }
  return "$Out$Reset"
}

function Short-Path([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { return '.' }
  $HomeDir = [Environment]::GetFolderPath('UserProfile')
  if ($HomeDir -and $Path.StartsWith($HomeDir, [StringComparison]::OrdinalIgnoreCase)) {
    return '~' + $Path.Substring($HomeDir.Length)
  }
  return $Path
}

function Short-Model([string]$Model) {
  $m = $Model -replace '^Claude\s+', ''
  $m = $m -replace '\s+[0-9.]+$', ''
  return $m
}

function Format-Duration([double]$Milliseconds) {
  $Seconds = [int]($Milliseconds / 1000)
  if ($Seconds -ge 3600) { return "{0}h{1}m" -f [int]($Seconds / 3600), [int](($Seconds % 3600) / 60) }
  if ($Seconds -ge 60) { return "{0}m" -f [int]($Seconds / 60) }
  return "${Seconds}s"
}

function Parse-Reset($Value) {
  if ($null -eq $Value -or "$Value" -eq '') { return $null }
  try {
    if ("$Value" -match '^\d+(\.\d+)?$') {
      $Epoch = [DateTime]::SpecifyKind([DateTime]'1970-01-01T00:00:00', [DateTimeKind]::Utc)
      return $Epoch.AddSeconds([double]$Value).ToLocalTime()
    }
    return ([DateTime]::Parse("$Value")).ToLocalTime()
  } catch {
    return $null
  }
}

function Format-Remaining($Value) {
  $dt = Parse-Reset $Value
  if ($null -eq $dt) { return 'N/A' }
  $Remaining = $dt - (Get-Date)
  if ($Remaining.TotalSeconds -lt 0) { $Remaining = [TimeSpan]::Zero }
  return "{0}h{1}m left" -f [int]$Remaining.TotalHours, $Remaining.Minutes
}

function Format-ResetDate($Value) {
  $dt = Parse-Reset $Value
  if ($null -eq $dt) { return 'N/A' }
  return $dt.ToString('ddd HH:mm', [Globalization.CultureInfo]::InvariantCulture)
}

$Model = [string](Get-JsonValue $Data @('model', 'display_name') 'Unknown')
$CurrentDir = [string](Get-JsonValue $Data @('workspace', 'current_dir') '.')
$ContextSize = As-Number (Get-JsonValue $Data @('context_window', 'context_window_size') 200000) 200000
$CurrentUsage = Get-JsonValue $Data @('context_window', 'current_usage') $null
$OutputStyle = [string](Get-JsonValue $Data @('output_style', 'name') '')
$TotalCost = As-Number (Get-JsonValue $Data @('cost', 'total_cost_usd') 0) 0
$TotalDuration = As-Number (Get-JsonValue $Data @('cost', 'total_duration_ms') 0) 0
$Effort = [string](Get-JsonValue $Data @('effort', 'level') '')
$Thinking = Get-JsonValue $Data @('thinking', 'enabled') $false
$FiveHourPctRaw = Get-JsonValue $Data @('rate_limits', 'five_hour', 'used_percentage') $null
$FiveHourReset = Get-JsonValue $Data @('rate_limits', 'five_hour', 'resets_at') $null
$SevenDayPctRaw = Get-JsonValue $Data @('rate_limits', 'seven_day', 'used_percentage') $null
$SevenDayReset = Get-JsonValue $Data @('rate_limits', 'seven_day', 'resets_at') $null

$CurrentTokens = 0
if ($null -ne $CurrentUsage) {
  if ($CurrentUsage.PSObject.Properties.Name -contains 'input_tokens') {
    $CurrentTokens += As-Number $CurrentUsage.input_tokens
    $CurrentTokens += As-Number $CurrentUsage.cache_creation_input_tokens
    $CurrentTokens += As-Number $CurrentUsage.cache_read_input_tokens
  } else {
    $CurrentTokens = As-Number $CurrentUsage
  }
}

# harness sometimes reports a stale 200k window even when the model is
# actually running the 1m context beta (seen on opus and fable alike) --
# usage exceeding the declared window is proof the declared size is wrong
if ($CurrentTokens -gt $ContextSize) {
  $ContextSize = 1000000
}

$ContextPct = if ($ContextSize -gt 0) { Clamp-Pct ($CurrentTokens * 100 / $ContextSize) } else { 0 }
$CurrentK = [int]($CurrentTokens / 1000)
$ContextK = [int]($ContextSize / 1000)

$FiveHourPct = if ($null -ne $FiveHourPctRaw) { Clamp-Pct (As-Number $FiveHourPctRaw) } else { 0 }
$SevenDayPct = if ($null -ne $SevenDayPctRaw) { Clamp-Pct (As-Number $SevenDayPctRaw) } else { 0 }
$HasRateLimits = $null -ne $FiveHourPctRaw

$GitAvailable = $false
$Branch = ''
$GitStatus = ''
$AheadBehind = ''
if ((Get-Command git -ErrorAction SilentlyContinue) -and (Test-Path $CurrentDir)) {
  $InsideGit = (& git -C $CurrentDir rev-parse --is-inside-work-tree 2>$null)
  if ($InsideGit -eq 'true') {
    $GitAvailable = $true
    $Branch = (& git -C $CurrentDir branch --show-current 2>$null)
    $Staged = @(& git -C $CurrentDir diff --cached --name-only 2>$null).Count
    $Unstaged = @(& git -C $CurrentDir diff --name-only 2>$null).Count
    $Untracked = @(& git -C $CurrentDir ls-files --others --exclude-standard 2>$null).Count
    if ($Staged -eq 0 -and $Unstaged -eq 0 -and $Untracked -eq 0) {
      $GitStatus = "$($C.LatteGreen)✅ clean$Reset"
    } else {
      $StatusBits = ''
      if ($Staged -gt 0) { $StatusBits += "+$Staged" }
      if ($Unstaged -gt 0) { $StatusBits += "!$Unstaged" }
      if ($Untracked -gt 0) { $StatusBits += "?$Untracked" }
      $GitStatus = "$($C.LatteYellow)📝$StatusBits$Reset"
    }
    $Counts = (& git -C $CurrentDir rev-list --left-right --count '@{upstream}...HEAD' 2>$null)
    if ($Counts) {
      $Parts = "$Counts".Trim() -split '\s+'
      if ($Parts.Count -ge 2) {
        if ([int]$Parts[1] -gt 0) { $AheadBehind += " ↑$($Parts[1])" }
        if ([int]$Parts[0] -gt 0) { $AheadBehind += " ↓$($Parts[0])" }
      }
    }
  }
}

# Outside a git repo, show a muted placeholder (same style as "no env")
# instead of leaving an awkward empty gap between separators.
if (-not $GitAvailable) { $GitStatus = "$($C.Overlay)no git$Reset" }

$Conda = [Environment]::GetEnvironmentVariable('CONDA_DEFAULT_ENV')
$Venv = [Environment]::GetEnvironmentVariable('VIRTUAL_ENV')
if ($Conda) {
  $EnvDisplay = "🐍 $($C.Green)$Conda$Reset"
} elseif ($Venv) {
  $EnvDisplay = "🐍 $($C.Green)venv$Reset"
} else {
  $EnvDisplay = "$($C.Overlay)no env$Reset"
}

$ModelDisplay = "🤖 $Bold$($C.Teal)$Model$Reset"
if ($Mode -eq 'xsmall') { $ModelDisplay = "🤖 $Bold$($C.Teal)$(Short-Model $Model)$Reset" }
if ($Effort) { $ModelDisplay += " $($C.Peach)⚡$Effort$Reset" }
$ThinkingText = "$Thinking"
if ($Thinking -eq $true -or $ThinkingText.ToLowerInvariant() -eq 'true') { $ModelDisplay += " $($C.Yellow)💡$Reset" }

# Compact modes (xsmall/small) shorten $HOME to ~ to save horizontal space;
# the roomier modes (medium/large/xlarge) show the full absolute path.
if ($Mode -eq 'xsmall' -or $Mode -eq 'small') {
  $DirDisplay = "📂 $($C.Subtext)$(Short-Path $CurrentDir)$Reset"
} else {
  $DirDisplay = "📂 $($C.Subtext)$CurrentDir$Reset"
}
$BranchDisplay = ''
if ($GitAvailable -and $Branch) { $BranchDisplay = " $($C.LatteGreen)🌿($Branch)$AheadBehind$Reset" }
$StyleDisplay = if ($OutputStyle) { "🎨 $($C.Peach)$OutputStyle$Reset" } else { '' }
$CostDisplay = "💰 $($C.Yellow)$('{0:N2}' -f $TotalCost)`$$Reset"
$DurationDisplay = "⏰ $($C.Subtext)$(Format-Duration $TotalDuration)$Reset"

switch ($Mode) {
  'xsmall' {
    $Line1 = "$ModelDisplay $DirDisplay$BranchDisplay"
    if ($GitAvailable) {
      if ($GitStatus -match 'clean') {
        $Line1 += "$($C.Green)✅$Reset"
      } else {
        $Line1 += "$($C.LatteYellow)📝$Reset"
      }
    }
    $Line2 = "🧠 $(Bar $ContextPct 10 'context') $($C.Lavender)5H$Reset$(Bar $FiveHourPct 10 '5h') $($C.Yellow)7D$Reset$(Bar $SevenDayPct 10 '7d')"
    if (-not $HasRateLimits) { $Line2 += " $($C.Overlay)(loading..)$Reset" }
    [Console]::WriteLine("$Line1$ClearLine")
    [Console]::WriteLine("$Line2$ClearLine")
  }
  'small' {
    $Line1 = "$ModelDisplay │ $StyleDisplay │ $DirDisplay$BranchDisplay"
    # Match the Bash renderer's colours: pink/lavender/yellow labels, and each
    # percentage in its bar's gradient end-colour, bold.
    $CtxEnd = Context-Color $ContextPct
    $FiveEnd = Usage-Color $FiveHourPct
    $SevenEnd = Usage7D-Color $SevenDayPct
    $CtxPct = "$Bold$(Rgb $CtxEnd[0] $CtxEnd[1] $CtxEnd[2])${ContextPct}%$Reset"
    $FivePct = "$Bold$(Rgb $FiveEnd[0] $FiveEnd[1] $FiveEnd[2])${FiveHourPct}%$Reset"
    $SevenPct = "$Bold$(Rgb $SevenEnd[0] $SevenEnd[1] $SevenEnd[2])${SevenDayPct}%$Reset"
    $Line2 = "🧠 $($C.Pink)Context$Reset $(Bar $ContextPct 10 'context') $CtxPct │ $($C.Lavender)5H$Reset $(Bar $FiveHourPct 10 '5h') $FivePct │ $($C.Yellow)7D$Reset $(Bar $SevenDayPct 10 '7d') $SevenPct"
    if (-not $HasRateLimits) { $Line2 += " $($C.Overlay)(loading..)$Reset" }
    [Console]::WriteLine("$Line1$ClearLine")
    [Console]::WriteLine("$Line2$ClearLine")
  }
  'medium' {
    $Line1 = "$ModelDisplay │ $GitStatus │ $EnvDisplay │ $StyleDisplay"
    $Line2 = "$DirDisplay$BranchDisplay"
    $Line3 = "📝 $($C.Pink)Context$Reset $(Bar $ContextPct 40 'context') $Bold${ContextPct}% used$Reset"
    $Line4 = if ($HasRateLimits) {
      "🚀 Usage 5H $(Bar $FiveHourPct 10 '5h') ${FiveHourPct}% │ 7D $(Bar $SevenDayPct 10 '7d') ${SevenDayPct}%"
    } else {
      "🚀 Usage 5H $(Bar 0 10 '5h') 0% │ 7D $(Bar 0 10 '7d') 0% $($C.Overlay)(loading..)$Reset"
    }
    [Console]::WriteLine("$Line1$ClearLine")
    [Console]::WriteLine("$Line2$ClearLine")
    [Console]::WriteLine("$Line3$ClearLine")
    [Console]::WriteLine("$Line4$ClearLine")
  }
  'xlarge' {
    $Line1 = "$ModelDisplay │ $StyleDisplay │ $GitStatus │ $EnvDisplay"
    $Line2 = "$DirDisplay$BranchDisplay │ $CostDisplay │ $DurationDisplay"
    $Line3 = "🧠 $($C.Pink)Context$Reset  $(Bar $ContextPct 40 'context') $Bold${ContextPct}% used$Reset (${CurrentK}k/${ContextK}k)"
    if ($HasRateLimits) {
      $Line4 = "🚀 $($C.Lavender)5H Limit$Reset $(Bar $FiveHourPct 40 '5h') $Bold${FiveHourPct}%$Reset (Resets in $(Format-Remaining $FiveHourReset))"
      $Line5 = "🌟 $($C.Yellow)7D Limit$Reset $(Bar $SevenDayPct 40 '7d') $Bold${SevenDayPct}%$Reset (Resets $(Format-ResetDate $SevenDayReset))"
    } else {
      $Line4 = "🚀 $($C.Lavender)5H Limit$Reset $(Bar 0 40 '5h') 0% $($C.Overlay)(loading..)$Reset"
      $Line5 = "🌟 $($C.Yellow)7D Limit$Reset $(Bar 0 40 '7d') 0% $($C.Overlay)(loading..)$Reset"
    }
    [Console]::WriteLine("$Line1$ClearLine")
    [Console]::WriteLine("$Line2$ClearLine")
    [Console]::WriteLine("$Line3$ClearLine")
    [Console]::WriteLine("$Line4$ClearLine")
    [Console]::WriteLine("$Line5$ClearLine")
  }
  default {
    $Line1 = "$ModelDisplay │ $GitStatus │ $EnvDisplay │ $StyleDisplay"
    $Line2 = "$DirDisplay$BranchDisplay │ $CostDisplay │ $DurationDisplay"
    $Line3 = "🧠 $($C.Pink)Context$Reset  $(Bar $ContextPct 20 'context') $Bold${ContextPct}% used$Reset (${CurrentK}k/${ContextK}k)"
    if ($HasRateLimits) {
      $Line4 = "🚀 $($C.Lavender)Usage 5H$Reset $(Bar $FiveHourPct 20 '5h') $Bold${FiveHourPct}%$Reset (Reset $(Format-Remaining $FiveHourReset))"
      $Line5 = "⭐ $($C.Yellow)Usage 7D$Reset $(Bar $SevenDayPct 20 '7d') $Bold${SevenDayPct}%$Reset (Reset $(Format-ResetDate $SevenDayReset))"
    } else {
      $Line4 = "🚀 $($C.Lavender)Usage 5H$Reset $(Bar 0 20 '5h') 0% $($C.Overlay)(loading..)$Reset"
      $Line5 = "⭐ $($C.Yellow)Usage 7D$Reset $(Bar 0 20 '7d') 0% $($C.Overlay)(loading..)$Reset"
    }
    [Console]::WriteLine("$Line1$ClearLine")
    [Console]::WriteLine("$Line2$ClearLine")
    [Console]::WriteLine("$Line3$ClearLine")
    [Console]::WriteLine("$Line4$ClearLine")
    [Console]::WriteLine("$Line5$ClearLine")
  }
}
