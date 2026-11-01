#!/bin/bash
# ============================================================================
# Claude Code Simple Statusline (4-line) - Catppuccin Edition
# ============================================================================
# Line 1: Model | Git Status | Conda Env | 🎨 Output Style
# Line 2: 📂 Directory Path + 🌿(Branch)
# Line 3: 📝 Context Window (progress bar with gradient)
# Line 4: 🚀 5H + 7D Usage (progress bars with gradient)
# ============================================================================
# v1.0.3 - Updated from v1.0.2
# ============================================================================

# Ensure a bundled jq (copied next to this script by the installer) is found,
# even when Claude Code launches the statusline with a minimal PATH — common on
# Windows / GUI launches where a winget-installed jq is not on PATH yet.
export PATH="$(dirname "$0"):$PATH"
# printf "%.0f" must parse "23.5" the same way on every locale (de_DE etc.).
export LC_NUMERIC=C

input=$(cat)

# Parse JSON input
MODEL=$(echo "$input" | jq -r '.model.display_name // "Unknown"')
CURRENT_DIR=$(echo "$input" | jq -r '.workspace.current_dir // "."')
CONTEXT_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')
CURRENT_USAGE=$(echo "$input" | jq -r '.context_window.current_usage // null')
OUTPUT_STYLE=$(echo "$input" | jq -r '.output_style.name // ""')

# Rate limits (official statusline JSON - claude.ai Pro / Max / Ultra).
# Each window is optional on its own: Ultra has no 5-hour limit (weekly only),
# and Claude Code drops a window once its resets_at passes. So render only the
# windows that are present, and show "loading.." only while rate_limits is
# missing altogether (before the first API response of the session).
HAS_RATE_LIMITS=$(echo "$input" | jq -r 'if (.rate_limits | type) == "object" and (.rate_limits | length) > 0 then "1" else empty end')
FIVE_HOUR_PCT=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty | tonumber? // empty')
FIVE_HOUR_RESET=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty | tonumber? // fromdateiso8601? // empty | floor')
SEVEN_DAY_PCT=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty | tonumber? // empty')
SEVEN_DAY_RESET=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty | tonumber? // fromdateiso8601? // empty | floor')

# ============================================================================
# Colors (variables instead of functions to avoid newline issues)
# ============================================================================
RESET="\033[0m"
BOLD="\033[1m"
DIM="\033[2m"
CLR="\033[K"  # Clear to end of line

# Catppuccin Mocha palette
C_PINK="\033[38;2;245;194;231m"
C_GREEN="\033[38;2;166;227;161m"
C_YELLOW="\033[38;2;249;226;175m"
C_PEACH="\033[38;2;250;179;135m"
C_RED="\033[38;2;243;139;168m"
C_MAROON="\033[38;2;235;160;172m"
C_TEAL="\033[38;2;148;226;213m"
C_SKY="\033[38;2;137;220;235m"
C_BLUE="\033[38;2;137;180;250m"
C_LAVENDER="\033[38;2;180;190;254m"
C_TEXT="\033[38;2;205;214;244m"
C_SUBTEXT="\033[38;2;166;173;200m"
C_OVERLAY="\033[38;2;108;112;134m"

# ============================================================================
# Gradient functions for progress bars
# ============================================================================

# Context gradient: Latte Yellow(0%) → Latte Red(50%) → Mauve(100%)
get_context_gradient_color() {
    local pct=$1
    local r g b

    if [[ $pct -lt 50 ]]; then
        # Latte Yellow (#df8e1d) → Latte Red (#d20f39)
        local t=$((pct * 2))
        r=$((223 + (210 - 223) * t / 100))
        g=$((142 + (15 - 142) * t / 100))
        b=$((29 + (57 - 29) * t / 100))
    else
        # Latte Red (#d20f39) → Mauve (#8839ef)
        local t=$(((pct - 50) * 2))
        r=$((210 + (136 - 210) * t / 100))
        g=$((15 + (57 - 15) * t / 100))
        b=$((57 + (239 - 57) * t / 100))
    fi

    echo "$r;$g;$b"
}

