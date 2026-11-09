#!/usr/bin/env python3
"""Make the README's reels: short animated WebPs drawn from the REAL renderer
(scripts/awesome-statusline.sh) and the mod's own cockpit drawing code, over a
made-up session (no one's real projects, paths or accounts).

    python3 docs/reels.py [terminal] [desktop] [cockpit] [presets]   (none: all four)

Writes assets/reels/
  terminal.webp  a Claude Code session at work, the large preset under the prompt
  desktop.webp   the band above the prompt in the desktop app, then /cockpit
  cockpit.webp   the cluster and the dashboard, dark beside light, dials moving
  presets.webp   the five sizes, then the -plain and -simple styles

Needs Python Playwright with Chromium, Pillow with WebP, and npx (it bundles
docs/cockpit.ts with esbuild for the cockpit frames).
"""
import asyncio
import html as H
import io
import json
import pathlib
import subprocess
import sys
import tempfile
import time

sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _demo import CG_CSS, ROOT, ansi_to_html, prompt_cache, render, render_payload  # noqa: E402

from PIL import Image  # noqa: E402
from playwright.async_api import async_playwright  # noqa: E402

OUT = ROOT / "assets" / "reels"
NOW = int(time.time())
FIVE_RESET = NOW + 2 * 3600 + 10 * 60 + 30
SEVEN_RESET = NOW + 2 * 86400 + 14 * 3600 + 30


def session(ctx_k: int, five: int, seven: int, minutes: int) -> dict:
    """The mock session at one moment: context in thousands of tokens, both limits in %, the session's age."""
    return {
        "model": {"id": "claude-fable-5-2", "display_name": "Fable 5.2"},
        "context_window": {"context_window_size": 1_000_000,
                           "current_usage": {"input_tokens": 3000, "output_tokens": 0,
                                             "cache_creation_input_tokens": 9000, "cache_read_input_tokens": ctx_k * 1000 - 12000}},
        "cost": {"total_duration_ms": minutes * 60_000},
        "output_style": {"name": "explanatory"},
        "effort": {"level": "xhigh"},
        "thinking": {"enabled": True},
        "rate_limits": {"five_hour": {"used_percentage": five, "resets_at": FIVE_RESET},
                        "seven_day": {"used_percentage": seven, "resets_at": SEVEN_RESET}},
        # the cache warms up as the session goes on
        "prompt_cache": {**prompt_cache(NOW), "hit_ratio": min(0.93, 0.80 + (minutes - 62) * 0.026),
                         "recache_tokens_if_cold": ctx_k * 1000},
    }


def rows(ansi: str) -> str:
    return "".join(f'<div class="row">{ansi_to_html(ln)}</div>' for ln in ansi.rstrip("\n").split("\n"))


# One session's climb, frame by frame: (context k, 5H %, 7D %, minutes).
CLIMB = [(180, 21, 63, 62), (214, 23, 63, 63), (262, 26, 64, 64), (318, 29, 64, 65), (371, 32, 65, 66), (402, 34, 65, 67)]

FONT_LINK = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
             '<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">')
MONO = '"JetBrains Mono",Menlo,Consolas,monospace,"Apple Color Emoji","Noto Color Emoji"'
SANS = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif'

BASE_CSS = f"""
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:transparent;font-family:{SANS};padding:20px}}
.frame{{display:inline-block;margin:0 0 20px}}
.stage{{padding:34px;border-radius:26px;
  background:radial-gradient(90% 120% at 0% 0%,#3d2c63 0%,rgba(61,44,99,0) 60%),
             radial-gradient(90% 120% at 100% 100%,#173a5e 0%,rgba(23,58,94,0) 60%),#141420}}
.row{{display:block}}
{CG_CSS}
"""

# ---------------------------------------------------------------- terminal

TERM_CSS = f"""
.win{{width:820px;background:#1e1e2e;border:1px solid #313244;border-radius:14px;overflow:hidden;
  box-shadow:0 34px 80px -24px rgba(0,0,0,.75)}}
.bar{{display:flex;align-items:center;gap:8px;padding:12px 14px;background:#181825;border-bottom:1px solid #313244}}
.dot{{width:12px;height:12px;border-radius:50%}}.r{{background:#f38ba8}}.y{{background:#f9e2af}}.g{{background:#a6e3a1}}
.bar .t{{flex:1;text-align:center;color:#7f849c;font-size:12.5px;margin-right:52px}}
.tb{{font-family:{MONO};font-size:14px;line-height:1.5;padding:16px 22px 16px;white-space:pre;color:#cdd6f4}}
.conv{{height:{11 * 21}px;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden}}
.you{{color:#a6adc8;background:#313244;border-radius:4px;padding:0 6px;margin-left:-6px;display:inline-block}}
.dotc{{color:#a6e3a1}}.say{{color:#cdd6f4}}.dim{{color:#7f849c}}.tool{{color:#cdd6f4;font-weight:700}}
.spin{{color:#fab387}}
.prompt{{border-top:1px solid #45475a;border-bottom:1px solid #45475a;margin:10px 0 8px;padding:6px 0;color:#cdd6f4}}
.cur{{display:inline-block;width:.6em;height:1.1em;vertical-align:-.2em;background:#cdd6f4;opacity:.85}}
"""

