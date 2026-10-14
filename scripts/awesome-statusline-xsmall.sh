#!/bin/bash
# ============================================================================
# Awesome Statusline - COMPACT (Short) Mode
# ============================================================================
# Line 1: 🤖Model 📂path 🌿(branch)✅
# Line 2: 🧠bar 5Hbar 7Dbar
# ============================================================================
# v2.1.1 - Updated from v2.1.0
# ============================================================================

# Ensure a bundled jq (copied next to this script by the installer) is found,
# even when Claude Code launches the statusline with a minimal PATH — common on
# Windows / GUI launches where a winget-installed jq is not on PATH yet.
export PATH="$(dirname "$0"):$PATH"

input=$(cat)

# Parse JSON input
MODEL=$(echo "$input" | jq -r '.model.display_name // "Unknown"')
CURRENT_DIR=$(echo "$input" | jq -r '.workspace.current_dir // "."')
CONTEXT_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')
CURRENT_USAGE=$(echo "$input" | jq -r '.context_window.current_usage // null')

# Rate limits (official API - available for Pro/Max subscribers)
FIVE_HOUR_PCT=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
SEVEN_DAY_PCT=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')

# ============================================================================
# Colors (variables instead of functions to avoid newline issues)
# ============================================================================
RESET="\033[0m"
BOLD="\033[1m"
CLR="\033[K"  # Clear to end of line

C_TEAL="\033[38;2;148;226;213m"
C_GREEN="\033[38;2;166;227;161m"
C_SUBTEXT="\033[38;2;166;173;200m"
C_LAVENDER="\033[38;2;180;190;254m"
C_YELLOW="\033[38;2;249;226;175m"
C_OVERLAY="\033[38;2;108;112;134m"
C_LATTE_GREEN="\033[38;2;64;160;43m"
C_LATTE_RED="\033[38;2;210;15;57m"
C_LATTE_YELLOW="\033[38;2;223;142;29m"

# ============================================================================
# Gradient Functions
# ============================================================================
get_context_gradient_color() {
    local pct=$1
    local r g b
    if [[ $pct -lt 30 ]]; then
        local t=$((pct * 100 / 30))
        r=$((245 + (230 - 245) * t / 100))
        g=$((194 + (69 - 194) * t / 100))
        b=$((231 + (83 - 231) * t / 100))
    elif [[ $pct -lt 70 ]]; then
        local t=$(((pct - 30) * 100 / 40))
        r=$((230 + (210 - 230) * t / 100))
        g=$((69 + (15 - 69) * t / 100))
        b=$((83 + (57 - 83) * t / 100))
    else
        r=210; g=15; b=57
    fi
    echo "$r;$g;$b"
}

get_usage_gradient_color() {
    local pct=$1
    local r g b
    if [[ $pct -lt 50 ]]; then
        local t=$((pct * 2))
        r=$((180 + (30 - 180) * t / 100))
        g=$((190 + (102 - 190) * t / 100))
        b=$((254 + (245 - 254) * t / 100))
    else
        local t=$(((pct - 50) * 2))
        r=$((30 + (210 - 30) * t / 100))
        g=$((102 + (15 - 102) * t / 100))
        b=$((245 + (57 - 245) * t / 100))
    fi
    echo "$r;$g;$b"
}

get_usage_7d_gradient_color() {
    local pct=$1
    local r g b
    if [[ $pct -lt 50 ]]; then
        local t=$((pct * 2))
        r=$((249 + (254 - 249) * t / 100))
        g=$((226 + (100 - 226) * t / 100))
        b=$((175 + (11 - 175) * t / 100))
    else
        local t=$(((pct - 50) * 2))
        r=$((254 + (210 - 254) * t / 100))
        g=$((100 + (15 - 100) * t / 100))
        b=$((11 + (57 - 11) * t / 100))
    fi
    echo "$r;$g;$b"
}

generate_bar() {
    local pct=$1
    local width=$2
    local type=$3
    local bar=""
    local filled=$(( (pct * width + 50) / 100 ))
    [[ $filled -gt $width ]] && filled=$width

    local end_color
    case "$type" in
        context) end_color=$(get_context_gradient_color "$pct") ;;
        7d) end_color=$(get_usage_7d_gradient_color "$pct") ;;
        *) end_color=$(get_usage_gradient_color "$pct") ;;
    esac

    for ((i=0; i<filled; i++)); do
        local block_pct=$((i * 100 / width))
        local color
        case "$type" in
            context) color=$(get_context_gradient_color "$block_pct") ;;
            7d) color=$(get_usage_7d_gradient_color "$block_pct") ;;
            *) color=$(get_usage_gradient_color "$block_pct") ;;
        esac
        bar+="\033[38;2;${color}m█"
    done

    for ((i=0; i<width-filled; i++)); do
        bar+="\033[38;2;${end_color}m░"
    done

    printf "%b%b" "$bar" "$RESET"
}

