#!/usr/bin/env bash
# ============================================================================
# Awesome Statusline — renderer for macOS / Linux / Git Bash
# ----------------------------------------------------------------------------
# Claude Code pipes the session JSON on stdin and shows whatever this prints.
#
#   bash awesome-statusline.sh <preset>
#
# Presets
#   xsmall | small | medium | large | xlarge    classic layouts (xs s m l xl)
#   <size>-plain                                 same layout without emoji
#   <size>-simple                                text-only layout (no bars, no emoji)
#   simple = small-simple, oneline = xsmall-simple   (aliases)
#
# Usage limits follow the official statusline JSON: every window (five_hour,
# seven_day) is optional on its own. The Ultra plan has no 5-hour limit, so a
# payload with only seven_day gets a weekly layout with a per-day budget;
# Pro / Max show 5H + 7D. "loading.." appears only while rate_limits is missing
# altogether (before the first API response of a session).
#
# Works on bash 3.2 (macOS default) and newer. Needs jq.
# ============================================================================

# A bundled jq copied next to this script (Windows / GUI launches with a
# minimal PATH) must win over a missing one.
export PATH="$(dirname "$0"):$PATH"
# English day/month names and "." decimals regardless of the user's locale.
export LC_NUMERIC=C LC_TIME=C

E=$'\033'
RST="${E}[0m"
BLD="${E}[1m"
CLR="${E}[K"

# ---------------------------------------------------------------- preset
PRESET=$(printf '%s' "${1:-${AWESOME_STATUSLINE_PRESET:-large}}" | tr '[:upper:]' '[:lower:]')
PLAIN=""      # no emoji
SIMPLE=""     # text-only layout (implies no emoji)
case "$PRESET" in
    *-plain)  PLAIN=1; PRESET=${PRESET%-plain} ;;
    *-simple) PLAIN=1; SIMPLE=1; PRESET=${PRESET%-simple} ;;
esac
case "$PRESET" in
    xs|xsmall)              SIZE=xsmall ;;
    s|small)                SIZE=small ;;
    m|medium)               SIZE=medium ;;
    xl|xlarge)              SIZE=xlarge ;;
    simple)                 SIZE=small;  PLAIN=1; SIMPLE=1 ;;   # alias of small-simple
    oneline|one-line|1line) SIZE=xsmall; PLAIN=1; SIMPLE=1 ;;   # alias of xsmall-simple
    *)                      SIZE=large ;;
esac
LAYOUT=$SIZE
[[ -n "$SIMPLE" ]] && LAYOUT="$SIZE-simple"

input=$(cat)

if ! command -v jq >/dev/null 2>&1; then
    printf '%s\n' "Awesome Statusline: jq not found — re-run the installer (it installs jq)."
    exit 0
fi

