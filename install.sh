#!/usr/bin/env bash
# ============================================================================
# Awesome CC Statusline — installer (macOS / Linux / Windows-GitBash)
# ----------------------------------------------------------------------------
# Usage:
#   ./install.sh                 # install (asks which preset)
#   ./install.sh l               # install by abbreviation
#   ./install.sh large-plain     # install by full name, without emoji
#   ./install.sh m-simple        # text-only style
#   ./install.sh large --mods    # Mods (beta): a band above the prompt that also
#                                # shows in the Claude desktop app
#
# Sizes (smallest -> largest):
#   xsmall (xs)   2 lines, minimal                  (xs-simple: 1 line)
#   small  (s)    2 lines, labels + bars
#   medium (m)    4 lines, wide context bar
#   large  (l)    5 lines, session time / resets  (recommended)
#   xlarge (xl)   6 lines, 40-block bars, full detail
# Styles (suffix):
#   (none)        emoji icons + gradient bars
#   -plain        same layout, no emoji (e.g. l-plain)
#   -simple       text only, no bars, no emoji (e.g. l-simple)
#   aliases: simple = small-simple, oneline = xsmall-simple
#
# What it does:
#   1. ensures `jq` is installed (auto-installs via the system package manager)
#   2. copies the renderer to ~/.claude/awesome-statusline.sh
#   3. sets settings.json -> statusLine.command (existing settings preserved,
#      a timestamped backup is made first)
#   With --mods (beta, macOS / Linux), instead of 3:
#   3. copies the mod to ~/.claude/awesome-statusline-mod/ and installs it with
#      `claude plugin install` (the preset is the mod's `preset` option)
#   4. removes an Awesome Statusline statusLine entry (backup first), so the
#      terminal doesn't show it twice
#
# Honors $CLAUDE_CONFIG_DIR (defaults to ~/.claude) so it is safe to test.
# ============================================================================
#
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
set -euo pipefail

# --- paths ------------------------------------------------------------------
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SETTINGS="$CLAUDE_DIR/settings.json"
DEST="$CLAUDE_DIR/awesome-statusline.sh"
# Resolve script dir safely. Under `curl ... | bash` the script arrives on
# stdin, so BASH_SOURCE is unset — with `set -u` that would crash here. Fall
# back to an empty SCRIPT_DIR, which routes us to the repo-download branch.
if [ -n "${BASH_SOURCE:-}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  SCRIPT_DIR=""
fi
SRC="$SCRIPT_DIR/scripts/awesome-statusline.sh"
REPO_RAW="${AWESOME_STATUSLINE_RAW:-https://raw.githubusercontent.com/awesomezun/claude-statusline/main}"
MOD_NAME="awesome-statusline-mod"
MOD_DIR="$CLAUDE_DIR/$MOD_NAME"
# The mod's files, relative to mods/awesome-statusline-mod/ in the repo.
MOD_FILES=".claude-plugin/plugin.json .claude-plugin/marketplace.json hooks/hooks.json hooks/register.tsx hooks/ansi.ts hooks/cockpit.tsx hooks/gauges.ts hooks/dash.ts hooks/cluster.ts hooks/sources.ts types/index.d.ts"

# --- output helpers ---------------------------------------------------------
err()  { printf '\033[31m%s\033[0m\n' "$*" >&2; }
ok()   { printf '\033[32m%s\033[0m\n' "$*"; }
info() { printf '\033[36m%s\033[0m\n' "$*"; }

# map abbreviation OR full name (optionally with -plain / -simple) -> canonical preset
normalize_mode() {
  local s style=""
  s="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$s" in
    *-plain)  style="-plain";  s="${s%-plain}" ;;
    *-simple) style="-simple"; s="${s%-simple}" ;;
  esac
  case "$s" in
    xs|xsmall)  echo "xsmall$style" ;;
    s|small)    echo "small$style"  ;;
    m|medium)   echo "medium$style" ;;
    l|large)    echo "large$style"  ;;
    xl|xlarge)  echo "xlarge$style" ;;
    simple)     echo "small-simple"  ;;   # alias
    oneline|one-line|1line) echo "xsmall-simple" ;;   # alias
    *) return 1 ;;
  esac
}