# ============================================================================
# Line 1: Model + Directory + Git
# ============================================================================

# Model (short name, bold)
SHORT_MODEL=$(echo "$MODEL" | sed 's/Claude //; s/ [0-9.]*//')
MODEL_DISPLAY="🤖 ${BOLD}${C_TEAL}${SHORT_MODEL}${RESET}"

# Reasoning effort + extended thinking (effort.level: low|medium|high|xhigh|max; absent if model lacks effort param)
EFFORT=$(echo "$input" | jq -r '.effort.level // empty')
THINKING=$(echo "$input" | jq -r '.thinking.enabled // empty')
[ -n "$EFFORT" ] && MODEL_DISPLAY="${MODEL_DISPLAY} \033[38;2;250;179;135m⚡${EFFORT}${RESET}"
[ "$THINKING" = "true" ] && MODEL_DISPLAY="${MODEL_DISPLAY} \033[38;2;249;226;175m💡${RESET}"

# Directory (shorten $HOME to ~). Built with a case match rather than
# ${CURRENT_DIR/$HOME_DIR/~}: bash 5.2+ tilde-expands the replacement, turning ~
# back into $HOME and silently disabling the shortening.
HOME_DIR="${HOME:-/Users/$USER}"
case "$CURRENT_DIR" in
    "$HOME_DIR")    DIR_PATH="~" ;;
    "$HOME_DIR"/*)  DIR_PATH="~${CURRENT_DIR#$HOME_DIR}" ;;
    *)              DIR_PATH="$CURRENT_DIR" ;;
esac
DIR_DISPLAY="📂${C_SUBTEXT}${DIR_PATH}${RESET}"

# Git
GIT_DISPLAY=""
cd "$CURRENT_DIR" 2>/dev/null
if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null)
    [[ -n "$BRANCH" ]] && GIT_DISPLAY="${C_LATTE_GREEN}🌿(${BRANCH})${RESET}"

    STAGED=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
    UNSTAGED=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
    UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$STAGED" -eq 0 && "$UNSTAGED" -eq 0 && "$UNTRACKED" -eq 0 ]]; then
        GIT_DISPLAY="${GIT_DISPLAY}${C_GREEN}✅${RESET}"
    else
        STATUS=""
        [[ "$STAGED" -gt 0 ]] && STATUS="${STATUS}+"
        [[ "$UNSTAGED" -gt 0 ]] && STATUS="${STATUS}!"
        [[ "$UNTRACKED" -gt 0 ]] && STATUS="${STATUS}?"
        GIT_DISPLAY="${GIT_DISPLAY}${C_LATTE_YELLOW}📝${STATUS}${RESET}"
    fi
fi

LINE1="${MODEL_DISPLAY} ${DIR_DISPLAY} ${GIT_DISPLAY}"

# ============================================================================
# Line 2: Progress Bars Only
# ============================================================================

# Context
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

    [[ "$CONTEXT_SIZE" -gt 0 ]] && CONTEXT_PERCENT=$((CURRENT_TOKENS * 100 / CONTEXT_SIZE))
fi

CTX_BAR=$(generate_bar "$CONTEXT_PERCENT" 10 "context")

# Usage from rate_limits
if [[ -n "$FIVE_HOUR_PCT" ]]; then
    FIVE_HOUR=$(printf "%.0f" "$FIVE_HOUR_PCT")
    SEVEN_DAY=$(printf "%.0f" "${SEVEN_DAY_PCT:-0}")

    FIVE_BAR=$(generate_bar "$FIVE_HOUR" 10 "5h")
    SEVEN_BAR=$(generate_bar "$SEVEN_DAY" 10 "7d")

    LINE2="🧠 ${CTX_BAR} ${C_LAVENDER}5H${RESET}${FIVE_BAR} ${C_YELLOW}7D${RESET}${SEVEN_BAR}"
else
    FIVE_BAR=$(generate_bar 0 10 "5h")
    SEVEN_BAR=$(generate_bar 0 10 "7d")
    LINE2="🧠 ${CTX_BAR} ${C_LAVENDER}5H${RESET}${FIVE_BAR} ${C_YELLOW}7D${RESET}${SEVEN_BAR} ${C_OVERLAY}(loading..)${RESET}"
fi

# ============================================================================
# Output (using printf with line clear)
# ============================================================================
printf "%b%b\n" "$LINE1" "$CLR"
printf "%b%b\n" "$LINE2" "$CLR"