# Usage gradient: Mocha Green (#a6e3a1) → Latte Teal (#179299) → Latte Blue (#1e66f5)
get_usage_gradient_color() {
    local pct=$1
    local r g b

    if [[ $pct -lt 50 ]]; then
        # Mocha Green (#a6e3a1) → Latte Teal (#179299)
        local t=$((pct * 2))
        r=$((166 + (23 - 166) * t / 100))
        g=$((227 + (146 - 227) * t / 100))
        b=$((161 + (153 - 161) * t / 100))
    else
        # Latte Teal (#179299) → Latte Blue (#1e66f5)
        local t=$(((pct - 50) * 2))
        r=$((23 + (30 - 23) * t / 100))
        g=$((146 + (102 - 146) * t / 100))
        b=$((153 + (245 - 153) * t / 100))
    fi

    echo "$r;$g;$b"
}

# ============================================================================
# Progress bar generator with gradient
# ============================================================================
generate_progress_bar() {
    local pct=$1
    local width=$2
    local gradient_type=$3
    local bar=""

    local filled=$(( (pct * width + 50) / 100 ))
    [[ $filled -gt $width ]] && filled=$width

    # Get the color at the current percentage (for empty blocks and text)
    local end_color
    if [[ "$gradient_type" == "context" ]]; then
        end_color=$(get_context_gradient_color "$pct")
    else
        end_color=$(get_usage_gradient_color "$pct")
    fi

    # Build filled portion with gradient
    for ((i=0; i<filled; i++)); do
        local block_pct=$((i * 100 / width))
        local color
        if [[ "$gradient_type" == "context" ]]; then
            color=$(get_context_gradient_color "$block_pct")
        else
            color=$(get_usage_gradient_color "$block_pct")
        fi
        bar+="\033[38;2;${color}m█"
    done

    # Build empty portion (use the end color - same as last filled block)
    local empty=$((width - filled))
    for ((i=0; i<empty; i++)); do
        bar+="\033[38;2;${end_color}m░"
    done

    bar+="$RESET"
    printf "%b" "$bar"
}

# ============================================================================
# LINE 1: Model | Git Status | Conda Env
# ============================================================================

# Model with emoji - Opus gets Catppuccin Pink
case "$MODEL" in
    *Opus*) MODEL_DISPLAY="🧠 ${C_PINK}${MODEL}${RESET}" ;;
    *Sonnet*) MODEL_DISPLAY="🎵 ${C_LAVENDER}${MODEL}${RESET}" ;;
    *Haiku*) MODEL_DISPLAY="⚡️ ${C_SKY}${MODEL}${RESET}" ;;
    *) MODEL_DISPLAY="🤖 ${C_TEXT}${MODEL}${RESET}" ;;
esac

# Reasoning effort + extended thinking (effort.level: low|medium|high|xhigh|max; absent if model lacks effort param)
EFFORT=$(echo "$input" | jq -r '.effort.level // empty')
THINKING=$(echo "$input" | jq -r '.thinking.enabled // empty')
[ -n "$EFFORT" ] && MODEL_DISPLAY="${MODEL_DISPLAY} \033[38;2;250;179;135m⚡${EFFORT}${RESET}"
[ "$THINKING" = "true" ] && MODEL_DISPLAY="${MODEL_DISPLAY} \033[38;2;249;226;175m💡${RESET}"

# Git status
GIT_STATUS=""
cd "$CURRENT_DIR" 2>/dev/null
if git rev-parse --git-dir > /dev/null 2>&1; then
    if git diff --quiet && git diff --cached --quiet 2>/dev/null; then
        GIT_STATUS="${C_GREEN}✅ clean${RESET}"
    else
        GIT_STATUS="${C_PEACH}🚧 dirty${RESET}"
    fi