# --- dependency: jq (auto-install) ------------------------------------------
install_jq() {
  info "jq not found — attempting automatic install…"
  if   command -v brew    >/dev/null 2>&1; then brew install jq
  elif command -v apt-get >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y jq
  elif command -v dnf     >/dev/null 2>&1; then sudo dnf install -y jq
  elif command -v yum     >/dev/null 2>&1; then sudo yum install -y jq
  elif command -v pacman  >/dev/null 2>&1; then sudo pacman -S --noconfirm jq
  elif command -v zypper  >/dev/null 2>&1; then sudo zypper install -y jq
  elif command -v apk     >/dev/null 2>&1; then sudo apk add jq
  elif command -v winget  >/dev/null 2>&1; then winget install --silent --accept-package-agreements --accept-source-agreements jqlang.jq
  elif command -v scoop   >/dev/null 2>&1; then scoop install jq
  elif command -v choco   >/dev/null 2>&1; then choco install jq -y
  else
    err "No supported package manager found. Please install jq manually:"
    err "  https://jqlang.github.io/jq/download/"
    return 1
  fi
}

ensure_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    install_jq || exit 1
    command -v jq >/dev/null 2>&1 || { err "jq install did not succeed."; exit 1; }
    ok "jq installed."
  fi
}

# --- pick preset ------------------------------------------------------------
# Precedence: explicit argument > interactive prompt > 'large' default.
MODE="large"

# Korean locale? Show the prompt in Korean; otherwise default to English.
is_korean_locale() {
  case "${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}" in
    ko|ko_*|ko.*|ko-*) return 0 ;;
    *) return 1 ;;
  esac
}

# Ask the user which size and style to install (default large, emoji). Reads stdin.
prompt_size() {
  echo
  if is_korean_locale; then
    echo "statusline을 어떤 크기로 설치할까요? (예시는 github에서 확인)"
    echo "  예시: https://github.com/awesomezun/claude-statusline"
    echo
    echo "  1. xsmall (xs)   가장 작게 — 2줄, 핵심만"
    echo "  2. small  (s)    작게 — 2줄, 라벨과 막대"
    echo "  3. medium (m)    중간 — 4줄, 넓은 컨텍스트 막대"
    echo "  4. large  (l)    크게 — 5줄, 세션 시간·리셋 (추천 기본값)"
    echo "  5. xlarge (xl)   가장 크게 — 6줄, 전체 상세"
    echo
    printf '선택 [기본값: 4]: '
  else
    echo "Which size would you like to install? (see examples on GitHub)"
    echo "  Examples: https://github.com/awesomezun/claude-statusline"
    echo
    echo "  1. xsmall (xs)   smallest — 2 lines, essentials"
    echo "  2. small  (s)    small — 2 lines, labels + bars"
    echo "  3. medium (m)    medium — 4 lines, wide context bar"
    echo "  4. large  (l)    large — 5 lines, session time / resets (recommended)"
    echo "  5. xlarge (xl)   largest — 6 lines, full detail"
    echo
    printf 'Choice [default: 4]: '
  fi
  local answer=""
  read -r answer || answer=""
  case "$answer" in
    1)     MODE="xsmall" ;;
    2)     MODE="small"  ;;
    3)     MODE="medium" ;;
    4|"")  MODE="large"  ;;
    5)     MODE="xlarge" ;;
    *)
      # Allow typing a preset name/alias directly instead of a number.
      if ! MODE="$(normalize_mode "$answer")"; then
        if is_korean_locale; then
          echo "알 수 없는 입력 '$answer' — 'large'로 설치합니다."
        else
          echo "Unknown input '$answer', using 'large'."
        fi
        MODE="large"
      fi
      ;;
  esac

  # A typed name may already carry its style (l-plain, m-simple, simple, …).
  case "$MODE" in *-plain|*-simple) return ;; esac
  echo
  if is_korean_locale; then
    echo "어떤 스타일로 할까요?"
    echo "  1. 이모지 있음 — 아이콘과 그래디언트 막대 (기본값)"
    echo "  2. 이모지 없음 — 같은 배치, 아이콘 대신 글자"
    echo "  3. 심플 텍스트형 — 막대·이모지 없이 글자만"
    printf '선택 [기본값: 1]: '
  else
    echo "Which style?"
    echo "  1. With emoji — icons and gradient bars (default)"
    echo "  2. No emoji — same layout, text labels instead of icons"
    echo "  3. Simple text — text only, no bars or emoji"
    printf 'Choice [default: 1]: '
  fi
  local style=""
  read -r style || style=""
  case "$style" in
    2) MODE="$MODE-plain" ;;
    3) MODE="$MODE-simple" ;;
  esac
}

