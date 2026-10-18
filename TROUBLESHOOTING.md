# Troubleshooting

## Windows — security software blocks `irm | iex`

### Symptoms
- PowerShell refuses to run the one-line installer.
- Endpoint security, Defender policy, or a company device policy blocks
  `Invoke-RestMethod ... | Invoke-Expression`.

### Fix
Download the installer first, inspect it, then run the local file:

```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.ps1 -OutFile .\install.ps1
notepad .\install.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

To choose a size:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 small
```

This keeps the quick install available, but avoids executing a remote script
directly through a pipeline.

---

## Windows — blank statusline and/or empty bash windows keep popping up

### Symptoms
- The statusline area is empty (no model / no bars).
- Several blank terminal windows appear, e.g.
  `/usr/bin/bash --login -i C:\Users\<you>\.claude\awesome-statusline.sh`,
  and a new one is added on every statusline refresh.

### Cause
Older installs used a Bash statusline on Windows. That could fail in two ways:
1. **Blank windows** — a bare `.sh` path could be launched through Windows file
   association / Git Bash interactive mode, so stdin/stdout never reached
   Claude Code.
2. **Blank content** — the Bash renderer needed `jq`; if `jq` was not on `PATH`,
   every JSON parse failed.

### Fix — automatic (recommended)
Re-run the installer. As of this version it:
- installs a native **`~/.claude/awesome-statusline.ps1`** renderer,
- sets `statusLine.command` to `powershell -NoProfile -ExecutionPolicy Bypass ...`,
- no longer requires Git Bash or `jq` on Windows.

```powershell
./install.ps1            # or ./install.ps1 l   (xs/s/m/l/xl)
```

Then restart Claude Code. Any blank windows already open can be closed — no new
ones will be created.

### Fix — manual
1. `~/.claude/settings.json` →
   ```json
   "statusLine": {
     "type": "command",
     "command": "powershell -NoProfile -ExecutionPolicy Bypass -File C:/Users/<you>/.claude/awesome-statusline.ps1 -Size large"
   }
   ```
2. Make sure `awesome-statusline.ps1` exists at that path. The installer copies
   it from `scripts/awesome-statusline-windows.ps1`.

---

## Windows — blank statusline on a non-UTF-8 locale (Korean/Japanese/Chinese)

### Symptoms
- The statusline is completely blank, even though `awesome-statusline.ps1` is
  installed and `settings.json` is configured correctly.
- Running the script by hand shows a parser error like:
  ```
  At C:\Users\<you>\.claude\awesome-statusline.ps1:NNN char:NN
  + ... $(Rgb $($End[0]) $($End[1]) $($End[2]))??
  Unexpected token '$(' in expression or statement.
  ```
  The `??` is where the progress-bar glyphs (`█` `░`) should be.

### Cause
**Windows PowerShell 5.1** does not auto-detect UTF-8. When a `.ps1` file has
**no BOM**, PS 5.1 reads it using the system **ANSI code page** — `CP949` on a
Korean system, `CP932`/`CP936` on Japanese/Chinese. The UTF-8 bytes for the
block glyphs (`█` = `E2 96 88`, `░` = `E2 96 91`) are then decoded as garbage
tokens that break the parser, so the script crashes on every run.

This does **not** affect macOS/Linux, PowerShell 7+, or Windows systems whose
ANSI code page is already UTF-8 (65001).

### Fix — automatic (recommended)
Re-run the installer. As of this version it writes
`awesome-statusline.ps1` as **UTF-8 *with* BOM**, so PS 5.1 parses it correctly
regardless of the system code page:

```powershell
./install.ps1            # or ./install.ps1 l   (xs/s/m/l/xl)
```

### Fix — manual (older installs, before re-running)
Re-save the existing file as UTF-8 with BOM, then restart Claude Code:

```powershell
$path = "$HOME\.claude\awesome-statusline.ps1"
Copy-Item $path "$path.nobom-backup" -Force
$text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($path, $text, ([System.Text.UTF8Encoding]::new($true)))
```

Verify the file now starts with a BOM (`EF BB BF`):

```powershell
$b = [System.IO.File]::ReadAllBytes("$HOME\.claude\awesome-statusline.ps1")
'{0:X2} {1:X2} {2:X2}' -f $b[0],$b[1],$b[2]   # expect: EF BB BF
```

---

## macOS / Linux — statusline characters wrap one-per-line inside tmux

### Symptoms
Inside a `tmux` session each glyph of the statusline is pushed onto its own line
(the bars and `38% / Usage / N/A` stack vertically). Outside tmux it renders fine.

### Cause
The statusline emits 24-bit **truecolor** escapes (`\033[38;2;r;g;bm`), **emoji**,
and **Unicode block glyphs** (`█`, `░`). When tmux is not configured for truecolor
(`RGB`/`Tc` capability missing), the display-width Claude Code computes for each
cell disagrees with what tmux actually draws, the cursor drifts, and cells wrap.