# ---------------------------------------------------------------- parse (one jq call)
# Every value is emitted as a shell assignment; strings go through @sh so the
# eval below is safe. Numbers are normalised here: fractional or numeric-string
# percentages are rounded and clamped to 0-100, epochs are floored, and an
# ISO-8601 resets_at is accepted as a fallback.
JQ_PROG='
def n: if type == "number" then . elif type == "string" then (tonumber? // null) else null end;
def pct: n | if . == null then "" else ((. + 0.5) | floor | if . < 0 then 0 elif . > 100 then 100 else . end) end;
def epoch: if type == "number" then floor
           elif type == "string" then ((tonumber? // fromdateiso8601? // null) | if . == null then "" else floor end)
           else "" end;
def str: if . == null then "" else tostring end;
(.rate_limits | if type == "object" then . else {} end) as $rl
| (.context_window | if type == "object" then . else {} end) as $cw
| [
    "MODEL=" + ((.model.display_name // .model.id // "Unknown") | str | @sh),
    "CUR_DIR=" + ((.workspace.current_dir // .cwd // ".") | str | @sh),
    "STYLE=" + ((.output_style.name // "") | str | @sh),
    "EFFORT=" + ((.effort.level // "") | str | @sh),
    "THINKING=" + (if .thinking.enabled == true then "1" else "" end),
    "CTX_SIZE=" + (($cw.context_window_size | n // 200000) | floor | tostring),
    "CTX_TOK=" + (($cw.current_usage
                    | if type == "object" then ((.input_tokens | n // 0) + (.cache_creation_input_tokens | n // 0) + (.cache_read_input_tokens | n // 0))
                      elif type == "number" then .
                      else 0 end) | floor | tostring),
    "CTX_USED=" + ($cw.used_percentage | pct | tostring),
    "CTX_LEFT=" + ($cw.remaining_percentage | pct | tostring),
    "COST=" + ((.cost.total_cost_usd | n // 0) | tostring),
    "DUR_MS=" + ((.cost.total_duration_ms | n // 0) | floor | tostring),
    "HAS_RL=" + (if ($rl | type) == "object" and ($rl | length) > 0 then "1" else "" end),
    "FIVE_PCT=" + ($rl.five_hour.used_percentage | pct | tostring),
    "FIVE_RESET=" + ($rl.five_hour.resets_at | epoch | tostring),
    "SEVEN_PCT=" + ($rl.seven_day.used_percentage | pct | tostring),
    "SEVEN_RESET=" + ($rl.seven_day.resets_at | epoch | tostring)
  ] | .[]'
eval "$(printf '%s' "$input" | jq -r "$JQ_PROG" 2>/dev/null)"

: "${MODEL:=Unknown}" "${CUR_DIR:=.}" "${CTX_SIZE:=200000}" "${CTX_TOK:=0}" "${COST:=0}" "${DUR_MS:=0}"
NOW=$(date +%s)

# ---------------------------------------------------------------- palette (Catppuccin)
c_sub1="${E}[38;2;186;194;222m";  c_sub0="${E}[38;2;166;173;200m"
c_ov2="${E}[38;2;147;153;178m";   c_ov1="${E}[38;2;127;132;156m";   c_ov0="${E}[38;2;108;112;134m"
c_surf2="${E}[38;2;88;91;112m"
c_teal="${E}[38;2;148;226;213m";  c_pink="${E}[38;2;245;194;231m";  c_peach="${E}[38;2;250;179;135m"
c_green="${E}[38;2;166;227;161m"; c_lav="${E}[38;2;180;190;254m";   c_yellow="${E}[38;2;249;226;175m"
c_red="${E}[38;2;243;139;168m";   c_maroon="${E}[38;2;235;160;172m"
c_lgreen="${E}[38;2;64;160;43m";  c_lyellow="${E}[38;2;223;142;29m"

SEP="${c_surf2} │ ${RST}"
DOT="${c_ov0} · ${RST}"

# Emoji are only ever the first glyph of a segment, so a terminal that draws
# them 1 cell wide shifts every line the same way and columns stay aligned.
if [[ -n "$PLAIN" ]]; then
    i_model="" i_dir="" i_branch="" i_git="" i_clean="" i_style="" i_env="" i_cost="" i_time=""
    i_ctx="" i_5h="" i_7d="" i_7dxl=""
else
    i_model="🤖 " i_dir="📂 " i_branch="🌿" i_git="📝 " i_clean="✅ " i_style="🎨 " i_env="🐍 " i_cost="💰 " i_time="⏰ "
    i_ctx="🧠 " i_5h="🚀 " i_7d="⭐ " i_7dxl="🌟 "
fi

# ---------------------------------------------------------------- helpers (no subshells)
# grad <ctx|5h|7d> <pct>  → G="r;g;b"   (same gradients as earlier versions)
grad() {
    local p=$2 t r g b
    (( p < 0 )) && p=0
    (( p > 100 )) && p=100
    case "$1" in
        ctx)
            if (( p < 30 )); then
                t=$(( p * 100 / 30 ));        r=$(( 245 - 15 * t / 100 )); g=$(( 194 - 125 * t / 100 )); b=$(( 231 - 148 * t / 100 ))
            elif (( p < 70 )); then
                t=$(( (p - 30) * 100 / 40 )); r=$(( 230 - 20 * t / 100 ));  g=$(( 69 - 54 * t / 100 ));   b=$(( 83 - 26 * t / 100 ))
            else
                r=210; g=15; b=57
            fi ;;
        7d)
            if (( p < 50 )); then
                t=$(( p * 2 ));               r=$(( 249 + 5 * t / 100 ));   g=$(( 226 - 126 * t / 100 )); b=$(( 175 - 164 * t / 100 ))
            else
                t=$(( (p - 50) * 2 ));        r=$(( 254 - 44 * t / 100 ));  g=$(( 100 - 85 * t / 100 ));  b=$(( 11 + 46 * t / 100 ))
            fi ;;
        *)
            if (( p < 50 )); then
                t=$(( p * 2 ));               r=$(( 180 - 150 * t / 100 )); g=$(( 190 - 88 * t / 100 ));  b=$(( 254 - 9 * t / 100 ))
            else
                t=$(( (p - 50) * 2 ));        r=$(( 30 + 180 * t / 100 ));  g=$(( 102 - 87 * t / 100 ));  b=$(( 245 - 188 * t / 100 ))
            fi ;;
    esac
    G="$r;$g;$b"
}

# bar <kind> <pct> <width>  → BAR (gradient █ fill, ░ rest in the end colour)
bar() {
    local kind=$1 p=$2 w=$3 i f end out=""
    f=$(( (p * w + 50) / 100 ))
    (( f > w )) && f=$w
    grad "$kind" "$p"; end=$G
    for (( i = 0; i < f; i++ )); do
        grad "$kind" $(( i * 100 / w ))
        out+="${E}[38;2;${G}m█"
    done
    out+="${E}[38;2;${end}m"
    for (( i = f; i < w; i++ )); do out+="░"; done
    BAR="$out$RST"
}

# pctv <kind> <pct>  → PV = bold, right-aligned "  7%" / " 34%" / "100%" in the bar's end colour
pctv() {
    local s
    printf -v s '%3d%%' "$2"
    grad "$1" "$2"
    PV="${BLD}${E}[38;2;${G}m${s}${RST}"
}

# rel <seconds> → R = "2d10h" | "2h05m" | "40m"
rel() {
    local s=$1 m mm
    (( s < 0 )) && s=0
    m=$(( s / 60 ))
    if (( m >= 1440 )); then
        R="$(( m / 1440 ))d$(( m % 1440 / 60 ))h"
    elif (( m >= 60 )); then
        printf -v mm '%02d' $(( m % 60 ))
        R="$(( m / 60 ))h${mm}m"
    else
        R="${m}m"
    fi
}

# fmt_at <epoch> <strftime format> → D (bash ≥ 4.2 formats in-process; else date)
if (( BASH_VERSINFO[0] > 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 2) )); then
    fmt_at() { printf -v D "%($2)T" "$1"; }
elif date -r 0 +%s >/dev/null 2>&1; then
    fmt_at() { D=$(date -r "$1" "+$2" 2>/dev/null); }
else
    fmt_at() { D=$(date -d "@$1" "+$2" 2>/dev/null); }
fi

# "1:12am" / "Tue Nov 3, 1pm" without non-portable %-I / %-d
fmt_ampm() {
    local h m
    fmt_at "$1" "%H %M"; h=${D% *}; m=${D#* }
    h=$((10#$h)); local ap=am; (( h >= 12 )) && ap=pm
    h=$(( h % 12 )); (( h == 0 )) && h=12
    D="$h:$m$ap"
}
fmt_long() {
    local wd mo d h
    fmt_at "$1" "%a %b %d %H"
    set -- $D; wd=$1; mo=$2; d=$((10#$3)); h=$((10#$4))
    local ap=am; (( h >= 12 )) && ap=pm
    h=$(( h % 12 )); (( h == 0 )) && h=12
    D="$wd $mo $d, $h$ap"
}

# pace_col <used> <seconds left|""> <window seconds> → PC
# Compares usage with the share of the window that has already passed:
# well under → green, about even → yellow, ahead of time (or ≥ 90%) → red.
pace_col() {
    local u=$1 left=$2 span=$3 pace d
    if [[ -n "$left" ]]; then pace=$(( (span - left) * 100 / span )); else pace=-1; fi
    if (( pace < 10 )); then
        if (( u >= 85 )); then PC=$c_red; elif (( u >= 60 )); then PC=$c_yellow; else PC=$c_green; fi
        return
    fi
    d=$(( u - pace ))
    if (( u >= 90 || d >= 8 )); then PC=$c_red
    elif (( d > -5 )); then PC=$c_yellow
    else PC=$c_green
    fi
}

pad() { printf -v PADDED "%-$2s" "$1"; }

# ---------------------------------------------------------------- derived values
SHORT=${MODEL#Claude }
SHORT=${SHORT%% (*}
SHORT=${SHORT%% [0-9]*}

(( CTX_TOK > CTX_SIZE )) && CTX_SIZE=1000000   # stale 200k report on a 1M session
if (( CTX_TOK > 0 && CTX_SIZE > 0 )); then
    CTX_PCT=$(( CTX_TOK * 100 / CTX_SIZE ))
elif [[ -n "$CTX_USED" ]]; then
    CTX_PCT=$CTX_USED
elif [[ -n "$CTX_LEFT" ]]; then
    CTX_PCT=$(( 100 - CTX_LEFT ))
else
    CTX_PCT=0
fi
(( CTX_PCT > 100 )) && CTX_PCT=100
TOK_K="$(( CTX_TOK / 1000 ))k"
if (( CTX_SIZE >= 1000000 && CTX_SIZE % 1000000 == 0 )); then SIZE_K="$(( CTX_SIZE / 1000000 ))M"; else SIZE_K="$(( CTX_SIZE / 1000 ))k"; fi

printf -v COST_FMT '$%.2f' "$COST" 2>/dev/null || COST_FMT='$0.00'
DUR_S=$(( DUR_MS / 1000 ))
if (( DUR_S >= 3600 )); then DUR="$(( DUR_S / 3600 ))h$(( DUR_S % 3600 / 60 ))m"
elif (( DUR_S >= 60 )); then DUR="$(( DUR_S / 60 ))m"
else DUR="${DUR_S}s"; fi

HOME_DIR=${HOME%/}
DIR_SHOW=$CUR_DIR
if [[ -n "$HOME_DIR" ]]; then   # an empty HOME would turn "$HOME_DIR"/* into /*
    case "$CUR_DIR" in
        "$HOME_DIR")   DIR_SHOW="~" ;;
        "$HOME_DIR"/*) DIR_SHOW="~${CUR_DIR#"$HOME_DIR"}" ;;
    esac
fi
DIR_BASE=${CUR_DIR%/}; DIR_BASE=${DIR_BASE##*/}; [[ -z "$DIR_BASE" ]] && DIR_BASE=$DIR_SHOW

ENV_NAME=${CONDA_DEFAULT_ENV:-}
[[ -z "$ENV_NAME" && -n "${VIRTUAL_ENV:-}" ]] && ENV_NAME=${VIRTUAL_ENV##*/}

# Limit windows: seconds left (empty when unknown)
FIVE_LEFT=""; SEVEN_LEFT=""
[[ -n "$FIVE_PCT" && -n "$FIVE_RESET" ]] && { FIVE_LEFT=$(( FIVE_RESET - NOW )); (( FIVE_LEFT < 0 )) && FIVE_LEFT=0; }
[[ -n "$SEVEN_PCT" && -n "$SEVEN_RESET" ]] && { SEVEN_LEFT=$(( SEVEN_RESET - NOW )); (( SEVEN_LEFT < 0 )) && SEVEN_LEFT=0; }

# Share of each window that has already passed (for the xlarge-simple detail)
FIVE_EL=""; SEVEN_EL=""
if [[ -n "$FIVE_LEFT" ]]; then FIVE_EL=$(( (18000 - FIVE_LEFT) * 100 / 18000 )); (( FIVE_EL < 0 )) && FIVE_EL=0; fi
if [[ -n "$SEVEN_LEFT" ]]; then SEVEN_EL=$(( (604800 - SEVEN_LEFT) * 100 / 604800 )); (( SEVEN_EL < 0 )) && SEVEN_EL=0; fi

# Weekly budget: "≈22%/day" while a day or more is left, else "9% left"
BUDGET=""
if [[ -n "$SEVEN_PCT" && -n "$SEVEN_LEFT" ]]; then
    if (( SEVEN_LEFT >= 86400 )); then
        BUDGET="$(( ((100 - SEVEN_PCT) * 86400 + SEVEN_LEFT / 2) / SEVEN_LEFT ))%/day"
    else
        BUDGET="$(( 100 - SEVEN_PCT ))% left"
    fi
fi

# ---------------------------------------------------------------- git (one call)
GIT_OK="" BRANCH="" OID="" AHEAD=0 BEHIND=0 STAGED=0 UNSTAGED=0 UNTRACKED=0
if command -v git >/dev/null 2>&1 && [[ -d "$CUR_DIR" ]]; then
    # --no-optional-locks: never take index.lock, so a refreshing statusline
    # can't collide with the user's own git commands.
    if GIT_OUT=$(git --no-optional-locks -C "$CUR_DIR" status --porcelain=v2 --branch 2>/dev/null); then
        GIT_OK=1
        while IFS= read -r line; do
            case "$line" in
                "# branch.head "*) BRANCH=${line#"# branch.head "} ;;
                "# branch.oid "*)  OID=${line#"# branch.oid "} ;;
                "# branch.ab "*)   set -- ${line#"# branch.ab "}; AHEAD=${1#+}; BEHIND=${2#-} ;;
                "1 "*|"2 "*)       xy=${line:2:2}
                                   [[ "${xy:0:1}" != "." ]] && STAGED=$(( STAGED + 1 ))
                                   [[ "${xy:1:1}" != "." ]] && UNSTAGED=$(( UNSTAGED + 1 )) ;;
                "u "*)             UNSTAGED=$(( UNSTAGED + 1 )) ;;
                "? "*)             UNTRACKED=$(( UNTRACKED + 1 )) ;;
            esac
        done <<< "$GIT_OUT"
        [[ "$BRANCH" == "(detached)" ]] && BRANCH=${OID:0:7}
    fi
fi
DIRTY=""; (( STAGED + UNSTAGED + UNTRACKED > 0 )) && DIRTY=1

GC=""
(( STAGED ))    && GC+=" ${c_green}+${STAGED}${RST}"
(( UNSTAGED ))  && GC+=" ${c_yellow}!${UNSTAGED}${RST}"
(( UNTRACKED )) && GC+=" ${c_ov1}?${UNTRACKED}${RST}"
GC=${GC# }
AB=""
(( AHEAD ))  && AB+=" ↑${AHEAD}"
(( BEHIND )) && AB+=" ↓${BEHIND}"

# ---------------------------------------------------------------- shared segments
# ident <full|short> <plain thinking word>
ident() {
    local m=$MODEL
    [[ "$1" == short ]] && m=$SHORT
    ID="${i_model}${BLD}${c_teal}${m}${RST}"
    if [[ -z "$PLAIN" ]]; then
        [[ -n "$EFFORT" ]] && ID+=" ${c_peach}⚡${EFFORT}${RST}"
        [[ -n "$THINKING" ]] && ID+=" ${c_yellow}💡${RST}"
    else
        [[ -n "$EFFORT" ]] && ID+="${DOT}${c_peach}${EFFORT}${RST}"
        [[ -n "$THINKING" ]] && ID+="${DOT}${c_yellow}${2:-thinking}${RST}"
    fi
}

# git state for the roomy layouts: "📝 +2 !3 ?1" / "✅ clean" (empty outside git)
git_seg() {
    GS=""
    [[ -z "$GIT_OK" ]] && return
    if [[ -n "$DIRTY" ]]; then GS="${i_git}${1:+${c_lyellow}$1${RST} }${GC}"
    else GS="${i_clean}${c_lgreen}clean${RST}"; fi
}

branch_seg() {   # "🌿(main ↑1)" (empty outside git)
    BS=""
    [[ -n "$GIT_OK" && -n "$BRANCH" ]] && BS=" ${i_branch}${c_lgreen}(${BRANCH}${1:+${AB}})${RST}"
}

style_seg() { SS=""; [[ -n "$STYLE" && "$STYLE" != "default" ]] && SS="${i_style}${c_peach}${STYLE}${RST}"; }
env_seg()   { ES=""; [[ -n "$ENV_NAME" ]] && ES="${i_env}${c_green}${ENV_NAME}${RST}"; }

join_sep() {   # joins non-empty args with SEP → J
    J=""
    local a
    for a in "$@"; do
        [[ -z "$a" ]] && continue
        if [[ -n "$J" ]]; then J+="$SEP$a"; else J=$a; fi
    done
}

# ---- text-only (simple) pieces: dim keys, bold values, no bars, no emoji
# ledger_head [git word] → LH = "Opus 5.5 · xhigh · thinking   git +2 !3 ?1   env venv   style explanatory"
ledger_head() {
    ident full thinking
    LH=$ID
    if [[ -n "$GIT_OK" ]]; then
        if [[ -n "$DIRTY" ]]; then LH+="   ${c_ov1}git ${RST}${1:+${c_lyellow}$1${RST} }${GC}"
        else LH+="   ${c_ov1}git ${RST}${c_lgreen}clean${RST}"; fi
    fi
    [[ -n "$ENV_NAME" ]] && LH+="   ${c_ov1}env ${RST}${c_green}${ENV_NAME}${RST}"
    [[ -n "$STYLE" && "$STYLE" != "default" ]] && LH+="   ${c_ov1}style ${RST}${c_peach}${STYLE}${RST}"
}
# ledger_where [with cost/time] → LW = "~/path (main ↑1)   cost $25.29   time 5h16m"
ledger_where() {
    LW="${c_sub0}${DIR_SHOW}${RST}"
    [[ -n "$GIT_OK" && -n "$BRANCH" ]] && LW+=" ${c_green}(${BRANCH}${AB})${RST}"
    [[ -n "$1" ]] && LW+="   ${c_ov1}cost ${RST}${BLD}${c_yellow}${COST_FMT}${RST}   ${c_ov1}time ${RST}${BLD}${c_sub1}${DUR}${RST}"
}
# vpad <colour> <pct> → VP = bold, right-aligned "  7%" / " 34%" / "100%"
vpad() { local s; printf -v s '%3d%%' "$2"; VP="${BLD}$1${s}${RST}"; }

LOADING="${c_ov0}loading..${RST}"
DASH="${BLD}${c_ov0}  --${RST}"

LINES=()
emit() { LINES+=("$1"); }

# ================================================================ layouts
case "$LAYOUT" in

xsmall)
    ident short think
    L1="$ID  ${i_dir}${c_sub0}${DIR_BASE}${RST}"
    [[ -n "$GIT_OK" && -n "$BRANCH" ]] && L1+=" ${i_branch}${c_lgreen}${BRANCH}${RST}${DIRTY:+${BLD}${c_yellow}*${RST}}"
    if [[ -n "$PLAIN" ]]; then L2="${c_pink}ctx ${RST}"; else L2="${c_pink}🧠 ${RST}"; fi
    bar ctx "$CTX_PCT" 6; pctv ctx "$CTX_PCT"; L2+="$BAR$PV"
    if [[ -z "$HAS_RL" ]]; then
        bar 5h 0 6; L2+="  ${c_lav}5h ${RST}$BAR$DASH"
        bar 7d 0 6; L2+="  ${c_yellow}7d ${RST}$BAR$DASH  $LOADING"
    elif [[ -n "$FIVE_PCT" ]]; then
        bar 5h "$FIVE_PCT" 6; pctv 5h "$FIVE_PCT"; L2+="  ${c_lav}5h ${RST}$BAR$PV"
        if [[ -n "$SEVEN_PCT" ]]; then bar 7d "$SEVEN_PCT" 6; pctv 7d "$SEVEN_PCT"; L2+="  ${c_yellow}7d ${RST}$BAR$PV"; fi
    elif [[ -n "$SEVEN_PCT" ]]; then
        bar 7d "$SEVEN_PCT" 6; pctv 7d "$SEVEN_PCT"; L2+="  ${c_yellow}wk ${RST}$BAR$PV"
        [[ -n "$SEVEN_LEFT" ]] && { rel "$SEVEN_LEFT"; L2+=" ${c_ov1}↻${R}${RST}"; }
    fi
    emit "$L1"; emit "$L2"
    ;;

small)
    ident full thinking
    branch_seg; style_seg
    L1="${i_dir}${c_sub0}${DIR_SHOW}${RST}${BS}${GC:+ $GC}"
    join_sep "$ID" "$L1" "$SS"; L1=$J
    bar ctx "$CTX_PCT" 10; pctv ctx "$CTX_PCT"
    L2="${i_ctx}${c_pink}Context${RST} $BAR $PV"
    if [[ -z "$HAS_RL" ]]; then
        bar 5h 0 10; L2+="$SEP${c_lav}5H${RST} $BAR$DASH"
        bar 7d 0 10; L2+="$SEP${c_yellow}7D${RST} $BAR$DASH  $LOADING"
    elif [[ -n "$FIVE_PCT" ]]; then
        bar 5h "$FIVE_PCT" 10; pctv 5h "$FIVE_PCT"; L2+="$SEP${c_lav}5H${RST} $BAR $PV"
        [[ -n "$FIVE_LEFT" ]] && { rel "$FIVE_LEFT"; L2+=" ${c_ov2}${R}${RST}"; }
        if [[ -n "$SEVEN_PCT" ]]; then
            bar 7d "$SEVEN_PCT" 10; pctv 7d "$SEVEN_PCT"; L2+="$SEP${c_yellow}7D${RST} $BAR $PV"
            [[ -n "$SEVEN_LEFT" ]] && { fmt_at "$SEVEN_RESET" "%a"; L2+=" ${c_ov2}${D}${RST}"; }
        fi
    elif [[ -n "$SEVEN_PCT" ]]; then
        bar 7d "$SEVEN_PCT" 10; pctv 7d "$SEVEN_PCT"; L2+="$SEP${c_yellow}Week${RST} $BAR $PV"
        if [[ -n "$SEVEN_LEFT" ]]; then fmt_at "$SEVEN_RESET" "%a %H:%M"; rel "$SEVEN_LEFT"; L2+=" ${c_ov2}${D} · ${R}${RST}"; fi
    fi
    emit "$L1"; emit "$L2"
    ;;

medium)
    ident full thinking
    git_seg; env_seg; style_seg; branch_seg ab
    join_sep "$ID" "$GS" "$ES" "$SS"; emit "$J"
    emit "${i_dir}${c_sub0}${DIR_SHOW}${RST}${BS}"
    bar ctx "$CTX_PCT" 40; pctv ctx "$CTX_PCT"; pad Context 9
    emit "${i_ctx}${c_pink}${PADDED}${RST}$BAR $PV${c_ov2}  ${TOK_K}/${SIZE_K}${RST}"
    pad Usage 9; USAGE_LBL=$PADDED
    if [[ -z "$HAS_RL" ]]; then
        bar 5h 0 14; L4="${i_5h}${c_lav}${USAGE_LBL}5H ${RST}$BAR$DASH"
        bar 7d 0 14; L4+="$SEP${c_yellow}7D ${RST}$BAR$DASH  $LOADING"
        emit "$L4"
    elif [[ -n "$FIVE_PCT" ]]; then
        bar 5h "$FIVE_PCT" 14; pctv 5h "$FIVE_PCT"; L4="${i_5h}${c_lav}${USAGE_LBL}5H ${RST}$BAR $PV"
        [[ -n "$FIVE_LEFT" ]] && { rel "$FIVE_LEFT"; L4+=" ${c_ov2}${R}${RST}"; }
        if [[ -n "$SEVEN_PCT" ]]; then
            bar 7d "$SEVEN_PCT" 14; pctv 7d "$SEVEN_PCT"; L4+="$SEP${c_yellow}7D ${RST}$BAR $PV"
            [[ -n "$SEVEN_LEFT" ]] && { fmt_at "$SEVEN_RESET" "%a"; L4+=" ${c_ov2}${D}${RST}"; }
        fi
        emit "$L4"
    elif [[ -n "$SEVEN_PCT" ]]; then
        # Weekly only (Ultra): full-width bar in the same column as Context
        bar 7d "$SEVEN_PCT" 40; pctv 7d "$SEVEN_PCT"; pad Weekly 9
        L4="${i_7d}${c_yellow}${PADDED}${RST}$BAR $PV"
        if [[ -n "$SEVEN_LEFT" ]]; then fmt_at "$SEVEN_RESET" "%a %H:%M"; rel "$SEVEN_LEFT"; L4+="${c_ov2}  ${D} · ${R}${BUDGET:+ · $BUDGET}${RST}"; fi
        emit "$L4"
    fi
    ;;

xlarge)
    ident full thinking
    git_seg dirty; env_seg; style_seg; branch_seg ab
    join_sep "$ID" "$SS" "$GS" "$ES"; emit "$J"
    join_sep "${i_dir}${c_sub0}${DIR_SHOW}${RST}${BS}" "${i_cost}${c_yellow}${COST_FMT}${RST}" "${i_time}${c_sub0}${DUR}${RST}"; emit "$J"
    bar ctx "$CTX_PCT" 40; pctv ctx "$CTX_PCT"; pad Context 10
    emit "${i_ctx}${c_maroon}${PADDED}${RST}$BAR $PV${c_ov2}  used (${TOK_K} / $(( CTX_SIZE / 1000 ))k)${RST}"
    if [[ -z "$HAS_RL" ]]; then
        bar 5h 0 40; pad "5H Limit" 10; emit "${i_5h}${c_lav}${PADDED}${RST}$BAR$DASH  $LOADING"
        bar 7d 0 40; pad "7D Limit" 10; emit "${i_7dxl}${c_yellow}${PADDED}${RST}$BAR$DASH  $LOADING"
    else
        if [[ -n "$FIVE_PCT" ]]; then
            bar 5h "$FIVE_PCT" 40; pctv 5h "$FIVE_PCT"; pad "5H Limit" 10
            L="${i_5h}${c_lav}${PADDED}${RST}$BAR $PV"
            if [[ -n "$FIVE_LEFT" ]]; then rel "$FIVE_LEFT"; fmt_ampm "$FIVE_RESET"; L+="${c_ov2}  resets in ${R} (${D})${RST}"; fi
            emit "$L"
        fi
        if [[ -n "$SEVEN_PCT" ]]; then
            bar 7d "$SEVEN_PCT" 40; pctv 7d "$SEVEN_PCT"
            if [[ -n "$FIVE_PCT" ]]; then pad "7D Limit" 10; else pad Weekly 10; fi
            L="${i_7dxl}${c_yellow}${PADDED}${RST}$BAR $PV"
            if [[ -n "$SEVEN_LEFT" ]]; then
                rel "$SEVEN_LEFT"; fmt_long "$SEVEN_RESET"
                L+="${c_ov2}  resets ${D} (in ${R})"
                [[ -z "$FIVE_PCT" && -n "$BUDGET" ]] && L+=" · ≈${BUDGET}"
                L+="${RST}"
            fi
            emit "$L"
        fi
    fi
    ;;

small-simple)
    ident full thinking
    L1="$ID   ${c_sub0}${DIR_SHOW}${RST}"
    [[ -n "$GIT_OK" && -n "$BRANCH" ]] && L1+=" ${c_green}${BRANCH}${RST}${GC:+ $GC}"
    grad ctx "$CTX_PCT"
    L2="${c_ov1}ctx ${RST}${BLD}${E}[38;2;${G}m${CTX_PCT}%${RST}"
    if [[ -z "$HAS_RL" ]]; then
        L2+="   ${c_ov1}limits ${RST}$LOADING"
    elif [[ -n "$FIVE_PCT" ]]; then
        pace_col "$FIVE_PCT" "$FIVE_LEFT" 18000
        L2+="   ${c_ov1}5h ${RST}${BLD}${PC}${FIVE_PCT}%${RST}"
        [[ -n "$FIVE_LEFT" ]] && { rel "$FIVE_LEFT"; L2+=" ${c_ov2}${R}${RST}"; }
        if [[ -n "$SEVEN_PCT" ]]; then
            pace_col "$SEVEN_PCT" "$SEVEN_LEFT" 604800
            L2+="   ${c_ov1}7d ${RST}${BLD}${PC}${SEVEN_PCT}%${RST}"
            [[ -n "$SEVEN_LEFT" ]] && { fmt_at "$SEVEN_RESET" "%a %H:%M"; L2+=" ${c_ov2}${D}${RST}"; }
        fi
    elif [[ -n "$SEVEN_PCT" ]]; then
        pace_col "$SEVEN_PCT" "$SEVEN_LEFT" 604800
        L2+="   ${c_ov1}week ${RST}${BLD}${PC}${SEVEN_PCT}%${RST}"
        [[ -n "$SEVEN_LEFT" ]] && { fmt_at "$SEVEN_RESET" "%a %H:%M"; L2+=" ${c_ov2}${D}${BUDGET:+ · $BUDGET}${RST}"; }
    fi
    L2+="   ${c_ov1}cost ${RST}${BLD}${c_yellow}${COST_FMT}${RST}   ${c_ov1}time ${RST}${BLD}${c_sub1}${DUR}${RST}"
    emit "$L1"; emit "$L2"
    ;;

xsmall-simple)
    ident short think
    grad ctx "$CTX_PCT"
    L="$ID$SEP${c_ov1}ctx ${RST}${BLD}${E}[38;2;${G}m${CTX_PCT}%${RST}"
    if [[ -z "$HAS_RL" ]]; then
        L+="$SEP${c_ov1}5h ${RST}${c_ov0}--${RST}$SEP${c_ov1}7d ${RST}${c_ov0}--${RST}"
    else
        if [[ -n "$FIVE_PCT" ]]; then
            pace_col "$FIVE_PCT" "$FIVE_LEFT" 18000
            L+="$SEP${c_ov1}5h ${RST}${BLD}${PC}${FIVE_PCT}%${RST}"
        fi
        if [[ -n "$SEVEN_PCT" ]]; then
            pace_col "$SEVEN_PCT" "$SEVEN_LEFT" 604800
            if [[ -n "$FIVE_PCT" ]]; then
                L+="$SEP${c_ov1}7d ${RST}${BLD}${PC}${SEVEN_PCT}%${RST}"
            else
                L+="$SEP${c_ov1}wk ${RST}${BLD}${PC}${SEVEN_PCT}%${RST}"
                [[ -n "$SEVEN_LEFT" ]] && { rel "$SEVEN_LEFT"; L+=" ${c_ov1}↻${R}${RST}"; }
            fi
        fi
    fi
    [[ -n "$GIT_OK" && -n "$BRANCH" ]] && L+="$SEP${c_lgreen}${BRANCH}${RST}${DIRTY:+${BLD}${c_yellow}*${RST}}"
    emit "$L"
    ;;

medium-simple)
    ledger_head; emit "$LH"
    ledger_where; emit "$LW"
    grad ctx "$CTX_PCT"; vpad "${E}[38;2;${G}m" "$CTX_PCT"; pad context 9
    emit "${c_ov1}${PADDED}${RST}${VP}${c_ov2}   ${TOK_K} / ${SIZE_K}${RST}"
    pad limits 9; L="${c_ov1}${PADDED}${RST}"
    if [[ -z "$HAS_RL" ]]; then
        L+="$LOADING"
    elif [[ -n "$FIVE_PCT" ]]; then
        pace_col "$FIVE_PCT" "$FIVE_LEFT" 18000
        L+="${c_ov1}5h ${RST}${BLD}${PC}${FIVE_PCT}%${RST}"
        [[ -n "$FIVE_LEFT" ]] && { rel "$FIVE_LEFT"; L+=" ${c_ov2}${R}${RST}"; }
        if [[ -n "$SEVEN_PCT" ]]; then
            pace_col "$SEVEN_PCT" "$SEVEN_LEFT" 604800
            L+="   ${c_ov1}7d ${RST}${BLD}${PC}${SEVEN_PCT}%${RST}"
            [[ -n "$SEVEN_LEFT" ]] && { fmt_at "$SEVEN_RESET" "%a"; L+=" ${c_ov2}${D}${RST}"; }
        fi
    elif [[ -n "$SEVEN_PCT" ]]; then
        pace_col "$SEVEN_PCT" "$SEVEN_LEFT" 604800
        L+="${c_ov1}week ${RST}${BLD}${PC}${SEVEN_PCT}%${RST}"
        [[ -n "$SEVEN_LEFT" ]] && { fmt_at "$SEVEN_RESET" "%a %H:%M"; L+=" ${c_ov2}${D}${BUDGET:+ · $BUDGET}${RST}"; }
    else
        L=""   # rate_limits without a 5h / 7d window (e.g. spend_limit only)
    fi
    [[ -n "$L" ]] && emit "$L"
    ;;

large-simple)
    ledger_head; emit "$LH"
    ledger_where costtime; emit "$LW"
    grad ctx "$CTX_PCT"; vpad "${E}[38;2;${G}m" "$CTX_PCT"; pad context 9
    emit "${c_ov1}${PADDED}${RST}${VP}${c_ov2}   ${TOK_K} / ${SIZE_K}${RST}"
    if [[ -z "$HAS_RL" ]]; then
        pad 5h 9; emit "${c_ov1}${PADDED}${RST}${DASH}   $LOADING"
        pad 7d 9; emit "${c_ov1}${PADDED}${RST}${DASH}   $LOADING"
    else
        if [[ -n "$FIVE_PCT" ]]; then
            pace_col "$FIVE_PCT" "$FIVE_LEFT" 18000; vpad "$PC" "$FIVE_PCT"; pad 5h 9
            L="${c_ov1}${PADDED}${RST}${VP}"
            if [[ -n "$FIVE_LEFT" ]]; then rel "$FIVE_LEFT"; fmt_at "$FIVE_RESET" "%H:%M"; L+="${c_ov2}   resets in ${R} · ${D}${RST}"; fi
            emit "$L"
        fi
        if [[ -n "$SEVEN_PCT" ]]; then
            pace_col "$SEVEN_PCT" "$SEVEN_LEFT" 604800; vpad "$PC" "$SEVEN_PCT"
            if [[ -n "$FIVE_PCT" ]]; then pad 7d 9; else pad week 9; fi
            L="${c_ov1}${PADDED}${RST}${VP}"
            if [[ -n "$SEVEN_LEFT" ]]; then
                fmt_at "$SEVEN_RESET" "%a %H:%M"; rel "$SEVEN_LEFT"
                L+="${c_ov2}   resets ${D} · ${R}"
                [[ -z "$FIVE_PCT" && -n "$BUDGET" ]] && L+=" · ${BUDGET}"
                L+="${RST}"
            fi
            emit "$L"
        fi
    fi
    ;;

xlarge-simple)
    ledger_head dirty; emit "$LH"
    ledger_where costtime; emit "$LW"
    grad ctx "$CTX_PCT"; vpad "${E}[38;2;${G}m" "$CTX_PCT"; pad context 10
    FREE_K=$(( (CTX_SIZE - CTX_TOK) / 1000 )); (( FREE_K < 0 )) && FREE_K=0
    emit "${c_ov1}${PADDED}${RST}${VP}${c_ov2}   ${TOK_K} / $(( CTX_SIZE / 1000 ))k used · ${FREE_K}k free${RST}"
    if [[ -z "$HAS_RL" ]]; then
        pad "5h limit" 10; emit "${c_ov1}${PADDED}${RST}${DASH}   $LOADING"
        pad "7d limit" 10; emit "${c_ov1}${PADDED}${RST}${DASH}   $LOADING"
    else
        if [[ -n "$FIVE_PCT" ]]; then
            pace_col "$FIVE_PCT" "$FIVE_LEFT" 18000; vpad "$PC" "$FIVE_PCT"; pad "5h limit" 10
            L="${c_ov1}${PADDED}${RST}${VP}"
            if [[ -n "$FIVE_LEFT" ]]; then rel "$FIVE_LEFT"; fmt_ampm "$FIVE_RESET"; L+="${c_ov2}   resets in ${R} (${D}) · ${FIVE_EL}% elapsed${RST}"; fi
            emit "$L"
        fi
        if [[ -n "$SEVEN_PCT" ]]; then
            pace_col "$SEVEN_PCT" "$SEVEN_LEFT" 604800; vpad "$PC" "$SEVEN_PCT"
            if [[ -n "$FIVE_PCT" ]]; then pad "7d limit" 10; else pad weekly 10; fi
            L="${c_ov1}${PADDED}${RST}${VP}"
            if [[ -n "$SEVEN_LEFT" ]]; then
                rel "$SEVEN_LEFT"; fmt_long "$SEVEN_RESET"
                L+="${c_ov2}   resets ${D} (in ${R}) · ${SEVEN_EL}% elapsed"
                [[ -z "$FIVE_PCT" && -n "$BUDGET" ]] && L+=" · ${BUDGET}"
                L+="${RST}"
            fi
            emit "$L"
        fi
    fi
    ;;

*)  # large
    ident full thinking
    git_seg; env_seg; style_seg; branch_seg ab
    join_sep "$ID" "$GS" "$ES" "$SS"; emit "$J"
    join_sep "${i_dir}${c_sub0}${DIR_SHOW}${RST}${BS}" "${i_cost}${c_yellow}${COST_FMT}${RST}" "${i_time}${c_sub0}${DUR}${RST}"; emit "$J"
    bar ctx "$CTX_PCT" 20; pctv ctx "$CTX_PCT"; pad Context 10
    emit "${i_ctx}${c_pink}${PADDED}${RST}$BAR $PV${c_ov2}  ${TOK_K}/${SIZE_K}${RST}"
    if [[ -z "$HAS_RL" ]]; then
        bar 5h 0 20; pad "Usage 5H" 10; emit "${i_5h}${c_lav}${PADDED}${RST}$BAR$DASH  $LOADING"
        bar 7d 0 20; pad "Usage 7D" 10; emit "${i_7d}${c_yellow}${PADDED}${RST}$BAR$DASH  $LOADING"
    else
        if [[ -n "$FIVE_PCT" ]]; then
            bar 5h "$FIVE_PCT" 20; pctv 5h "$FIVE_PCT"; pad "Usage 5H" 10
            L="${i_5h}${c_lav}${PADDED}${RST}$BAR $PV"
            if [[ -n "$FIVE_LEFT" ]]; then rel "$FIVE_LEFT"; fmt_at "$FIVE_RESET" "%H:%M"; L+="${c_ov2}  resets in ${R} · ${D}${RST}"; fi
            emit "$L"
        fi
        if [[ -n "$SEVEN_PCT" ]]; then
            bar 7d "$SEVEN_PCT" 20; pctv 7d "$SEVEN_PCT"
            if [[ -n "$FIVE_PCT" ]]; then pad "Usage 7D" 10; else pad Weekly 10; fi
            L="${i_7d}${c_yellow}${PADDED}${RST}$BAR $PV"
            if [[ -n "$SEVEN_LEFT" ]]; then
                fmt_at "$SEVEN_RESET" "%a %H:%M"; rel "$SEVEN_LEFT"
                L+="${c_ov2}  resets ${D} · ${R}"
                [[ -z "$FIVE_PCT" && -n "$BUDGET" ]] && L+=" · ≈${BUDGET}"
                L+="${RST}"
            fi
            emit "$L"
        fi
    fi
    ;;
esac

for L in "${LINES[@]}"; do
    printf '%s%s\n' "$L" "$CLR"
done