# Ask where it should show (default Statusline). Reads stdin.
prompt_display() {
  echo
  if is_korean_locale; then
    echo "어디에 표시할까요?"
    echo "  1. 상태줄 — 터미널 프롬프트 아래 (기본값)"
    echo "  2. Mods (베타) — 프롬프트 위 띠, Claude 데스크톱 앱에서도 보임"
    printf '선택 [기본값: 1]: '
  else
    echo "Where should it show?"
    echo "  1. Statusline — under the prompt, in the terminal (default)"
    echo "  2. Mods (beta) — a band above the prompt, also in the Claude desktop app"
    printf 'Choice [default: 1]: '
  fi
  local answer=""
  read -r answer || answer=""
  case "$answer" in
    2|m|mods|--mods) DISPLAY_MODE="mods" ;;
  esac
}

# Where it shows: statusline (default) or mods (--mods).
DISPLAY_MODE="statusline"
PRESET_ARG=""
DISPLAY_ARG=""
for arg in "$@"; do
  case "$arg" in
    --mods|mods)                DISPLAY_MODE="mods";       DISPLAY_ARG=1 ;;
    --statusline|statusline)    DISPLAY_MODE="statusline"; DISPLAY_ARG=1 ;;
    *)
      if [ -n "$PRESET_ARG" ]; then err "Unexpected argument: '$arg'"; exit 1; fi
      PRESET_ARG="$arg" ;;
  esac
done

ask() {
  if [ -z "$PRESET_ARG" ]; then prompt_size; fi
  if [ -z "$DISPLAY_ARG" ]; then prompt_display; fi
}

if [ -n "$PRESET_ARG" ] && ! MODE="$(normalize_mode "$PRESET_ARG")"; then
  err "Unknown preset: '$PRESET_ARG'"
  err "Valid: xsmall|xs  small|s  medium|m  large|l  xlarge|xl  — each optionally -plain or -simple (aliases: simple, oneline)"
  exit 1
fi
if [ -n "$PRESET_ARG" ] && [ -n "$DISPLAY_ARG" ]; then
  :   # everything given: never prompt
elif [ -n "$PRESET_ARG" ]; then
  :   # a preset alone keeps the old one-argument behaviour: Statusline
elif [ -t 0 ]; then
  # Normal `./install.sh` / `bash install.sh` — stdin is the terminal.
  ask
elif { exec 3</dev/tty; } 2>/dev/null; then
  # Piped install (`curl ... | bash`): the script body is on stdin, but a
  # controlling terminal still exists — prompt through /dev/tty.
  ask <&3
  exec 3<&-
fi
# Truly non-interactive (CI, Claude Code, redirected stdin with no tty): no
# branch prompts, so MODE stays 'large' (Statusline) and the install never blocks.

