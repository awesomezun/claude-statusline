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


def mock(plan: str = "pro") -> str:
    """A representative 1M-context Opus 5.5 session. plan: 'pro' (5H + 7D) or 'ultra' (weekly only)."""
    # +30 s so every card of one build shows the same whole-minute countdown
    now = int(time.time()) + 30
    if plan == "ultra":
        limits = {"seven_day": {"used_percentage": 48, "resets_at": now + 2 * 86400 + 10 * 3600}}
    else:
        limits = {"five_hour": {"used_percentage": 34, "resets_at": now + 2 * 3600 + 10 * 60},
                  "seven_day": {"used_percentage": 65, "resets_at": now + 2 * 86400 + 14 * 3600}}
    return json.dumps({
        "model": {"display_name": "Opus 5.5"},
        "workspace": {"current_dir": str(DEMO_REPO)},
        "context_window": {"context_window_size": 1000000,
                           "current_usage": {"input_tokens": 320000, "output_tokens": 28000,
                                             "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0}},
        "cost": {"total_cost_usd": 25.29, "total_duration_ms": 18960000},
        "output_style": {"name": "explanatory"},
        "effort": {"level": "xhigh"},
        "thinking": {"enabled": True},
        "rate_limits": limits,
    })


def render(preset: str, plan: str = "pro") -> str:
    env = {k: v for k, v in os.environ.items() if k not in ("CONDA_DEFAULT_ENV", "VIRTUAL_ENV")}
    env["AWESOME_STATUSLINE_COLOR"] = "truecolor"   # screenshots stay 24-bit even when built inside tmux
    p = subprocess.run(["bash", str(RENDERER), preset], input=mock(plan),
                       capture_output=True, text=True, env=env)
    out = p.stdout.replace(str(DEMO_REPO), SHOW_PATH)
    return re.sub(r"\x1b\[K", "", out)