CONV = [
    '<div><span class="you">&gt; add rate limiting to the public API</span></div>',
    '<div> </div>',
    '<div><span class="dotc">●</span> <span class="say">I\'ll put a token-bucket limiter in front of the API routes.</span></div>',
    '<div><span class="dotc">●</span> <span class="tool">Read</span><span class="dim">(src/api/routes.ts)</span></div>'
    '<div class="dim">  ⎿  Read 212 lines</div>',
    '<div><span class="dotc">●</span> <span class="tool">Update</span><span class="dim">(src/api/limits.ts)</span></div>'
    '<div class="dim">  ⎿  Added 42 lines</div>',
    '<div><span class="dotc">●</span> <span class="tool">Bash</span><span class="dim">(npm test)</span></div>'
    '<div class="dim">  ⎿  48 passed</div>',
    '<div><span class="dotc">●</span> <span class="say">Done: 100 requests a minute per key, with a Retry-After header.</span></div>',
]
SPIN = [(4, "0.3k"), (9, "1.1k"), (15, "2.4k"), (23, "3.9k"), (31, "5.2k"), None]


def terminal_frames() -> list[str]:
    out = []
    for i, (ctx, five, seven, mins) in enumerate(CLIMB):
        conv = "".join(CONV[: 2 + i])
        if SPIN[i] is not None:
            s, tok = SPIN[i]
            conv += f'<div class="spin">✻ Thinking… <span class="dim">({s}s · ↓ {tok} tokens · esc to interrupt)</span></div>'
        status = rows(render_payload("large", session(ctx, five, seven, mins)))
        out.append(f'''<div class="stage"><div class="win">
  <div class="bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="t">claude — ~/cc/awesome-statusline</span></div>
  <div class="tb"><div class="conv">{conv}</div><div class="prompt">&gt; <span class="cur"></span></div>{status}</div>
</div></div>''')
    return out


TERMINAL_MS = [1100, 900, 900, 900, 900, 3200]

# ---------------------------------------------------------------- presets

PRESET_CSS = f"""
.card{{width:820px;background:#181825;border:1px solid #313244;border-radius:16px;overflow:hidden;box-shadow:0 34px 80px -24px rgba(0,0,0,.75)}}
.head{{display:flex;align-items:center;gap:10px;height:50px;padding:0 18px;border-bottom:1px solid #313244;color:#cdd6f4}}
.head b{{font-family:{MONO};font-size:16px}}
.chip{{font-size:12px;color:#a6adc8;background:#313244;padding:3px 10px;border-radius:999px}}
.chip.hot{{color:#fab387;background:rgba(250,179,135,.14)}}
.sp{{flex:1}}
.steps{{display:flex;gap:5px}}.steps i{{width:7px;height:7px;border-radius:50%;background:#45475a}}.steps i.on{{background:#cba6f7}}
.pb{{background:#1e1e2e;height:{5 * 20 + 34}px;display:flex;flex-direction:column;justify-content:center;
  font-family:{MONO};font-size:13.5px;line-height:1.48;padding:0 20px;white-space:pre;color:#cdd6f4}}
"""
PRESETS = [
    ("xsmall", "xs · 2 lines", "emoji"), ("small", "s · 2 lines", "emoji"), ("medium", "m · 4 lines", "emoji"),
    ("large", "l · 5 lines", "emoji"), ("xlarge", "xl · 5 lines", "emoji"),
    ("large-plain", "no emoji", "-plain"), ("large-simple", "text only", "-simple"), ("xsmall-simple", "1 line", "-simple"),
]


def preset_frames() -> list[str]:
    out = []
    for i, (name, note, style) in enumerate(PRESETS):
        steps = "".join(f'<i class="{"on" if j == i else ""}"></i>' for j in range(len(PRESETS)))
        rec = '<span class="chip hot">⭐ recommended</span>' if name == "large" else ""
        out.append(f'''<div class="stage"><div class="card">
  <div class="head"><b>{H.escape(name)}</b><span class="chip">{H.escape(note)}</span><span class="chip">{H.escape(style)}</span>{rec}<span class="sp"></span><span class="steps">{steps}</span></div>
  <div class="pb">{rows(render(name))}</div>
</div></div>''')
    return out


