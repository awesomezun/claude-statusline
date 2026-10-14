#!/bin/bash
# ============================================================================
# Awesome Statusline - Legacy 2.0.1
# ============================================================================
# Line 1: 🤖 Model | ✅ Git | 🐍 Env | 🎨 Style
# Line 2: 📂 full path 🌿(branch) | 💰 cost | ⏰ duration
# Line 3: 🧠 Context bar 20 blocks % used (tokens)
# Line 4: 🚀 Usage 5H bar 20 blocks % (Reset time)
# Line 5: ⭐ Usage 7D bar 20 blocks % (Reset day time)
# % numbers use gradient end color + Bold
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
OUTPUT_STYLE=$(echo "$input" | jq -r '.output_style.name // ""')
TOTAL_COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
TOTAL_DURATION=$(echo "$input" | jq -r '.cost.total_duration_ms // 0')

# Rate limits (official API - available for Pro/Max subscribers)
FIVE_HOUR_PCT=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
FIVE_HOUR_RESET=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
SEVEN_DAY_PCT=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
SEVEN_DAY_RESET=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

# ============================================================================
# Colors
# ============================================================================
RESET="\033[0m"
BOLD="\033[1m"

cat_teal() { echo -e "\033[38;2;148;226;213m"; }
cat_pink() { echo -e "\033[38;2;245;194;231m"; }
cat_peach() { echo -e "\033[38;2;250;179;135m"; }
cat_green() { echo -e "\033[38;2;166;227;161m"; }
cat_subtext() { echo -e "\033[38;2;166;173;200m"; }
cat_lavender() { echo -e "\033[38;2;180;190;254m"; }
cat_yellow() { echo -e "\033[38;2;249;226;175m"; }
cat_overlay() { echo -e "\033[38;2;108;112;134m"; }
latte_green() { echo -e "\033[38;2;64;160;43m"; }
latte_red() { echo -e "\033[38;2;210;15;57m"; }
latte_yellow() { echo -e "\033[38;2;223;142;29m"; }

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

# 5H: Mocha Lavender → Latte Blue → Latte Red
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

# 7D: Mocha Yellow → Latte Peach → Latte Red
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

    echo -e "$bar$RESET"
}

# ============================================================================
# Line 1: Model | Git Status | Env | Style
# ============================================================================

# Model (bold)
MODEL_DISPLAY="🤖 ${BOLD}$(cat_teal)${MODEL}${RESET}"

# Reasoning effort + extended thinking (effort.level: low|medium|high|xhigh|max; absent if model lacks effort param)
EFFORT=$(echo "$input" | jq -r '.effort.level // empty')
THINKING=$(echo "$input" | jq -r '.thinking.enabled // empty')
[ -n "$EFFORT" ] && MODEL_DISPLAY="${MODEL_DISPLAY} \033[38;2;250;179;135m⚡${EFFORT}${RESET}"
[ "$THINKING" = "true" ] && MODEL_DISPLAY="${MODEL_DISPLAY} \033[38;2;249;226;175m💡${RESET}"

# Git status
GIT_STATUS_DISPLAY=""
cd "$CURRENT_DIR" 2>/dev/null
if git rev-parse --git-dir > /dev/null 2>&1; then
    STAGED=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
    UNSTAGED=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
    UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$STAGED" -eq 0 && "$UNSTAGED" -eq 0 && "$UNTRACKED" -eq 0 ]]; then
        GIT_STATUS_DISPLAY="$(latte_green)✅ clean${RESET}"
    else
        STATUS=""
        [[ "$STAGED" -gt 0 ]] && STATUS="${STATUS}+${STAGED}"
        [[ "$UNSTAGED" -gt 0 ]] && STATUS="${STATUS}!${UNSTAGED}"
        [[ "$UNTRACKED" -gt 0 ]] && STATUS="${STATUS}?${UNTRACKED}"
        GIT_STATUS_DISPLAY="$(latte_yellow)📝${STATUS}${RESET}"
    fi
else
    GIT_STATUS_DISPLAY="$(cat_overlay)no git${RESET}"
fi

# Conda env (Catppuccin Mocha Green)
ENV_DISPLAY=""
if [[ -n "$CONDA_DEFAULT_ENV" ]]; then
    ENV_DISPLAY="🐍 $(cat_green)${CONDA_DEFAULT_ENV}${RESET}"
else
    ENV_DISPLAY="$(cat_overlay)no env${RESET}"
fi

# Output style
STYLE_DISPLAY=""
[[ -n "$OUTPUT_STYLE" ]] && STYLE_DISPLAY="🎨 $(cat_peach)${OUTPUT_STYLE}${RESET}"

LINE1="${MODEL_DISPLAY} │ ${GIT_STATUS_DISPLAY} │ ${ENV_DISPLAY} │ ${STYLE_DISPLAY}"

# ============================================================================
# Line 2: Directory + Branch | Cost | Duration
# ============================================================================

# Directory (full path, no ~)
DIR_DISPLAY="📂 $(cat_subtext)${CURRENT_DIR}${RESET}"

# Git branch
BRANCH_DISPLAY=""
cd "$CURRENT_DIR" 2>/dev/null
if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null)
    [[ -n "$BRANCH" ]] && BRANCH_DISPLAY=" $(latte_green)🌿(${BRANCH})${RESET}"
fi

# Cost
COST_DISPLAY=""
if [[ "$TOTAL_COST" != "0" && -n "$TOTAL_COST" ]]; then
    COST_FMT=$(printf "%.2f" "$TOTAL_COST")
    COST_DISPLAY="💰 $(cat_yellow)${COST_FMT}\$${RESET}"
