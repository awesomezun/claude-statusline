#!/usr/bin/env python3
"""Render the `large` preset across popular monospace fonts.

Generates docs/fonts.html (captured to assets/fonts-demo.png) so users can see
how the statusline looks in a curated set of cross-platform webfonts plus two
common terminal defaults.
"""
import sys, re, html as H, os, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
os.chdir(ROOT)
sys.dont_write_bytecode = True  # keep docs/ free of __pycache__ from the import below
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _demo import render as _render  # noqa: E402

ANSI = re.compile(r'(\x1b\[[0-9;]*m)')
CUSTOM_BLOCKS = {
    "█": "full",
    "░": "shade-light",
    "▒": "shade-medium",
    "▓": "shade-dark",
}


def render(preset: str) -> str:
    return _render(preset)


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


LARGE = "".join(f'<div class="row">{ansi_to_html(ln)}</div>'
                for ln in render("large").rstrip("\n").split("\n"))

# (display name, css font-family, note, google_query | None, local_face | None)
FONTS = [
    # — cross-platform webfonts (Google Fonts) —
    ("JetBrains Mono",  "'JetBrains Mono'",  "Google Fonts · repo default", "JetBrains+Mono", None),
    ("Fira Code",       "'Fira Code'",       "Google Fonts · ligatures", "Fira+Code", None),
    ("Cascadia Code",   "'Cascadia Code'",   "Google Fonts · Windows Terminal", "Cascadia+Code", None),
    ("Source Code Pro", "'Source Code Pro'", "Google Fonts · Adobe", "Source+Code+Pro", None),
    ("IBM Plex Mono",   "'IBM Plex Mono'",   "Google Fonts · IBM", "IBM+Plex+Mono", None),
    ("Roboto Mono",     "'Roboto Mono'",     "Google Fonts · Google", "Roboto+Mono", None),
    ("Ubuntu Mono",     "'Ubuntu Mono'",     "Google Fonts · Ubuntu default", "Ubuntu+Mono", None),
    ("Inconsolata",     "'Inconsolata'",     "Google Fonts · classic", "Inconsolata", None),
    ("Space Mono",      "'Space Mono'",      "Google Fonts · geometric", "Space+Mono", None),
    ("Geist Mono",      "'Geist Mono'",      "Google Fonts · modern UI mono", "Geist+Mono", None),
    # — terminal defaults / popular local terminal fonts —
    ("Menlo",           "Menlo",             "macOS · VS Code default", None, None),
    ("MesloLGS Nerd Font", "'MesloLGS Nerd Font'", "Powerlevel10k / oh-my-zsh", None, None),
]

links = "\n".join(
    f'<link href="https://fonts.googleapis.com/css2?family={q}:wght@400;700&display=swap" rel="stylesheet">'
    for *_, q, _f in FONTS if q
)
font_faces = "".join(
    f"@font-face{{font-family:'{name}';font-weight:400;src:url('file://{face}-Regular.ttf')}}"
    f"@font-face{{font-family:'{name}';font-weight:700;src:url('file://{face}-Bold.ttf')}}"
    for name, *_rest, face in FONTS if face
)
font_faces_block = f"  {font_faces}\n" if font_faces else ""

def make_cards(items, start):
    return "\n".join(
        f'''  <div class="card">
    <div class="fname">{i+start+1}. {name} <span class="src">{note}</span></div>
    <div class="term" style="font-family:{fam},'Apple Color Emoji',monospace">{LARGE}</div>
  </div>'''
        for i, (name, fam, note, _q, _f) in enumerate(items)
    )


N_GOOGLE = sum(1 for *_, q, _f in FONTS if q)
cards_google = make_cards(FONTS[:N_GOOGLE], 0)
cards_system = make_cards(FONTS[N_GOOGLE:], N_GOOGLE)

HTML = f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
{links}
<style>
{font_faces_block}\
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{background:radial-gradient(900px 500px at 50% -10%,#25253a,#181825 60%,#11111b);
    color:#cdd6f4;font-family:-apple-system,"Segoe UI",sans-serif;padding:48px 24px}}
  .wrap{{max-width:1080px;margin:0 auto}}
  h1{{text-align:center;font-size:30px;font-weight:800;letter-spacing:-.5px;margin-bottom:8px}}
  h1 .s{{color:#fab387}}
  p.sub{{text-align:center;color:#a6adc8;font-size:15px;margin-bottom:30px}}
  p.sub code{{color:#94e2d5}}
  .group{{text-align:center;text-transform:uppercase;letter-spacing:2px;font-size:12px;
    color:#6c7086;margin:34px 0 14px}}
  .card{{background:#181825;border:1px solid #313244;border-radius:14px;overflow:hidden;
    margin-bottom:16px;box-shadow:0 14px 40px -22px rgba(0,0,0,.7)}}
  .fname{{padding:11px 16px;font-weight:700;font-size:13.5px;color:#cba6f7;
    border-bottom:1px solid #313244}}
  .fname .src{{color:#6c7086;font-weight:500;font-size:12px;margin-left:6px}}
  .term{{background:#1e1e2e;padding:10px 16px;font-size:13.5px;line-height:1.42;
    white-space:pre;overflow-x:auto}}
  .term .row{{display:block}}
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
</style></head><body>
<div class="wrap">
  <h1><span class="s">⚡</span> Awesome Statusline — one preset, many fonts</h1>
  <p class="sub">The <code>large</code> preset, same data, only the font changes. It's font-agnostic — it just uses your terminal's font.</p>
  <div class="group">Cross-platform webfonts (Google Fonts)</div>
{cards_google}
  <div class="group">Terminal defaults</div>
{cards_system}
</div></body></html>
'''

(ROOT / "docs" / "fonts.html").write_text(HTML, encoding="utf-8")
print("wrote docs/fonts.html with", len(FONTS), "fonts")