else
    GIT_STATUS="${C_OVERLAY}no git${RESET}"
fi

# Conda environment
CONDA_ENV=""
if [[ -n "$CONDA_DEFAULT_ENV" ]]; then
    CONDA_ENV="${C_YELLOW}🐍 $CONDA_DEFAULT_ENV${RESET}"
else
    CONDA_ENV="${C_OVERLAY}no conda${RESET}"
fi

# Output style
OUTPUT_STYLE_DISPLAY=""
if [[ -n "$OUTPUT_STYLE" ]]; then
    OUTPUT_STYLE_DISPLAY=" │ 🎨 ${C_LAVENDER}${OUTPUT_STYLE}${RESET}"
fi

LINE1="${BOLD}${MODEL_DISPLAY}${RESET} │ ${GIT_STATUS} │ ${CONDA_ENV}${OUTPUT_STYLE_DISPLAY}"

# ============================================================================
# LINE 2: 🌿 Git Branch + Directory Path
# ============================================================================

# Directory path
DIR_DISPLAY="📂 ${C_BLUE}${CURRENT_DIR}${RESET}"

# Git branch with 🌿 emoji (darker green)
GIT_BRANCH_DISPLAY=""
cd "$CURRENT_DIR" 2>/dev/null
if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null)
    if [[ -n "$BRANCH" ]]; then
        # Darker green: #40a02b (Catppuccin Latte green, more saturated)
        GIT_BRANCH_DISPLAY=" \033[38;2;64;160;43m🌿(${BRANCH})${RESET}"
    fi
fi

LINE2="${DIR_DISPLAY}${GIT_BRANCH_DISPLAY}"

# ============================================================================
# LINE 3: 🚀 Context Window with Progress Bar
# ============================================================================

CONTEXT_PERCENT=0
if [[ "$CURRENT_USAGE" != "null" && -n "$CURRENT_USAGE" ]]; then
    INPUT_TOKENS=$(echo "$CURRENT_USAGE" | jq -r '.input_tokens // 0')
    CACHE_CREATE=$(echo "$CURRENT_USAGE" | jq -r '.cache_creation_input_tokens // 0')
    CACHE_READ=$(echo "$CURRENT_USAGE" | jq -r '.cache_read_input_tokens // 0')
    CURRENT_TOKENS=$((INPUT_TOKENS + CACHE_CREATE + CACHE_READ))

    # harness sometimes reports a stale 200k window even when the model is
    # actually running the 1m context beta (seen on opus and fable alike) --
    # usage exceeding the declared window is proof the declared size is wrong
    [[ "$CURRENT_TOKENS" -gt "$CONTEXT_SIZE" ]] && CONTEXT_SIZE=1000000

    if [[ "$CONTEXT_SIZE" -gt 0 ]]; then
        CONTEXT_PERCENT=$((CURRENT_TOKENS * 100 / CONTEXT_SIZE))
    fi
fi

# Get end color for text
CTX_END_COLOR=$(get_context_gradient_color "$CONTEXT_PERCENT")
CTX_BAR=$(generate_progress_bar "$CONTEXT_PERCENT" 40 "context")

LINE3="📝 \033[38;2;${CTX_END_COLOR}mContext${RESET} ${CTX_BAR} \033[38;2;${CTX_END_COLOR}m${CONTEXT_PERCENT}% used${RESET}"

# ============================================================================
# LINE 4: ⏰ Usage Limits (5H + 7D) with Progress Bars
# ============================================================================

# Format 5H reset as "Xh Xm"
format_time_remaining() {
    local reset_epoch="$1"
    [[ -z "$reset_epoch" || "$reset_epoch" == "null" ]] && return
    local now_epoch=$(date +%s)
    local remaining=$((reset_epoch - now_epoch))
    [[ $remaining -lt 0 ]] && remaining=0
    local hours=$((remaining / 3600))
    local minutes=$(((remaining % 3600) / 60))
    echo "${hours}h${minutes}m"
}