if [ "$DISPLAY_MODE" = "mods" ]; then
  case "$(uname -s 2>/dev/null)" in
    MINGW*|MSYS*|CYGWIN*)
      err "Mods is macOS / Linux only for now. On Windows install the statusline: ./install.ps1 $MODE"
      exit 1 ;;
  esac
fi

# --- run --------------------------------------------------------------------
ensure_jq
mkdir -p "$CLAUDE_DIR"

if [ -n "$SCRIPT_DIR" ] && [ -f "$SRC" ]; then
  cp "$SRC" "$DEST"
else
  info "Local scripts/ not found, downloading the renderer from repo…"
  curl -fsSL "$REPO_RAW/scripts/awesome-statusline.sh" -o "$DEST" \
    || { err "Download failed. Check network or \$AWESOME_STATUSLINE_RAW."; exit 1; }
fi
chmod +x "$DEST"

# --- Mods (beta): the same renderer, drawn by a Claude Code mod ----------------
# Finds the claude CLI: PATH first, then where its installers put it.
find_claude() {
  if command -v claude >/dev/null 2>&1; then command -v claude; return 0; fi
  local c
  for c in "$HOME/.local/bin/claude" "$HOME/.claude/local/claude" /opt/homebrew/bin/claude /usr/local/bin/claude; do
    if [ -x "$c" ]; then echo "$c"; return 0; fi
  done
  return 1
}

install_mods() {
  local claude_bin staged f terminal_opt
  if ! claude_bin="$(find_claude)"; then
    err "Mods needs the claude CLI (Claude Code) on this machine, and it was not found."
    err "Install Claude Code (https://claude.com/claude-code), or use the statusline: bash install.sh $MODE"
    exit 1
  fi

  # Stage the mod and swap it in whole, so a failed download leaves the old one.
  staged="$MOD_DIR.new"
  rm -rf "$staged"
  for f in $MOD_FILES; do
    mkdir -p "$staged/$(dirname "$f")"
    if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/mods/$MOD_NAME/$f" ]; then
      cp "$SCRIPT_DIR/mods/$MOD_NAME/$f" "$staged/$f"
    else
      curl -fsSL "$REPO_RAW/mods/$MOD_NAME/$f" -o "$staged/$f" \
        || { err "Download failed: mods/$MOD_NAME/$f"; rm -rf "$staged"; exit 1; }
    fi
  done
  # The renderer travels with the mod, so the mod runs the version it was made for.
  cp "$DEST" "$staged/awesome-statusline.sh"
  rm -rf "$MOD_DIR"
  mv "$staged" "$MOD_DIR"

  # Keep a `terminal` option the person already set; default auto.
  terminal_opt="auto"
  if [ -f "$SETTINGS" ]; then
    terminal_opt="$(jq -r --arg k "$MOD_NAME@awesome-statusline-local" '.pluginConfigs[$k].options.terminal // "auto"' "$SETTINGS" 2>/dev/null || echo auto)"
  fi

  # Installing again only updates the options: the mod is read from $MOD_DIR in place.
  "$claude_bin" plugin install "$MOD_NAME" --marketplace "$MOD_DIR" \
      --config "preset=$MODE" --config "terminal=$terminal_opt" \
    || { err "claude plugin install failed. Run it yourself to see why:"; \
         err "  claude plugin install $MOD_NAME --marketplace $MOD_DIR --config preset=$MODE"; exit 1; }

  # An Awesome Statusline statusLine would show the same lines a second time in
  # the terminal: remove it (backup first). Any other statusLine is left alone;
  # the band then stays hidden in the terminal while it is set (option `terminal`).
  if [ -f "$SETTINGS" ] && jq -e '(.statusLine.command // "") | test("awesome-statusline")' "$SETTINGS" >/dev/null 2>&1; then
    BACKUP="$SETTINGS.backup-$(date +%Y%m%d-%H%M%S)"
    cp "$SETTINGS" "$BACKUP"
    jq 'del(.statusLine)' "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"
    info "Removed the Awesome Statusline statusLine (the mod shows it now). Backup: $BACKUP"
  elif [ -f "$SETTINGS" ] && jq -e '(.statusLine.command // "") != ""' "$SETTINGS" >/dev/null 2>&1; then
    info "Another statusLine is set: the terminal keeps it and the band shows in the desktop app."
    info "  To show the band in the terminal too: /plugin configure $MOD_NAME@awesome-statusline-local (terminal: show)"
  fi
}

