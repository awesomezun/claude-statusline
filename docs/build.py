#!/usr/bin/env python3
"""Generate docs/index.html from the REAL statusline output.

Runs each preset script with a representative mock payload, captures the
truecolor ANSI it prints, and converts that to HTML — so gradients and exact
colors match the terminal pixel-for-pixel instead of being hand-approximated.
"""
import subprocess, re, html as H, os, pathlib, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
os.chdir(ROOT)
_BRANCH = subprocess.run(["git", "branch", "--show-current"],
                         capture_output=True, text=True).stdout.strip()

# Representative session (mirrors a real 1M-context Opus run)
_now = int(time.time())
MOCK = (
    '{"model":{"display_name":"Opus 4.8"},'
    '"workspace":{"current_dir":"%s"},'
    '"context_window":{"context_window_size":1000000,'
    '"current_usage":{"input_tokens":320000,"output_tokens":28000,'
    '"cache_creation_input_tokens":0,"cache_read_input_tokens":0}},'
    '"cost":{"total_cost_usd":25.29,"total_duration_ms":18960000},'
    '"output_style":{"name":"explanatory"},'
    '"effort":{"level":"xhigh"},"thinking":{"enabled":true},'
    '"rate_limits":{"five_hour":{"used_percentage":34,"resets_at":%d},'
    '"seven_day":{"used_percentage":65,"resets_at":%d}}}'
) % (str(ROOT), _now + 16560, _now + 230400)

PRESETS = [
    ("xsmall", "xs", "2 lines", "minimal"),
    ("small", "s", "2 lines", "labels + %"),
    ("medium", "m", "4 lines", "classic"),
    ("large", "l", "5 lines", "cost · time · 20-block bars"),
    ("xlarge", "xl", "5 lines · full", "git ↑↓ · env · 40-block bars · resets"),
]

ANSI = re.compile(r'(\x1b\[[0-9;]*m)')
CUSTOM_BLOCKS = {
    "█": "full",
    "░": "shade-light",
    "▒": "shade-medium",
    "▓": "shade-dark",
}


def render(size: str) -> str:
    p = subprocess.run(["bash", f"scripts/awesome-statusline-{size}.sh"],
                       input=MOCK, capture_output=True, text=True)
    # hide the real (personal) path in screenshots
    out = p.stdout.replace(str(ROOT), "~/cc/awesome-statusline")
    out = out.replace(os.path.expanduser("~"), "~").replace("kang", "you")
    if _BRANCH and _BRANCH != "main":
        out = out.replace(_BRANCH, "main")
    return out


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


def preset_rows(size: str) -> str:
    raw = render(size).rstrip("\n")
    lines = [ln for ln in raw.split("\n")]
    return "".join(f'<div class="row">{ansi_to_html(ln)}</div>' for ln in lines)


def card(name, abbr, lines, _desc) -> str:
    return f'''
    <div class="card">
      <div class="card-head"><div class="name">{name} <span class="abbr">({abbr})</span></div><div class="lines">{lines}</div></div>
      <div class="term">
        <div class="term-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div>
        <div class="term-body">{preset_rows(name)}</div>
      </div>
    </div>'''


CARDS = "\n".join(card(*p) for p in PRESETS)