# Cross-platform date formatting (BSD/macOS vs GNU/Linux)
_date_fmt() {
    local epoch="$1" fmt="$2"
    local out=""
    out=$(date -j -f "%s" "$epoch" "+$fmt" 2>/dev/null) && [[ -n "$out" ]] && { echo "$out"; return; }
    out=$(date -r "$epoch" "+$fmt" 2>/dev/null) && [[ -n "$out" ]] && { echo "$out"; return; }
    date -d "@$epoch" "+$fmt" 2>/dev/null
}

# Format 7D reset as "Mon"
format_reset() {
    local reset_epoch="$1"
    [[ -z "$reset_epoch" || "$reset_epoch" == "null" ]] && return
    _date_fmt "$reset_epoch" "%a"
}

# Percent as an integer clamped to 0-100 (the API may send 23.5)
clamp_pct() {
    local p
    p=$(printf "%.0f" "$1" 2>/dev/null) || p=0
    [[ $p -lt 0 ]] && p=0
    [[ $p -gt 100 ]] && p=100
    echo "$p"
}

# Build Line 4 from rate_limits — only the windows that are present.
# The first segment carries the "Usage" label ("Usage 5H …" or, on Ultra,
# which has no 5-hour limit, "Usage 7D …").
LINE4=""
if [[ -n "$HAS_RATE_LIMITS" ]]; then
    SEGMENTS=""
    if [[ -n "$FIVE_HOUR_PCT" ]]; then
        FIVE_HOUR=$(clamp_pct "$FIVE_HOUR_PCT")
        FIVE_RESET_FMT=$(format_time_remaining "$FIVE_HOUR_RESET")
        FIVE_BAR=$(generate_progress_bar "$FIVE_HOUR" 10 "usage")
        FIVE_END_COLOR=$(get_usage_gradient_color "$FIVE_HOUR")
        SEGMENTS="\033[38;2;${FIVE_END_COLOR}mUsage 5H${RESET} ${FIVE_BAR} \033[38;2;${FIVE_END_COLOR}m${FIVE_HOUR}%${RESET}"
        [[ -n "$FIVE_RESET_FMT" ]] && SEGMENTS+=" ${C_OVERLAY}(${FIVE_RESET_FMT})${RESET}"
    fi
    if [[ -n "$SEVEN_DAY_PCT" ]]; then
        SEVEN_DAY=$(clamp_pct "$SEVEN_DAY_PCT")
        SEVEN_RESET_FMT=$(format_reset "$SEVEN_DAY_RESET")
        SEVEN_BAR=$(generate_progress_bar "$SEVEN_DAY" 10 "usage")
        SEVEN_END_COLOR=$(get_usage_gradient_color "$SEVEN_DAY")
        if [[ -n "$SEGMENTS" ]]; then
            SEGMENTS+=" │ \033[38;2;${SEVEN_END_COLOR}m7D${RESET}"
        else
            SEGMENTS="\033[38;2;${SEVEN_END_COLOR}mUsage 7D${RESET}"
        fi
        SEGMENTS+=" ${SEVEN_BAR} \033[38;2;${SEVEN_END_COLOR}m${SEVEN_DAY}%${RESET}"
        [[ -n "$SEVEN_RESET_FMT" ]] && SEGMENTS+=" ${C_OVERLAY}(${SEVEN_RESET_FMT})${RESET}"
    fi
    [[ -n "$SEGMENTS" ]] && LINE4="🚀 ${SEGMENTS}"
else
    LINE4="${C_OVERLAY}🚀 Usage: unavailable${RESET}"
fi

# ============================================================================
# OUTPUT (using printf with line clear)
# ============================================================================
printf "%b%b\n" "$LINE1" "$CLR"
printf "%b%b\n" "$LINE2" "$CLR"
printf "%b%b\n" "$LINE3" "$CLR"
[[ -n "$LINE4" ]] && printf "%b%b\n" "$LINE4" "$CLR"