PRESET_MS = [1500] * len(PRESETS)

# ---------------------------------------------------------------- cockpit

def cockpit_data() -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        bundle = pathlib.Path(tmp) / "cockpit.mjs"
        subprocess.run(["npx", "-y", "esbuild@0.24.0", "docs/cockpit.ts", "--bundle", "--platform=node", "--format=esm",
                        f"--outfile={bundle}", "--log-level=warning"], cwd=ROOT, check=True)
        out = subprocess.run(["node", str(bundle), "--frames"], cwd=ROOT, check=True, capture_output=True, text=True)
    return json.loads(out.stdout)


COCKPIT_CSS = """
.pane{box-sizing:content-box}
.pair{display:flex;gap:24px;align-items:stretch}
.pair .pane{box-shadow:0 30px 70px -26px rgba(0,0,0,.8)}
"""


def cockpit_frames(data: dict) -> list[str]:
    out = []
    for view in ("cluster", "dashboard"):
        for k in range(4):
            dark, light = data["frames"][f"{view}-dark"][k], data["frames"][f"{view}-light"][k]
            out.append(f'<div class="stage"><div class="pair">{dark}{light}</div></div>')
    return out


COCKPIT_MS = [650, 650, 650, 1700] * 2

# ---------------------------------------------------------------- desktop

DESK_CSS = f"""
.app{{width:1000px;height:680px;background:#1f1f1e;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;
  box-shadow:0 40px 90px -26px rgba(0,0,0,.8);border:1px solid #333}}
.top{{height:44px;display:flex;align-items:center;gap:8px;padding:0 16px;border-bottom:1px solid #2c2c2b;color:#bdbdb8;font-size:13px}}
.top .ttl{{margin-left:14px;font-weight:600}}
.main{{flex:1;display:flex;min-height:0}}
.chat{{flex:1;display:flex;flex-direction:column;align-items:center;min-width:0;padding:0 22px}}
.col{{width:100%;max-width:664px;flex:1;display:flex;flex-direction:column;min-height:0}}
.msgs{{flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:16px;padding:20px 0 14px;overflow:hidden;color:#e8e6df;font-size:14.5px;line-height:1.55}}
.u{{align-self:flex-end;background:#30302e;border-radius:14px;padding:9px 14px;max-width:80%}}
.u.cmd{{color:#8db4ff;font-family:{MONO};font-size:13.5px}}
.a .tl{{color:#a3a29c;font-family:{MONO};font-size:12.5px}}
.band{{background:#2a2a28;border-radius:14px;padding:10px;margin-bottom:10px}}
.band .in{{background:#1e1e2e;border-radius:8px;padding:10px 14px;font-family:{MONO};font-size:12.5px;line-height:1.5;white-space:pre;color:#cdd6f4;overflow:hidden}}
.box{{border:1px solid #3d3d3a;background:#2a2a28;border-radius:18px;height:54px;display:flex;align-items:center;gap:14px;padding:0 18px;color:#8f8e88;font-size:15px}}
.box .plus{{font-size:22px;color:#cfcdc6}}.box .typed{{color:#e8e6df;font-family:{MONO};font-size:14px}}
.box .typed .cur{{display:inline-block;width:2px;height:1.1em;vertical-align:-.2em;background:#e8e6df;margin-left:1px}}
.foot{{display:flex;justify-content:flex-end;gap:16px;padding:9px 6px 14px;color:#bdbdb8;font-size:13px}}.foot .m{{color:#8f8e88}}
.side{{width:448px;border-left:1px solid #2c2c2b;display:flex;flex-direction:column;background:#0b0d0f}}
.side .h{{height:44px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 16px;color:#e8e6df;font-size:14px;border-bottom:1px solid #1c2024}}
.side .h .x{{color:#8f8e88;font-size:16px}}
.side .body{{flex:1;overflow:hidden;padding:10px 12px}}
.side .pane{{padding:2px 0 !important;box-sizing:content-box}}
"""

CHAT = [
    '<div class="u">why do the API tests fail now and then?</div>',
    '<div class="a">Two tests share one Redis key, so they race. Each test now gets its own prefix.<br>'
    '<span class="tl">● Update(tests/setup.ts) · Added 6 lines</span></div>',
    '<div class="u">add rate limiting to the public API</div>',
    '<div class="a">I\'ll put a token-bucket limiter in front of the API routes.<br>'
    '<span class="tl">● Update(src/api/limits.ts) · Added 42 lines</span><br>'
    '<span class="tl">● Bash(npm test) · 48 passed</span><br>'
    'Done: 100 requests a minute per key, with a Retry-After header.</div>',
]