else
    COST_DISPLAY="💰 $(cat_overlay)0.00\$${RESET}"
fi

# Duration
DURATION_DISPLAY=""
if [[ "$TOTAL_DURATION" != "0" && -n "$TOTAL_DURATION" ]]; then
    DURATION_SEC=$((TOTAL_DURATION / 1000))
    if [[ $DURATION_SEC -ge 3600 ]]; then
        DURATION_FMT="$((DURATION_SEC / 3600))h$((DURATION_SEC % 3600 / 60))m"
    elif [[ $DURATION_SEC -ge 60 ]]; then
        DURATION_FMT="$((DURATION_SEC / 60))m"
    else
        DURATION_FMT="${DURATION_SEC}s"
    fi
    DURATION_DISPLAY="⏰ $(cat_subtext)${DURATION_FMT}${RESET}"
else
    DURATION_DISPLAY="⏰ $(cat_overlay)0s${RESET}"
fi

LINE2="${DIR_DISPLAY}${BRANCH_DISPLAY} │ ${COST_DISPLAY} │ ${DURATION_DISPLAY}"

# ============================================================================
# Line 3: Context (20 blocks)
# ============================================================================

CONTEXT_PERCENT=0
CURRENT_TOKENS=0
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

# Format tokens as k
TOKENS_K=$((CURRENT_TOKENS / 1000))
CONTEXT_K=$((CONTEXT_SIZE / 1000))

CTX_BAR=$(generate_bar "$CONTEXT_PERCENT" 20 "context")
CTX_END_COLOR=$(get_context_gradient_color "$CONTEXT_PERCENT")
LINE3="🧠 $(cat_pink)Context${RESET}  ${CTX_BAR} ${BOLD}\033[38;2;${CTX_END_COLOR}m${CONTEXT_PERCENT}% used${RESET} (${TOKENS_K}k/${CONTEXT_K}k)"

# ============================================================================
# Lines 4-5: Usage 5H and 7D (20 blocks)
# ============================================================================

# Format 5H reset as "Xh Xm left"
format_time_remaining() {
    local reset_epoch="$1"
    [[ -z "$reset_epoch" || "$reset_epoch" == "null" ]] && return
    local now_epoch=$(date +%s)
    local remaining=$((reset_epoch - now_epoch))
    [[ $remaining -lt 0 ]] && remaining=0
    local hours=$((remaining / 3600))
    local minutes=$(((remaining % 3600) / 60))
    echo "${hours}h${minutes}m left"
}

# Cross-platform date formatting (BSD/macOS vs GNU/Linux)
_date_fmt() {
    local epoch="$1" fmt="$2"
    local out=""
    out=$(date -j -f "%s" "$epoch" "+$fmt" 2>/dev/null) && [[ -n "$out" ]] && { echo "$out"; return; }
    out=$(date -r "$epoch" "+$fmt" 2>/dev/null) && [[ -n "$out" ]] && { echo "$out"; return; }
    date -d "@$epoch" "+$fmt" 2>/dev/null
}

# Format 7D reset as "Wed 14:00"
format_reset_datetime() {
    local reset_epoch="$1"
    [[ -z "$reset_epoch" || "$reset_epoch" == "null" ]] && return
    LC_TIME=C _date_fmt "$reset_epoch" "%a %H:%M"
}

# Usage from rate_limits
if [[ -n "$FIVE_HOUR_PCT" ]]; then
    FIVE_HOUR=$(printf "%.0f" "$FIVE_HOUR_PCT")
    SEVEN_DAY=$(printf "%.0f" "${SEVEN_DAY_PCT:-0}")

    FIVE_RESET_FMT=$(format_time_remaining "$FIVE_HOUR_RESET")
    SEVEN_RESET_FMT=$(format_reset_datetime "$SEVEN_DAY_RESET")

    FIVE_BAR=$(generate_bar "$FIVE_HOUR" 20 "5h")
    SEVEN_BAR=$(generate_bar "$SEVEN_DAY" 20 "7d")

    FIVE_END_COLOR=$(get_usage_gradient_color "$FIVE_HOUR")
    SEVEN_END_COLOR=$(get_usage_7d_gradient_color "$SEVEN_DAY")

    LINE4="🚀 $(cat_lavender)Usage 5H${RESET} ${FIVE_BAR} ${BOLD}\033[38;2;${FIVE_END_COLOR}m${FIVE_HOUR}%${RESET} (Reset ${FIVE_RESET_FMT})"
    LINE5="⭐ $(cat_yellow)Usage 7D${RESET} ${SEVEN_BAR} ${BOLD}\033[38;2;${SEVEN_END_COLOR}m${SEVEN_DAY}%${RESET} (Reset ${SEVEN_RESET_FMT})"
else
    FIVE_BAR=$(generate_bar 0 20 "5h")
    SEVEN_BAR=$(generate_bar 0 20 "7d")
    FIVE_END_COLOR=$(get_usage_gradient_color 0)
    SEVEN_END_COLOR=$(get_usage_7d_gradient_color 0)
    LINE4="🚀 $(cat_lavender)Usage 5H${RESET} ${FIVE_BAR} ${BOLD}\033[38;2;${FIVE_END_COLOR}m0%${RESET} $(cat_overlay)(loading..)${RESET}"
    LINE5="⭐ $(cat_yellow)Usage 7D${RESET} ${SEVEN_BAR} ${BOLD}\033[38;2;${SEVEN_END_COLOR}m0%${RESET} $(cat_overlay)(loading..)${RESET}"
fi

# ============================================================================
# Output
# ============================================================================
echo -e "$LINE1"
echo -e "$LINE2"
echo -e "$LINE3"
echo -e "$LINE4"
echo -e "$LINE5"
