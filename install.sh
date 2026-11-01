#!/usr/bin/env bash
# ============================================================================
# Awesome CC Statusline — installer (macOS / Linux / Windows-GitBash)
# ----------------------------------------------------------------------------
# Usage:
#   ./install.sh                 # install (asks which preset)
#   ./install.sh l               # install by abbreviation
#   ./install.sh large-plain     # install by full name, without emoji
#   ./install.sh m-simple        # text-only style
#
# Sizes (smallest -> largest):
#   xsmall (xs)   2 lines, minimal                  (xs-simple: 1 line)
#   small  (s)    2 lines, labels + bars
#   medium (m)    4 lines, wide context bar
#   large  (l)    5 lines, cost / time / resets   (recommended)
#   xlarge (xl)   5 lines, 40-block bars, full detail
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
#    / oneline (= xsmall-simple) — use it and skip the questions. A bare size
#    means the emoji style unless the user asked for no emoji or text only.
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
#      4. small / xsmall — the two smallest, pick this to choose between them
#                                                       / 작은 두 가지 (고르면 한 번 더 선택)
#    Question B (style) — text:
#      EN: Which style would you like?
#      KO: 어떤 스타일로 할까요?
#    Three options, in this order:
#      1. With emoji (Recommended) / 이모지 있음 (추천) — icons + gradient bars
#      2. No emoji / 이모지 없음 — same layout and bars, text labels instead of icons
#      3. Simple text / 심플 텍스트형 — text only, no bars or emoji
#    Step 2 — ONLY if the user picked option 4 in Question A, ask again:
#      EN: Which of the two smaller sizes?   KO: 작은 쪽 중 무엇으로 설치할까요?
#      1. small  (s)  — space-saving, key info           / 공간 절약, 주요 정보
#      2. xsmall (xs) — smallest, essentials only        / 가장 작게, 핵심만
#    Resolve the preset: the size, plus -plain for "No emoji" or -simple for
#    "Simple text" (e.g. large-plain, xsmall-simple).
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
    echo "  4. large  (l)    크게 — 5줄, 비용·시간·리셋 (추천 기본값)"
    echo "  5. xlarge (xl)   가장 크게 — 5줄, 전체 상세"
    echo
    printf '선택 [기본값: 4]: '
  else
    echo "Which size would you like to install? (see examples on GitHub)"
    echo "  Examples: https://github.com/awesomezun/claude-statusline"
    echo
    echo "  1. xsmall (xs)   smallest — 2 lines, essentials"
    echo "  2. small  (s)    small — 2 lines, labels + bars"
    echo "  3. medium (m)    medium — 4 lines, wide context bar"
    echo "  4. large  (l)    large — 5 lines, cost / time / resets (recommended)"
    echo "  5. xlarge (xl)   largest — 5 lines, full detail"
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

if [ "$#" -ge 1 ]; then
  if ! MODE="$(normalize_mode "$1")"; then
    err "Unknown preset: '$1'"
    err "Valid: xsmall|xs  small|s  medium|m  large|l  xlarge|xl  — each optionally -plain or -simple (aliases: simple, oneline)"
    exit 1
  fi
elif [ -t 0 ]; then
  # Normal `./install.sh` / `bash install.sh` — stdin is the terminal.
  prompt_size
elif { exec 3</dev/tty; } 2>/dev/null; then
  # Piped install (`curl ... | bash`): the script body is on stdin, but a
  # controlling terminal still exists — prompt through /dev/tty.
  prompt_size <&3
  exec 3<&-
fi
# Truly non-interactive (CI, Claude Code, redirected stdin with no tty): neither
# branch runs, so MODE stays 'large' and the install never blocks.

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

# Invoke via `bash <script>` (not the bare path) so the statusline runs
# identically on every platform. On Windows a bare `.sh` path is opened through
# its file association (`bash --login -i ...`), which spawns visible terminal
# windows and breaks stdin/stdout — calling bash explicitly avoids that.
STATUSLINE_JSON="$(jq -n --arg c "bash ~/.claude/awesome-statusline.sh $MODE" '{type:"command",command:$c}')"
if [ -f "$SETTINGS" ]; then
  BACKUP="$SETTINGS.backup-$(date +%Y%m%d-%H%M%S)"
  cp "$SETTINGS" "$BACKUP"
  jq --argjson sl "$STATUSLINE_JSON" '.statusLine = $sl' "$SETTINGS" > "$SETTINGS.tmp" \
    && mv "$SETTINGS.tmp" "$SETTINGS"
  info "Existing settings backed up to: $BACKUP"
else
  jq -n --argjson sl "$STATUSLINE_JSON" '{statusLine: $sl}' > "$SETTINGS"
fi

ok "Installed Awesome CC Statusline (preset: $MODE)"
echo "  script:   $DEST"
echo "  settings: $SETTINGS  (statusLine set)"
echo
echo "Restart Claude Code (or reload) to see it."
echo "To switch preset later, just ask your AI agent to reinstall with the one you want."
echo
echo "⭐ If you like Awesome Statusline, a GitHub star really helps:"
echo "   https://github.com/awesomezun/claude-statusline"