def desktop_frames(data: dict) -> tuple[list[str], list[int]]:
    frames, ms = [], []

    def app(msgs: str, band: str | None, typed: str | None, side: str | None) -> str:
        box = (f'<span class="plus">+</span><span class="typed">{typed}<span class="cur"></span></span>' if typed is not None
               else '<span class="plus">+</span><span>Type / for commands</span>')
        band_html = f'<div class="band"><div class="in">{band}</div></div>' if band is not None else ""
        side_html = (f'<div class="side"><div class="h"><span>Cockpit</span><span class="x">⤢ &nbsp; ✕</span></div>'
                     f'<div class="body">{side}</div></div>') if side is not None else ""
        return f'''<div class="stage"><div class="app">
  <div class="top"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="ttl">rate-limits</span></div>
  <div class="main"><div class="chat"><div class="col"><div class="msgs">{msgs}</div>{band_html}<div class="box">{box}</div>
  <div class="foot"><span>Fable 5.2 <span class="m">xhigh</span></span><span>Auto</span></div></div></div>{side_html}</div>
</div></div>'''

    chat = "".join(CHAT)
    for i, (ctx, five, seven, mins) in enumerate(CLIMB[2:5]):
        band = rows(render_payload("large", session(ctx, five, seven, mins), columns=80))   # the band's width, as the mod passes it
        frames.append(app(chat, band, "/cockpit" if i == 2 else ("/co" if i == 1 else None), None))
        ms.append([1300, 900, 1100][i])
    opened = chat + '<div class="u cmd">/cockpit</div><div class="a">awesome-statusline-mod: Cockpit opened.</div>'
    for view in ("cluster", "dashboard"):
        for k in range(4):
            frames.append(app(opened, None, None, data["desktop"][view][k]))
            ms.append([700, 600, 600, 1500][k] if view == "cluster" else [600, 600, 600, 2600][k])
    return frames, ms


# ---------------------------------------------------------------- capture

async def shoot(browser, css: str, frames: list[str], scale: float, equalize: str | None = None) -> list[Image.Image]:
    body = "".join(f'<div class="frame" id="f{i}">{f}</div><br>' for i, f in enumerate(frames))
    page_html = f'<!doctype html><html><head><meta charset="utf-8">{FONT_LINK}<style>{BASE_CSS}{css}</style></head><body>{body}</body></html>'
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as fh:
        fh.write(page_html)
        path = pathlib.Path(fh.name)
    page = await browser.new_page(viewport={"width": 1400, "height": 900}, device_scale_factor=scale)
    try:
        await page.goto(path.as_uri(), wait_until="networkidle")
        await page.evaluate("document.fonts.ready")
        if equalize:
            # Every frame the same size: the tallest of these elements sets the height of all.
            await page.evaluate("""sel => { const els = [...document.querySelectorAll(sel)];
                const h = Math.max(...els.map(e => e.offsetHeight)); els.forEach(e => e.style.height = h + 'px') }""", equalize)
        height = await page.evaluate("document.documentElement.scrollHeight")
        await page.set_viewport_size({"width": 1400, "height": height})
        await page.wait_for_timeout(500)
        images = []
        for i in range(len(frames)):
            el = await page.query_selector(f"#f{i} > .stage")
            png = await el.screenshot(omit_background=True)
            images.append(Image.open(io.BytesIO(png)).convert("RGBA"))
        return images
    finally:
        await page.close()
        path.unlink(missing_ok=True)


def save(name: str, images: list[Image.Image], ms: list[int]) -> None:
    size = images[0].size
    assert all(im.size == size for im in images), [im.size for im in images]
    path = OUT / f"{name}.webp"
    images[0].save(path, save_all=True, append_images=images[1:], duration=ms, loop=0,
                   quality=90, method=4)
    print(f"saved assets/reels/{name}.webp  {size[0]}x{size[1]}  {len(images)} frames  {path.stat().st_size // 1024} KB")


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    want = set(sys.argv[1:]) or {"terminal", "desktop", "cockpit", "presets"}
    data = cockpit_data() if want & {"cockpit", "desktop"} else {}
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        if "terminal" in want:
            save("terminal", await shoot(browser, TERM_CSS, terminal_frames(), 2), TERMINAL_MS)
        if "presets" in want:
            save("presets", await shoot(browser, PRESET_CSS, preset_frames(), 2), PRESET_MS)
        if "cockpit" in want:
            cockpit_css = data["css"] + COCKPIT_CSS
            save("cockpit", await shoot(browser, cockpit_css, cockpit_frames(data), 2, equalize=".pair"), COCKPIT_MS)
        if "desktop" in want:
            frames, ms = desktop_frames(data)
            save("desktop", await shoot(browser, data["css"] + TERM_CSS + DESK_CSS, frames, 1.8), ms)
        await browser.close()


asyncio.run(main())