### Fix
Add truecolor support to `~/.tmux.conf`, then reload tmux:

```tmux
set -g default-terminal "tmux-256color"
set -ga terminal-overrides ",xterm-256color:RGB"
```

```bash
tmux kill-server   # or: tmux source-file ~/.tmux.conf  (then restart the session)
```

If wrapping persists after enabling truecolor, the cause is emoji/wide-glyph
width rather than color — switch to a lighter mode (`compact` / `small`), which
uses fewer wide glyphs.

---

## macOS / Linux — `curl … | bash` install fails with `BASH_SOURCE[0]: unbound variable`

### Symptoms
Running the recommended one-line installer dies immediately:

```bash
curl -fsSL https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.sh | bash -s -- xs
```

```
bash: line NN: BASH_SOURCE[0]: unbound variable
bash: line NN: cd: null directory
```

### Cause
When the script is piped into `bash` (rather than run as a file), `BASH_SOURCE`
is unset. Combined with `set -euo pipefail` (the `-u` flag forbids unbound
variables), referencing `${BASH_SOURCE[0]}` to compute the script's own
directory crashes before the installer can do anything.

### Fix — automatic (recommended)
Already fixed as of this version: `install.sh` guards the lookup with
`${BASH_SOURCE:-}` and falls back to downloading the repo when the path is
unknown (the `curl | bash` case). Just re-run the installer.

### Fix — manual (older copies)
Download and run the file instead of piping, which gives `BASH_SOURCE` a real
value:

```bash
curl -fsSL https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.sh -o install.sh
bash install.sh xs
```

---

## Any OS — segment dividers look broken (gap in the middle of `|`)

### Symptoms
The vertical dividers between statusline segments (Model / Git / Env / Style,
Dir / Cost / Duration) render with a gap in the middle instead of a continuous
line.

### Cause
Older versions drew the divider with the **ASCII pipe `|` (U+007C)**. Many
terminal/programming fonts render that glyph shorter than the line height, or as
a "broken bar (¦)" — so it looks split. This is a glyph-choice issue, not a
script bug. Box-drawing `│` (U+2502) is designed to fill the full line height
and join continuously.

### Fix
Already fixed: **both** the macOS/Linux Bash renderers (`small` / `medium` /
`large` / `xlarge`) **and** the Windows PowerShell renderer
(`awesome-statusline-windows.ps1`) use box-drawing `│` (U+2502) for dividers.
Re-run the installer to pick up the updated script. (`xsmall` uses no dividers,
so it is unaffected.)

> Note: the divider lives in two separate renderers (Bash + PowerShell). Both
> must use `│`; a fix to one does not propagate to the other. If you change the
> divider glyph, change it in every `scripts/awesome-statusline-*.sh` **and** in
> `scripts/awesome-statusline-windows.ps1`.

If `│` still shows a faint gap in your particular font, switch the divider
glyph to a heavier variant — `┃` (U+2503, bold) or `║` (U+2551, double) — in
`~/.claude/awesome-statusline.sh`.

---

## Any OS — Claude Code "auto mode" blocks the install

### Symptoms
You ask Claude Code (with **auto mode on** — the `shift+tab` auto-accept state)
to install the statusline, and instead of installing it stops and says the
action is blocked by auto-mode policy — both running the installer
(`-ExecutionPolicy Bypass` / `curl … | bash`) and writing the renderer to
`~/.claude` so it runs on every launch.

### Cause
This is **expected, correct safety behavior — not a bug.** The install fetches
third-party code from a remote repo and wires it to run automatically every time
Claude Code starts. Auto-accept mode silently approves tool calls, and silently
approving "download remote code and persist it as an always-on hook" is exactly
the kind of action that should require an explicit human decision. So the agent
declines to do it unattended.

### Fix — pick one
1. **Run it yourself with the `!` prefix (recommended, most transparent).** In
   the Claude Code prompt, prefix the command with `!` so it runs in your shell
   and the output comes back into the session — no agent auto-approval of remote
   execution involved:
   ```
   # macOS / Linux
   ! bash install.sh           # or: ! bash install.sh xl
   ```
   ```
   # Windows PowerShell
   ! irm https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.ps1 | iex
   ```
2. **Leave auto mode for the one install step.** Press `shift+tab` to cycle out
   of auto mode, let Claude run the installer with a normal one-time permission
   prompt, approve it, then re-enable auto mode.
3. **Pre-authorize the command.** Add an allow rule for the specific installer
   invocation to `~/.claude/settings.json` (or approve it once and choose
   "always allow"), then re-run.

Whichever you pick, the size question still applies — choose a size
(`xsmall`/`small`/`medium`/`large`/`xlarge`); the installer does not silently
assume one for you.