HTML = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Awesome Statusline — for Claude Code</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root{{
    --base:#1e1e2e; --mantle:#181825; --crust:#11111b; --s0:#313244; --s1:#45475a;
    --text:#cdd6f4; --sub:#a6adc8; --over:#6c7086; --teal:#94e2d5; --peach:#fab387;
    --yellow:#f9e2af; --mauve:#cba6f7;
  }}
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    background:radial-gradient(1200px 600px at 50% -10%, #25253a 0%, var(--mantle) 55%, var(--crust) 100%);
    color:var(--text);line-height:1.6;padding:64px 24px;min-height:100vh}}
  .wrap{{max-width:1000px;margin:0 auto}}
  .hero{{text-align:center;margin-bottom:52px}}
  .hero h1{{font-size:54px;font-weight:800;letter-spacing:-1.5px;margin-bottom:14px}}
  .hero h1 .spark{{color:var(--peach)}}
  .hero p.tag{{font-size:19px;color:var(--sub);max-width:680px;margin:0 auto 22px}}
  .hero p.tag b{{color:var(--text)}}
  .badges{{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:18px}}
  .badge{{font-size:12.5px;padding:5px 11px;border-radius:999px;background:var(--s0);color:var(--sub);border:1px solid var(--s1)}}
  .badge.hot{{background:rgba(250,179,135,.14);color:var(--peach);border-color:rgba(250,179,135,.3)}}
  .badge.cool{{background:rgba(148,226,213,.12);color:var(--teal);border-color:rgba(148,226,213,.28)}}
  .section-title{{font-size:14px;text-transform:uppercase;letter-spacing:2px;color:var(--over);text-align:center;margin:48px 0 22px}}
  .grid{{display:flex;flex-direction:column;gap:22px}}
  .card{{background:var(--mantle);border:1px solid var(--s0);border-radius:16px;overflow:hidden;box-shadow:0 18px 50px -20px rgba(0,0,0,.7)}}
  .card-head{{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--s0)}}
  .card-head .name{{font-weight:700;font-size:15px}}
  .card-head .name .abbr{{color:var(--over);font-weight:500}}
  .card-head .lines{{font-size:12px;color:var(--over);background:var(--s0);padding:3px 9px;border-radius:999px}}
  .term{{background:var(--base)}}
  .term-bar{{display:flex;gap:7px;padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.04)}}
  .dot{{width:11px;height:11px;border-radius:50%}}
  .dot.r{{background:#f38ba8}}.dot.y{{background:#f9e2af}}.dot.g{{background:#a6e3a1}}
  .term-body{{font-family:"JetBrains Mono",Menlo,Consolas,monospace,"Apple Color Emoji","Noto Color Emoji";
    font-size:13.5px;line-height:1.42;padding:12px 18px;white-space:pre;overflow-x:auto}}
  .term-body .row{{display:block}}
  .cg{{display:inline-block;width:1ch;height:1.02em;vertical-align:-.12em;
    background-color:currentColor;background-repeat:repeat;background-position:0 0;
    image-rendering:pixelated}}
  .cg-full{{background-color:currentColor}}
  .cg-shade-light{{background-color:currentColor;
    -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2' viewBox='0 0 2 2'%3E%3Crect width='1' height='1' fill='black'/%3E%3C/svg%3E");
    mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2' viewBox='0 0 2 2'%3E%3Crect width='1' height='1' fill='black'/%3E%3C/svg%3E");
    -webkit-mask-size:2px 2px;mask-size:2px 2px;
    -webkit-mask-repeat:repeat;mask-repeat:repeat}}
  .cg-shade-medium{{background-color:currentColor;
    -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2' viewBox='0 0 2 2'%3E%3Crect width='1' height='1' fill='black'/%3E%3Crect x='1' y='1' width='1' height='1' fill='black'/%3E%3C/svg%3E");
    mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2' viewBox='0 0 2 2'%3E%3Crect width='1' height='1' fill='black'/%3E%3Crect x='1' y='1' width='1' height='1' fill='black'/%3E%3C/svg%3E");
    -webkit-mask-size:2px 2px;mask-size:2px 2px;
    -webkit-mask-repeat:repeat;mask-repeat:repeat}}
  .cg-shade-dark{{background-color:currentColor;
    -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2' viewBox='0 0 2 2'%3E%3Crect width='2' height='1' fill='black'/%3E%3Crect y='1' width='1' height='1' fill='black'/%3E%3C/svg%3E");
    mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2' viewBox='0 0 2 2'%3E%3Crect width='2' height='1' fill='black'/%3E%3Crect y='1' width='1' height='1' fill='black'/%3E%3C/svg%3E");
    -webkit-mask-size:2px 2px;mask-size:2px 2px;
    -webkit-mask-repeat:repeat;mask-repeat:repeat}}
  .why{{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:8px}}
  @media(max-width:680px){{.why{{grid-template-columns:1fr}}.hero h1{{font-size:40px}}}}
  .why .item{{background:var(--mantle);border:1px solid var(--s0);border-radius:14px;padding:18px 20px}}
  .why .item h3{{font-size:15px;margin-bottom:6px;display:flex;align-items:center;gap:8px}}
  .why .item p{{font-size:13.5px;color:var(--sub)}}
  .install{{background:var(--crust);border:1px solid var(--s0);border-radius:14px;padding:18px 20px;margin-top:10px;font-family:"JetBrains Mono",monospace;font-size:13px;color:#a6e3a1;overflow-x:auto}}
  .install .c{{color:var(--over)}}
  footer{{text-align:center;color:var(--over);font-size:13px;margin-top:60px}}
  footer b{{color:var(--mauve)}}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <h1><span class="spark">⚡</span> Awesome Statusline</h1>
    <p class="tag">A beautiful statusline for Claude Code — <b>context</b>, <b>usage limits</b>, <b>cost</b> &amp; reasoning <b style="color:var(--peach)">⚡effort</b>, all at a glance. One line to install on macOS, Linux &amp; Windows.</p>
    <div class="badges">
      <span class="badge hot">⚡ effort · 💡 thinking</span>
      <span class="badge cool">macOS · Linux · Windows</span>
      <span class="badge">no Node · no Nerd Font</span>
      <span class="badge">Catppuccin</span>
      <span class="badge">5 presets</span>
    </div>
  </div>

  <div class="section-title">Five presets · one word picks how much you see</div>
  <div class="grid">{CARDS}
  </div>

  <div class="section-title">Why this one</div>
  <div class="why">
    <div class="item"><h3>⚡ <span>Effort &amp; thinking</span></h3><p>Surfaces <b style="color:var(--peach)">/effort</b> (high · xhigh · max) and <b style="color:var(--yellow)">extended thinking</b> — live, from Claude Code's official JSON.</p></div>
    <div class="item"><h3>🖥️ <span>Truly cross-platform</span></h3><p>macOS, Linux, and Windows. On Windows the installer sets up Git Bash for you, so the same script just runs.</p></div>
    <div class="item"><h3>📦 <span>Zero setup</span></h3><p>No Node. No Nerd Font. The installer auto-installs <code>jq</code> via your system's package manager. Every glyph is a plain emoji.</p></div>
    <div class="item"><h3>📐 <span>Five presets</span></h3><p>Pick how much you see with one word — <code>xs</code> to <code>xl</code>. No wizard, no config files. Re-run to switch.</p></div>
  </div>

  <div class="section-title">Install</div>
  <div class="install"><span class="c"># macOS / Linux</span>
curl -fsSL https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.sh | bash

<span class="c"># Windows (PowerShell)</span>
irm https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.ps1 | iex
</div>

  <footer>Built with 🩵 for the Claude Code community · <b>Catppuccin</b> theme · MIT License</footer>
</div>
</body>
</html>
'''

(ROOT / "docs" / "index.html").write_text(HTML, encoding="utf-8")
print("wrote docs/index.html")
# quick visibility: show the rendered xlarge lines (ANSI stripped)
xl = render("xlarge")
print("--- xlarge sample (text) ---")
print(re.sub(r"\x1b\[[0-9;]*m|\x1b\[K", "", xl))