# Invoke via `bash <script>` (not the bare path) so the statusline runs
# identically on every platform. On Windows a bare `.sh` path is opened through
# its file association (`bash --login -i ...`), which spawns visible terminal
# windows and breaks stdin/stdout — calling bash explicitly avoids that.
STATUSLINE_JSON="$(jq -n --arg c "bash ~/.claude/awesome-statusline.sh $MODE" '{type:"command",command:$c}')"
if [ "$DISPLAY_MODE" = "mods" ]; then
  install_mods
elif [ -f "$SETTINGS" ]; then
  BACKUP="$SETTINGS.backup-$(date +%Y%m%d-%H%M%S)"
  cp "$SETTINGS" "$BACKUP"
  jq --argjson sl "$STATUSLINE_JSON" '.statusLine = $sl' "$SETTINGS" > "$SETTINGS.tmp" \
    && mv "$SETTINGS.tmp" "$SETTINGS"
  info "Existing settings backed up to: $BACKUP"
else
  jq -n --argjson sl "$STATUSLINE_JSON" '{statusLine: $sl}' > "$SETTINGS"
fi

# --- tmux: keep 24-bit colour ------------------------------------------------
# Inside tmux, Claude Code downgrades every colour to 256 unless
# CLAUDE_CODE_TMUX_TRUECOLOR is set, which turns the gradient bars into uneven
# bands. If this tmux passes 24-bit colour (RGB) through, switch it on (it takes
# effect in new Claude Code sessions); otherwise the statusline falls back to
# its own 256-colour palette and we print how to enable RGB in tmux.
if [ -n "${TMUX:-}" ] && command -v tmux >/dev/null 2>&1; then
  if tmux display -p '#{client_termfeatures}' 2>/dev/null | grep -q 'RGB'; then
    jq '.env = ((.env // {}) + {"CLAUDE_CODE_TMUX_TRUECOLOR": "1"})' "$SETTINGS" > "$SETTINGS.tmp" \
      && mv "$SETTINGS.tmp" "$SETTINGS"
    info "tmux with 24-bit colour detected: set env.CLAUDE_CODE_TMUX_TRUECOLOR=1 so gradients stay smooth."
  else
    info "tmux without 24-bit colour detected: the statusline uses its 256-colour palette."
    info "  For smooth gradients add to ~/.tmux.conf:  set -as terminal-features ',xterm*:RGB'"
  fi
fi

if [ "$DISPLAY_MODE" = "mods" ]; then
  ok "Installed Awesome Statusline as a mod (preset: $MODE)"
  echo "  mod:      $MOD_DIR"
  echo "  plugin:   $MOD_NAME@awesome-statusline-local (user scope)"
  echo
  echo "Start a new Claude Code session (terminal, or the desktop app's Code tab):"
  echo "the band shows above the prompt."
else
  ok "Installed Awesome CC Statusline (preset: $MODE)"
  echo "  script:   $DEST"
  echo "  settings: $SETTINGS  (statusLine set)"
  echo
  echo "Restart Claude Code (or reload) to see it."
fi
echo "To switch preset later, just ask your AI agent to reinstall with the one you want."
echo
echo "⭐ If you like Awesome Statusline, a GitHub star really helps:"
echo "   https://github.com/awesomezun/claude-statusline"
