"""Shared mock session for the docs builders (build.py, build_fonts.py).

Runs the REAL renderer (scripts/awesome-statusline.sh) against a fixed mock
payload and a throwaway git repo with a known state (2 staged, 3 modified,
1 untracked, 1 commit ahead), so screenshots are reproducible and never show
the maintainer's own paths or working-tree state.
"""
import atexit
import json
import os
import pathlib
import re
import shutil
import subprocess
import tempfile
import html as H
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
RENDERER = ROOT / "scripts" / "awesome-statusline.sh"
SHOW_PATH = "~/cc/awesome-statusline"

_GIT = ["git", "-c", "user.name=demo", "-c", "user.email=demo@example.com",
        "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main"]


def _git(cwd, *args):
    subprocess.run([*_GIT, *args], cwd=cwd, check=True, capture_output=True)


def _make_demo_repo() -> pathlib.Path:
    base = pathlib.Path(tempfile.mkdtemp(prefix="awesome-statusline-demo-"))
    atexit.register(shutil.rmtree, base, ignore_errors=True)
    remote, work = base / "remote.git", base / "awesome-statusline"
    _git(base, "init", "-q", "--bare", str(remote))
    _git(base, "init", "-q", str(work))
    for name in "abcdef":
        (work / f"{name}.txt").write_text(name + "\n")
    _git(work, "add", ".")
    _git(work, "commit", "-q", "-m", "init")
    _git(work, "remote", "add", "origin", str(remote))
    _git(work, "push", "-q", "-u", "origin", "main")
    (work / "a.txt").write_text("a2\n")
    _git(work, "commit", "-q", "-am", "ahead by one")
    for name in ("s1", "s2"):
        (work / f"{name}.txt").write_text(name + "\n")
        _git(work, "add", f"{name}.txt")
    for name in "bcd":
        (work / f"{name}.txt").write_text(name + " changed\n")
    (work / "notes.md").write_text("untracked\n")
    return work


DEMO_REPO = _make_demo_repo()


def _make_demo_config() -> pathlib.Path:
    """A Claude Code config dir whose ~/.claude.json notes an unused free limit reset,
    so the docs show the mark whatever the builder's own account holds."""
    base = pathlib.Path(tempfile.mkdtemp(prefix="awesome-statusline-config-"))
    atexit.register(shutil.rmtree, base, ignore_errors=True)
    now_ms = int(time.time() * 1000)
    (base / ".claude.json").write_text(json.dumps({
        "oauthAccount": {"accountUuid": "demo-account"},
        "unusedLimitResetStatusCache": {"accountUuid": "demo-account", "holdsUnusedReset": True,
                                        "checkedAt": now_ms - 60_000, "validUntil": now_ms + 86_400_000},
    }))
    return base


DEMO_CONFIG = _make_demo_config()


def demo_env(columns: int | None = None) -> dict:
    """The renderer's environment: no venv, 24-bit colour, the demo config; a wide
    terminal unless `columns` says otherwise (the desktop band is about 80)."""
    env = {k: v for k, v in os.environ.items() if k not in ("CONDA_DEFAULT_ENV", "VIRTUAL_ENV", "COLUMNS")}
    if columns is not None:
        env["COLUMNS"] = str(columns)
    env["AWESOME_STATUSLINE_COLOR"] = "truecolor"   # screenshots stay 24-bit even when built inside tmux
    env["CLAUDE_CONFIG_DIR"] = str(DEMO_CONFIG)
    return env


def prompt_cache(now: int, hit: float = 0.92) -> dict:
    """A warm 1h cache: most input read from it, one miss after a tool change."""
    return {"warm": True, "caching_observed": True, "ttl": "1h", "expires_at": now + 42 * 60,
            "requests": 38, "misses": 1, "expected_rebuilds": 0, "hit_ratio": hit,
            "cache_write_tokens": 412000, "miss_recache_tokens": 186000, "last_miss_at": now - 3000,
            "last_miss_cause": {"causes": ["tools_changed"], "tools_added": 1, "tools_removed": 0},
            "miss_causes": {"tools_changed": 1}, "recache_tokens_if_cold": 320000}


def mock(plan: str = "pro") -> str:
    """A representative 1M-context Fable 5.2 session. plan: 'pro' (5H + 7D) or 'ultra' (weekly only)."""
    # +30 s so every card of one build shows the same whole-minute countdown
    now = int(time.time()) + 30
    if plan == "ultra":
        limits = {"seven_day": {"used_percentage": 48, "resets_at": now + 2 * 86400 + 10 * 3600}}
    else:
        limits = {"five_hour": {"used_percentage": 34, "resets_at": now + 2 * 3600 + 10 * 60},
                  "seven_day": {"used_percentage": 65, "resets_at": now + 2 * 86400 + 14 * 3600}}
    return json.dumps({
        "model": {"id": "claude-fable-5-2", "display_name": "Fable 5.2"},
        "workspace": {"current_dir": str(DEMO_REPO)},
        "context_window": {"context_window_size": 1000000,
                           "current_usage": {"input_tokens": 4000, "output_tokens": 28000,
                                             "cache_creation_input_tokens": 12000, "cache_read_input_tokens": 304000}},
        "cost": {"total_cost_usd": 25.29, "total_duration_ms": 18960000},
        "output_style": {"name": "explanatory"},
        "effort": {"level": "xhigh"},
        "thinking": {"enabled": True},
        "rate_limits": limits,
        "prompt_cache": prompt_cache(now),
    })


def render(preset: str, plan: str = "pro") -> str:
    p = subprocess.run(["bash", str(RENDERER), preset], input=mock(plan),
                       capture_output=True, text=True, env=demo_env())
    out = p.stdout.replace(str(DEMO_REPO), SHOW_PATH)
    return re.sub(r"\x1b\[K", "", out)


def render_payload(preset: str, payload: dict, columns: int | None = None) -> str:
    """The renderer's output for a payload of one's own (the reels vary it frame by frame)."""
    data = {"workspace": {"current_dir": str(DEMO_REPO)}, **payload}
    p = subprocess.run(["bash", str(RENDERER), preset], input=json.dumps(data),
                       capture_output=True, text=True, env=demo_env(columns))
    out = p.stdout.replace(str(DEMO_REPO), SHOW_PATH)
    return re.sub(r"\x1b\[K", "", out)


# ANSI -> HTML, shared by build.py, build_fonts.py and reels.py.
ANSI = re.compile(r'(\x1b\[[0-9;]*m)')
CUSTOM_BLOCKS = {
    "█": "full",
    "░": "shade-light",
    "▒": "shade-medium",
    "▓": "shade-dark",
}


def ansi_to_html(s: str) -> str:
    color = None
    bold = False
    out = []
    pending_block = None

    def style_attr(extra=None, use_color=None, use_bold=None):
        use_color = color if use_color is None else use_color
        use_bold = bold if use_bold is None else use_bold
        st = []
        if use_color:
            st.append(f"color:rgb({use_color[0]},{use_color[1]},{use_color[2]})")
        if use_bold:
            st.append("font-weight:700")
        if extra:
            st.extend(extra)
        return f' style="{";".join(st)}"' if st else ""

    def flush_block():
        nonlocal pending_block
        if not pending_block:
            return
        cls, block_color, block_bold, count = pending_block
        width = f"width:{count}ch" if count > 1 else None
        extra = [width] if width else None
        out.append(
            f'<span class="cg cg-{cls}"'
            f'{style_attr(extra, block_color, block_bold)}></span>'
        )
        pending_block = None

    def text_span(txt):
        flush_block()
        return f"<span{style_attr()}>{H.escape(txt)}</span>"

    def queue_block(ch):
        nonlocal pending_block
        cls = CUSTOM_BLOCKS[ch]
        key = (cls, color, bold)
        if pending_block and pending_block[:3] == key:
            pending_block = (*key, pending_block[3] + 1)
        else:
            flush_block()
            pending_block = (*key, 1)

    def emit_text(txt):
        buf = []
        for ch in txt:
            if ch in CUSTOM_BLOCKS:
                if buf:
                    out.append(text_span("".join(buf)))
                    buf.clear()
                queue_block(ch)
            else:
                buf.append(ch)
        if buf:
            out.append(text_span("".join(buf)))

    for tok in ANSI.split(s):
        if tok.startswith("\x1b["):
            codes = tok[2:-1].split(";")
            j = 0
            while j < len(codes):
                c = codes[j] or "0"
                if c == "0":
                    color = None
                    bold = False
                elif c == "1":
                    bold = True
                elif c == "38" and j + 2 < len(codes) and codes[j + 1] == "2":
                    color = (int(codes[j + 2]), int(codes[j + 3]), int(codes[j + 4]))
                    j += 4
                j += 1
        elif tok:
            txt = tok.replace("\x1b[K", "").replace("\r", "")
            if txt:
                emit_text(txt)
    flush_block()
    return "".join(out)


# The block glyphs of the bars, drawn as pixels so every font shows them alike (build.py keeps its own copy).
CG_CSS = """
  .cg{display:inline-block;width:1ch;height:1.02em;vertical-align:-.12em;
    background-color:currentColor;background-repeat:repeat;background-position:0 0;
    image-rendering:pixelated}
  .cg-full{background-color:currentColor}
  .cg-shade-light{background-color:currentColor;
    -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2' viewBox='0 0 2 2'%3E%3Crect width='1' height='1' fill='black'/%3E%3C/svg%3E");
    mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2' viewBox='0 0 2 2'%3E%3Crect width='1' height='1' fill='black'/%3E%3C/svg%3E");
    -webkit-mask-size:2px 2px;mask-size:2px 2px;
    -webkit-mask-repeat:repeat;mask-repeat:repeat}
  .cg-shade-medium{background-color:currentColor;
    -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2' viewBox='0 0 2 2'%3E%3Crect width='1' height='1' fill='black'/%3E%3Crect x='1' y='1' width='1' height='1' fill='black'/%3E%3C/svg%3E");
    mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2' viewBox='0 0 2 2'%3E%3Crect width='1' height='1' fill='black'/%3E%3Crect x='1' y='1' width='1' height='1' fill='black'/%3E%3C/svg%3E");
    -webkit-mask-size:2px 2px;mask-size:2px 2px;
    -webkit-mask-repeat:repeat;mask-repeat:repeat}
  .cg-shade-dark{background-color:currentColor;
    -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2' viewBox='0 0 2 2'%3E%3Crect width='2' height='1' fill='black'/%3E%3Crect y='1' width='1' height='1' fill='black'/%3E%3C/svg%3E");
    mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2' viewBox='0 0 2 2'%3E%3Crect width='2' height='1' fill='black'/%3E%3Crect y='1' width='1' height='1' fill='black'/%3E%3C/svg%3E");
    -webkit-mask-size:2px 2px;mask-size:2px 2px;
    -webkit-mask-repeat:repeat;mask-repeat:repeat}
"""
