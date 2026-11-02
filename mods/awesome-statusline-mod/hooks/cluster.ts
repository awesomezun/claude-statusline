// The cockpit drawn as 1top's menu bar, in its light and dark themes: the
// instrument cluster (two dials, the status strip, the odometer and what is
// left of each limit), the dashboard (a radial token chart, the model mix and
// the account cards), and the sections below them. Each returns an SVG
// document 400 wide; pure functions of the model in dash.ts.

import type { Activity, Section, Theme, Trip } from '../types'
import type { Dash, Meter, Period, SessionRow, Texts } from './dash'
import { compactNumber, heatGrid, KIND_NAME, KIND_SHORT, rate, shareText, size, treemap } from './dash'
import type { CockpitView } from './gauges'
import { countdown } from './gauges'

// ---------------------------------------------------------------- themes

const DARK = {
  bg: '#0b0d0f',
  panel: '#121518',
  panel2: '#161a1e',
  ink: '#e9ebef',
  muted: '#9aa5ae',
  dim: '#5b6670',
  line: '#23292e',
  track: '#262d33',
  accent: '#6ccfa9',
  amber: '#e9b25c',
  red: '#ec9999',
  lcd: '#9dff3c',
  needle: '#ff3b30',
  faceHi: '#1d2226',
  faceLo: '#07090b',
  digit: '#e9ebef',
  odoBox: '#05070a',
  odoInk: '#f1f3f5',
  strip: '#0f1215',
  stripLine: '#262c31',
  kinds: { Claude: '#cb946b', Codex: '#69bda1', GLM: '#8baad1', Antigravity: '#b89cce' } as Record<string, string>,
}
const LIGHT: typeof DARK = {
  bg: '#f6f7f8',
  panel: '#ffffff',
  panel2: '#f8f9fa',
  ink: '#111518',
  muted: '#5b6670',
  dim: '#9aa3ab',
  line: '#e3e7ea',
  track: '#e7ecee',
  accent: '#13805f',
  amber: '#9a6410',
  red: '#b8403d',
  lcd: '#6aa800',
  needle: '#e2372c',
  faceHi: '#ffffff',
  faceLo: '#e9edf0',
  digit: '#8c959c',
  odoBox: '#0f1215',
  odoInk: '#f6f7f8',
  strip: '#0f1215',
  stripLine: '#262c31',
  kinds: { Claude: '#9c633d', Codex: '#287c65', GLM: '#4c74a2', Antigravity: '#846199' } as Record<string, string>,
}
export const THEMES: Record<Theme, typeof DARK> = { dark: DARK, light: LIGHT }
type Th = typeof DARK
const kindColor = (th: Th, kind: string) => th.kinds[kind] ?? th.muted

// ---------------------------------------------------------------- drawing kit

const W = 400
const SANS = "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', Pretendard, 'Segoe UI', sans-serif"
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const f1 = (n: number) => n.toFixed(1)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const pad2 = (n: number) => String(n).padStart(2, '0')

type TextOpt = { size?: number; fill?: string; weight?: number; anchor?: 'start' | 'middle' | 'end'; mono?: boolean; spacing?: number }
const txt = (x: number, y: number, s: string, o: TextOpt = {}) =>
  `<text x="${f1(x)}" y="${f1(y)}" font-family="${o.mono ? MONO : SANS}" font-size="${o.size ?? 12}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? '#000'}"${o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : ''}${o.spacing ? ` letter-spacing="${o.spacing}"` : ''}>${esc(s)}</text>`

/** Cuts a label to about `max` columns, a Hangul syllable counting two. */
const fit = (s: string, max: number) => {
  let cols = 0
  let out = ''
  for (const ch of s) {
    cols += /[ᄀ-ᇿ㄰-㆏가-힯]/.test(ch) ? 2 : 1
    if (cols > max) return `${out}…`
    out += ch
  }
  return out
}
const cols = (s: string) => [...s].reduce((n, ch) => n + (/[ᄀ-ᇿ㄰-㆏가-힯]/.test(ch) ? 2 : 1), 0)

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
}
const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
  const [x1, y1] = polar(cx, cy, r, from)
  const [x2, y2] = polar(cx, cy, r, to)
  return `M${f1(x1)} ${f1(y1)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${f1(x2)} ${f1(y2)}`
}
const mix = (a: string, b: string, k: number) => {
  const p = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const c = [0, 1, 2].map(i => Math.round(p(a, i) + (p(b, i) - p(a, i)) * clamp01(k)))
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`
}
const bar = (th: Th, x: number, y: number, w: number, frac: number | null, color: string, h = 4) =>
  `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${h}" rx="${h / 2}" fill="${th.track}"/>` +
  (frac === null || frac <= 0 ? '' : `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(Math.max(h, w * clamp01(frac)))}" height="${h}" rx="${h / 2}" fill="${color}"/>`)

// Seven-segment digits, as the dials' readouts and 1top's LCDs draw them.
const SEGMENTS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd',
  '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g',
}
const sevenSeg = (x: number, y: number, h: number, s: string, color: string, anchor: 'start' | 'middle' = 'middle') => {
  const w = h * 0.52
  const th = h * 0.13
  const gap = h * 0.16
  const widthOf = (ch: string) => (ch === '.' || ch === ',' ? th * 1.6 : w + gap)
  const total = [...s].reduce((a, ch) => a + widthOf(ch), 0) - gap
  let cx = anchor === 'middle' ? x - total / 2 : x
  const out: string[] = []
  const seg = (x0: number, y0: number, horizontal: boolean, len: number) => {
    const t = th / 2
    const pts = horizontal
      ? [[x0, y0], [x0 + t, y0 - t], [x0 + len - t, y0 - t], [x0 + len, y0], [x0 + len - t, y0 + t], [x0 + t, y0 + t]]
      : [[x0, y0], [x0 + t, y0 + t], [x0 + t, y0 + len - t], [x0, y0 + len], [x0 - t, y0 + len - t], [x0 - t, y0 + t]]
    return `<polygon points="${pts.map(([a, b]) => `${f1(a ?? 0)},${f1(b ?? 0)}`).join(' ')}"/>`
  }
  for (const ch of s) {
    if (ch === '.' || ch === ',') {
      out.push(`<rect x="${f1(cx)}" y="${f1(y - th)}" width="${f1(th)}" height="${f1(th)}"/>`)
      cx += widthOf(ch)
      continue
    }
    const on = SEGMENTS[ch] ?? ''
    const half = h / 2
    const parts: Record<string, string> = {
      a: seg(cx, y - h, true, w),
      b: seg(cx + w, y - h, false, half),
      c: seg(cx + w, y - half, false, half),
      d: seg(cx, y, true, w),
      e: seg(cx, y - half, false, half),
      f: seg(cx, y - h, false, half),
      g: seg(cx, y - half, true, w),
    }
    for (const k of on) out.push(parts[k] ?? '')
    cx += widthOf(ch)
  }
  return `<g fill="${color}" transform="translate(${f1(y * 0.12)} 0) skewX(-7)">${out.join('')}</g>`
}

/** "108.2M" -> the digits and the unit, for a seven-segment readout. */
const readout = (n: number): [string, string] => {
  if (n >= 1e9) return [(n / 1e9).toFixed(n >= 1e10 ? 0 : 1), 'B']
  if (n >= 1e6) return [(n / 1e6).toFixed(n >= 1e8 ? 0 : 1), 'M']
  if (n >= 1e3) return [(n / 1e3).toFixed(n >= 1e5 ? 0 : 1), 'K']
  return [String(Math.round(n)), '']
}

const niceMax = (v: number) => {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10) * p
}
const svg = (h: number, body: string, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Math.ceil(h)}" viewBox="0 0 ${W} ${Math.ceil(h)}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`

// ---------------------------------------------------------------- the cluster

/** One speedometer: 270° from lower left to lower right, its last fifth red. */
const dial = (th: Th, id: string, cx: number, cy: number, R: number, value: number, max: number, labels: string[], digits: [string, string], unit: string) => {
  const out: string[] = []
  const from = 135
  const sweep = 270
  out.push(`<circle cx="${cx}" cy="${cy}" r="${R + 7}" fill="${th.panel2}" stroke="${th.line}"/>`)
  out.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#face-${id})"/>`)
  // The coloured band: green, then yellow, then red.
  const steps = 54
  for (let i = 0; i < steps; i++) {
    const k = i / steps
    const color = k < 0.62 ? mix('#3fae5a', '#8fd14f', k / 0.62) : k < 0.8 ? mix('#8fd14f', '#e7c74a', (k - 0.62) / 0.18) : mix('#e7a23e', '#ff3b30', (k - 0.8) / 0.2)
    out.push(`<path d="${arc(cx, cy, R - 5, from + sweep * k, from + sweep * (k + 1 / steps) + 0.4)}" stroke="${color}" stroke-width="3" fill="none"/>`)
  }
  for (let i = 0; i <= 40; i++) {
    const deg = from + (sweep * i) / 40
    const major = i % 10 === 0
    const [x1, y1] = polar(cx, cy, R - 10, deg)
    const [x2, y2] = polar(cx, cy, R - (major ? 21 : 15), deg)
    out.push(`<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${major ? th.ink : th.muted}" stroke-opacity="${major ? 0.85 : 0.5}" stroke-width="${major ? 2 : 1}"/>`)
  }
  labels.forEach((label, i) => {
    const [x, y] = polar(cx, cy, R - 34, from + (sweep * i) / (labels.length - 1))
    out.push(txt(x, y + 4, label, { size: 11.5, weight: 600, anchor: 'middle', fill: i === labels.length - 1 ? th.needle : th.ink }))
  })
  const deg = from + sweep * clamp01(max <= 0 ? 0 : value / max)
  const [nx, ny] = polar(cx, cy, R - 12, deg)
  const [bx, by] = polar(cx, cy, 10, deg + 180)
  out.push(`<line x1="${f1(bx)}" y1="${f1(by)}" x2="${f1(nx)}" y2="${f1(ny)}" stroke="${th.needle}" stroke-width="6" stroke-opacity="0.25" stroke-linecap="round"/>`)
  out.push(`<line x1="${f1(bx)}" y1="${f1(by)}" x2="${f1(nx)}" y2="${f1(ny)}" stroke="${th.needle}" stroke-width="2.6" stroke-linecap="round"/>`)
  out.push(`<circle cx="${cx}" cy="${cy}" r="30" fill="url(#face-${id})" fill-opacity="0.92"/>`)
  out.push(sevenSeg(cx - 6, cy + 9, 22, digits[0], th.digit))
  if (digits[1]) out.push(txt(cx + 6 + digits[0].length * 7.2, cy + 9, digits[1], { size: 10, weight: 700, fill: th.digit }))
  out.push(txt(cx, cy + 27, unit, { size: 9.5, weight: 600, anchor: 'middle', fill: th.muted }))
  return out.join('')
}

const ICON: Record<string, (x: number, y: number, c: string) => string> = {
  live: (x, y, c) =>
    `<g fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"><circle cx="${x}" cy="${y}" r="1.8" fill="${c}"/><path d="${arc(x, y, 5, 130, 230)}"/><path d="${arc(x, y, 5, -50, 50)}"/><path d="${arc(x, y, 8.5, 135, 225)}"/><path d="${arc(x, y, 8.5, -45, 45)}"/></g>`,
  working: (x, y, c) => `<g fill="${c}"><rect x="${x - 7}" y="${y - 1}" width="3.2" height="7" rx="1"/><rect x="${x - 1.6}" y="${y - 7}" width="3.2" height="13" rx="1"/><rect x="${x + 3.8}" y="${y - 4}" width="3.2" height="10" rx="1"/></g>`,
  waiting: (x, y, c) => `<g fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"><path d="M${x} ${y - 8} L${x + 8.5} ${y + 6.5} L${x - 8.5} ${y + 6.5} Z"/><path d="M${x} ${y - 2.5} V${y + 1.5}" stroke-linecap="round"/></g><circle cx="${x}" cy="${y + 4}" r="1" fill="${c}"/>`,
  done: (x, y, c) => `<g fill="none" stroke="${c}" stroke-width="1.4"><rect x="${x - 6}" y="${y - 8}" width="12" height="15" rx="2"/><path d="M${x - 3} ${y - 3} H${x + 3} M${x - 3} ${y} H${x + 3} M${x - 3} ${y + 3} H${x + 1}"/></g>`,
  relogin: (x, y, c) => `<g fill="none" stroke="${c}" stroke-width="1.7" stroke-linecap="round"><path d="${arc(x, y, 6.5, 200, 470)}"/><path d="M${x - 8.4} ${y - 5} l1.6 3.4 l3.4 -1.4"/></g>`,
  low: (x, y, c) => `<g fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"><rect x="${x - 7}" y="${y - 7}" width="9" height="14" rx="1.5"/><path d="M${x - 5} ${y - 4} H${x}"/><path d="M${x + 2} ${y - 4} h3 v8 a1.5 1.5 0 0 0 3 0 v-6 l-2 -2"/></g>`,
}

const statusStrip = (th: Th, d: Dash, t: Texts, y0: number) => {
  const out: string[] = []
  const x0 = 20
  const w = W - 40
  out.push(`<rect x="${x0}" y="${y0}" width="${w}" height="62" rx="12" fill="${th.strip}" stroke="${th.stripLine}"/>`)
  const cells: [keyof Texts['strip'], number | null, string][] = [
    ['live', null, DARK.lcd],
    ['working', d.counts.working, DARK.lcd],
    ['waiting', d.counts.waiting, '#ffc94a'],
    ['done', d.counts.done, '#8a949c'],
    ['relogin', d.counts.relogin, '#ff6b6b'],
    ['low', d.counts.low, '#ff6b6b'],
  ]
  const cw = w / cells.length
  cells.forEach(([key, count, color], i) => {
    const cx = x0 + cw * i + cw / 2
    const isOn = count === null || count > 0
    const c = isOn ? color : '#4a535a'
    const icon = ICON[key]
    if (icon) out.push(icon(cx, y0 + 22, c))
    if (count !== null && count > 0) out.push(txt(cx + 12, y0 + 15, String(count), { size: 10.5, weight: 700, fill: c }))
    out.push(txt(cx, y0 + 49, t.strip[key], { size: 10.5, weight: 600, anchor: 'middle', fill: c }))
  })
  return out.join('')
}

const odometer = (th: Th, x: number, y: number, n: number) => {
  const s = Math.round(n).toLocaleString('en-US')
  const digits = [...s]
  const bw = digits.length > 11 ? 11 : 15
  const out: string[] = []
  const width = digits.reduce((a, ch) => a + (ch === ',' ? 5 : bw + 2), 0)
  let cx = x - width / 2
  out.push(`<rect x="${f1(cx - 4)}" y="${y - 2}" width="${f1(width + 6)}" height="27" rx="5" fill="${th.odoBox}" stroke="${th.stripLine}"/>`)
  for (const ch of digits) {
    if (ch === ',') {
      out.push(txt(cx + 1, y + 20, ',', { size: 13, weight: 700, fill: th.odoInk, mono: true }))
      cx += 5
      continue
    }
    out.push(`<rect x="${f1(cx)}" y="${y + 1}" width="${bw}" height="21" rx="2" fill="${mix(th.odoBox, '#ffffff', 0.06)}"/>`)
    out.push(txt(cx + bw / 2, y + 17.5, ch, { size: 15, weight: 700, anchor: 'middle', fill: th.odoInk, mono: true }))
    cx += bw + 2
  }
  return out.join('')
}

const tanks = (th: Th, accounts: Meter[], y0: number) => {
  const out: string[] = []
  const shown = accounts.slice(0, 6)
  if (shown.length === 0) return { svg: '', h: 0 }
  const lowest = shown.reduce((lo, m) => ((m.pct ?? 0) > (lo.pct ?? 0) ? m : lo), shown[0] as Meter)
  const cw = (W - 40) / shown.length
  shown.forEach((m, i) => {
    const cx = 20 + cw * i + cw / 2
    const left = 1 - clamp01((m.pct ?? 0) / 100)
    const h = 40
    const w = 18
    const x = cx - w / 2
    const color = kindColor(th, m.kind)
    out.push(`<rect x="${f1(x)}" y="${y0}" width="${w}" height="${h}" rx="5" fill="${th.track}"${m === lowest && (m.pct ?? 0) >= 50 ? ` stroke="${mix(color, th.ink, 0.35)}" stroke-width="1.6"` : ''}/>`)
    if (left > 0) out.push(`<rect x="${f1(x + 2)}" y="${f1(y0 + 2 + (h - 4) * (1 - left))}" width="${w - 4}" height="${f1((h - 4) * left)}" rx="3" fill="${color}" fill-opacity="0.85"/>`)
    out.push(txt(cx, y0 + h + 15, KIND_SHORT[m.kind] ?? m.kind, { size: 10.5, weight: 600, anchor: 'middle', fill: color }))
    out.push(txt(cx, y0 + h + 30, fit(m.plan || m.window, 8), { size: 11.5, weight: 700, anchor: 'middle', fill: th.ink }))
  })
  return { svg: out.join(''), h: 76 }
}

export const clusterSvg = (d: Dash, t: Texts, theme: Theme, period: Period, trip: Trip | null, nowS: number): { source: string; alt: string } => {
  const th = THEMES[theme]
  const out: string[] = []
  const max = niceMax(Math.max(d.tokensPerHour * 1.25, 1))
  const pMax = Math.max(2, niceMax((d.pctPerHour ?? 0) * 1.25))
  const tickLabels = (m: number, fmt: (v: number) => string) => [0, 0.25, 0.5, 0.75, 1].map(k => fmt(m * k))
  const tokenLabel = (v: number) => (v === 0 ? '0' : compactNumber(v).replace('.0', ''))
  const pctLabel = (v: number) => (v === 0 ? '0' : String(Math.round(v * 100) / 100))
  out.push(dial(th, `${theme}-a`, 100, 104, 90, d.tokensPerHour, max, tickLabels(max, tokenLabel), readout(d.tokensPerHour), t.tokensPerHour))
  out.push(dial(th, `${theme}-b`, 300, 104, 90, d.pctPerHour ?? 0, pMax, tickLabels(pMax, pctLabel), [d.pctPerHour === null ? '--' : (d.pctPerHour).toFixed(2), ''], t.pctPerHour))
  let y = 214
  out.push(statusStrip(th, d, t, y))
  y += 78
  // Totals: the period's tokens on the odometer, the trip beside it.
  out.push(txt(118, y + 4, `${t.total} · ${t.recent[period]}`, { size: 11, weight: 600, anchor: 'middle', fill: th.muted }))
  out.push(odometer(th, 118, y + 12, d.flowTotal))
  if (trip !== null) {
    const since = new Date(trip.since * 1000)
    out.push(
      `<text x="282" y="${y + 8}" font-family="${SANS}"><tspan font-size="11.5" font-weight="600" fill="${th.muted}">${esc(t.trip)} </tspan>` +
        `<tspan font-size="13.5" font-weight="800" fill="${th.ink}">${esc(compactNumber(trip.total).replace('.0', ''))}</tspan>` +
        `<tspan font-size="11" fill="${th.muted}"> ${esc(t.tokens)}</tspan></text>`,
    )
    const at = `${pad2(since.getHours())}:${pad2(since.getMinutes())}`
    const day = t.since === '부터' ? `${since.getMonth() + 1}. ${since.getDate()}. ${at}부터` : `${t.since} ${since.getMonth() + 1}/${since.getDate()} ${at}`
    out.push(txt(282, y + 30, day, { size: 11, fill: th.muted }))
  }
  y += 56
  out.push(txt(W / 2, y + 4, t.left, { size: 11.5, weight: 600, anchor: 'middle', fill: th.muted }))
  const tk = tanks(th, d.accounts, y + 14)
  out.push(tk.svg)
  y += 14 + tk.h + 8
  // Named by theme too: a page that shows both themes keeps each its own faces.
  const defs = [`${theme}-a`, `${theme}-b`]
    .map(id => `<radialGradient id="face-${id}" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="${th.faceHi}"/><stop offset="1" stop-color="${th.faceLo}"/></radialGradient>`)
    .join('')
  const alt = [
    `${t.views.cluster}: ${compactNumber(d.tokensPerHour)} ${t.tokensPerHour}, ${d.pctPerHour === null ? '--' : d.pctPerHour.toFixed(2)} ${t.pctPerHour}.`,
    `${t.strip.working} ${d.counts.working}, ${t.strip.waiting} ${d.counts.waiting}, ${t.strip.low} ${d.counts.low}.`,
    `${t.total} ${t.recent[period]} ${Math.round(d.flowTotal).toLocaleString('en-US')} ${t.tokens}.`,
    ...d.accounts.map(m => `${m.title} ${m.index} ${m.plan} ${m.pct === null ? '--' : Math.round(m.pct)}%.`),
  ].join(' ')
  return { source: svg(y, out.join(''), defs), alt }
}

// ---------------------------------------------------------------- the dashboard

const radial = (th: Th, d: Dash, cx: number, cy: number, R: number) => {
  const out: string[] = []
  out.push(`<circle cx="${cx}" cy="${cy}" r="${R + 4}" fill="${th.panel2}" stroke="${th.line}"/>`)
  for (const r of [R * 0.45, R * 0.65, R * 0.85]) out.push(`<circle cx="${cx}" cy="${cy}" r="${f1(r)}" fill="none" stroke="${th.line}" stroke-dasharray="1.5 3"/>`)
  for (let i = 0; i < 60; i++) {
    const [x1, y1] = polar(cx, cy, R - 1, i * 6)
    const [x2, y2] = polar(cx, cy, R + (i % 5 === 0 ? 4 : 2), i * 6)
    out.push(`<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${th.dim}" stroke-width="${i % 5 === 0 ? 1.3 : 0.8}"/>`)
  }
  // The trailing sweep, from a minute back to now at twelve o'clock.
  const [sx, sy] = polar(cx, cy, R, -90)
  out.push(`<path d="M${cx} ${cy} L${f1(polar(cx, cy, R, -150)[0])} ${f1(polar(cx, cy, R, -150)[1])} ${arc(cx, cy, R, -150, -90).replace(/^M[^A]+/, '')} Z" fill="${th.accent}" fill-opacity="0.08"/>`)
  const n = d.flow.length
  const totals = d.flow.map(b => Object.values(b.byKind).reduce((a, c) => a + c, 0))
  const peak = Math.max(1, ...totals)
  const r0 = R * 0.5
  const span = R * 0.46
  const width = Math.max(1.6, ((2 * Math.PI * (r0 + span / 2)) / Math.max(1, n)) * 0.55)
  d.flow.forEach((b, i) => {
    const deg = -90 + (360 * (i + 0.5)) / n
    let r = r0
    for (const k of d.kinds) {
      const v = b.byKind[k] ?? 0
      if (v <= 0) continue
      const len = (span * v) / peak
      const [x1, y1] = polar(cx, cy, r, deg)
      const [x2, y2] = polar(cx, cy, r + len, deg)
      out.push(`<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${kindColor(th, k)}" stroke-width="${f1(width)}" stroke-opacity="0.9"/>`)
      r += len
    }
  })
  out.push(`<line x1="${cx}" y1="${cy}" x2="${f1(sx)}" y2="${f1(sy)}" stroke="${th.needle}" stroke-width="1.6"/>`)
  out.push(`<circle cx="${f1(sx)}" cy="${f1(sy)}" r="2.6" fill="${th.needle}"/>`)
  out.push(`<circle cx="${cx}" cy="${cy}" r="${f1(R * 0.46)}" fill="${th.panel2}" stroke="${th.line}"/>`)
  return out.join('')
}

const sparkline = (th: Th, x: number, y: number, w: number, h: number, points: number[], color: string) => {
  if (points.length < 2) return `<line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="${color}" stroke-opacity="0.5" stroke-width="1.4"/><circle cx="${x + w}" cy="${y + h / 2}" r="2.4" fill="${color}"/>`
  const lo = Math.min(...points)
  const hi = Math.max(...points)
  const span = hi - lo || 1
  const xy = points.map((p, i) => [x + (w * i) / (points.length - 1), y + h - (h * (p - lo)) / span] as const)
  const dpath = xy.map(([a, b], i) => `${i === 0 ? 'M' : 'L'}${f1(a)} ${f1(b)}`).join('')
  const end = xy[xy.length - 1] ?? [x + w, y + h / 2]
  return `<path d="${dpath}" stroke="${color}" stroke-width="1.5" fill="none" stroke-linejoin="round"/><circle cx="${f1(end[0])}" cy="${f1(end[1])}" r="2.4" fill="${color}" stroke="${th.panel2}" stroke-width="1"/>`
}

export const dashboardSvg = (d: Dash, t: Texts, theme: Theme, period: Period): { source: string; alt: string } => {
  const th = THEMES[theme]
  const out: string[] = []
  out.push(txt(4, 18, t.tokenUse, { size: 13, weight: 700, fill: th.ink }))
  out.push(txt(4 + cols(t.tokenUse) * 7 + 10, 18, t.recent[period], { size: 11, fill: th.muted }))
  const cx = 98
  const cy = 128
  out.push(radial(th, d, cx, cy, 92))
  const [digits, unit] = readout(d.tokensPerHour)
  out.push(txt(cx, cy - 15, t.average, { size: 9, weight: 600, anchor: 'middle', fill: th.muted }))
  out.push(sevenSeg(cx - 5, cy + 8, 18, digits, th.lcd))
  if (unit) out.push(txt(cx + 4 + digits.length * 6, cy + 8, unit, { size: 9, weight: 700, fill: th.lcd }))
  out.push(txt(cx, cy + 23, t.tokensPerHour, { size: 8.5, weight: 600, anchor: 'middle', fill: th.muted }))

  // The model mix.
  const x0 = 214
  out.push(txt(x0, 44, t.byModel, { size: 10.5, weight: 600, fill: th.muted }))
  const total = d.models.reduce((a, m) => a + m.tokens, 0)
  let bx = x0
  const bw = W - x0 - 6
  d.models.forEach((m, i) => {
    const w = total === 0 ? 0 : (bw * m.tokens) / total
    out.push(`<rect x="${f1(bx)}" y="54" width="${f1(Math.max(0, w - 1.5))}" height="6" rx="1.5" fill="${kindColor(th, m.kind)}" fill-opacity="${i < 3 ? 0.95 : 0.45}"/>`)
    bx += w
  })
  let y = 82
  for (const m of d.models.slice(0, 3)) {
    out.push(`<circle cx="${x0 + 3}" cy="${y - 4}" r="3" fill="${kindColor(th, m.kind)}"/>`)
    out.push(txt(x0 + 12, y, fit(m.name, 16), { size: 11.5, weight: 700, fill: th.ink }))
    out.push(txt(x0 + 12, y + 14, KIND_NAME[m.kind] ?? m.kind, { size: 10, fill: th.muted }))
    out.push(txt(W - 6, y, `${total === 0 ? 0 : Math.round((m.tokens * 100) / total)}%`, { size: 11.5, weight: 700, anchor: 'end', fill: th.ink }))
    y += 34
  }
  const rest = d.models.slice(3)
  if (rest.length > 0) {
    const restTokens = rest.reduce((a, m) => a + m.tokens, 0)
    out.push(`<circle cx="${x0 + 3}" cy="${y - 4}" r="3" fill="${th.dim}"/>`)
    out.push(txt(x0 + 12, y, t.otherModels(rest.length), { size: 11.5, weight: 700, fill: th.ink }))
    out.push(txt(W - 6, y, `${Math.round((restTokens * 100) / Math.max(1, total))}%`, { size: 11.5, weight: 700, anchor: 'end', fill: th.ink }))
  }
  if (d.models.length === 0) out.push(txt(x0, 82, t.noFlow, { size: 10.5, fill: th.dim }))

  // Account cards.
  y = 246
  out.push(txt(4, y, t.limits, { size: 13, weight: 700, fill: th.ink }))
  out.push(txt(4 + cols(t.limits) * 7 + 10, y, t.perAccount, { size: 11, fill: th.muted }))
  out.push(txt(W - 6, y + 1, '+', { size: 17, anchor: 'end', fill: th.muted }))
  y += 12
  const cardW = (W - 10) / 2
  d.accounts.slice(0, 6).forEach((m, i) => {
    const x = (i % 2) * (cardW + 10)
    const top = y + Math.floor(i / 2) * 58
    const color = kindColor(th, m.kind)
    out.push(`<rect x="${f1(x)}" y="${top}" width="${f1(cardW)}" height="50" rx="10" fill="${th.panel2}" stroke="${th.line}"/>`)
    out.push(`<circle cx="${x + 12}" cy="${top + 17}" r="3" fill="${color}"/>`)
    const title = fit(m.title, 11)
    out.push(txt(x + 20, top + 21, title, { size: 12, weight: 700, fill: th.ink }))
    const chipX = x + 20 + cols(title) * 6.9 + 6
    out.push(`<rect x="${f1(chipX)}" y="${top + 10}" width="14" height="14" rx="3.5" fill="${th.track}"/>`)
    out.push(txt(chipX + 7, top + 21, String(m.index), { size: 9.5, weight: 700, anchor: 'middle', fill: th.ink }))
    out.push(txt(x + 12, top + 39, fit(m.plan || m.window, 10), { size: 10, fill: th.muted }))
    out.push(txt(x + cardW - 10, top + 23, m.pct === null ? '--' : `${Math.round(m.pct)}%`, { size: 16, weight: 700, anchor: 'end', fill: th.ink }))
    out.push(txt(x + cardW - 10, top + 39, m.rate === null ? m.window : `${m.rate.toFixed(1)}%${t.perHour}`, { size: 10, weight: 600, anchor: 'end', fill: color }))
    out.push(sparkline(th, x + 58, top + 33, 50, 9, m.spark, color))
  })
  y += Math.ceil(Math.min(6, d.accounts.length) / 2) * 58 + 8
  if (d.resources !== null) {
    const r = d.resources
    out.push(txt(4, y + 9, t.cpu, { size: 11, fill: th.muted }))
    out.push(bar(th, 40, y + 4, 106, r.cpu === null ? null : r.cpu / 100, th.lcd, 4))
    out.push(txt(184, y + 9, r.cpu === null ? '--' : `${Math.round(r.cpu)}%`, { size: 11.5, weight: 700, anchor: 'end', fill: th.ink }))
    out.push(txt(208, y + 9, t.memory, { size: 11, fill: th.muted }))
    out.push(bar(th, 252, y + 4, 106, r.mem === null ? null : r.mem / 100, th.lcd, 4))
    out.push(txt(W - 6, y + 9, r.mem === null ? '--' : `${Math.round(r.mem)}%`, { size: 11.5, weight: 700, anchor: 'end', fill: th.ink }))
    y += 22
  }
  const alt = [
    `${t.views.dashboard}: ${t.tokenUse} ${t.recent[period]}, ${t.average} ${compactNumber(d.tokensPerHour)} ${t.tokensPerHour}.`,
    ...d.models.slice(0, 3).map(m => `${m.name} ${total === 0 ? 0 : Math.round((m.tokens * 100) / total)}%.`),
    ...d.accounts.map(m => `${m.title} ${m.index} ${m.pct === null ? '--' : Math.round(m.pct)}%.`),
  ].join(' ')
  return { source: svg(y + 4, out.join('')), alt }
}

// ---------------------------------------------------------------- sections

const miniDial = (th: Th, cx: number, cy: number, pp: number | null) => {
  const k = pp === null ? 0 : clamp01(pp / 2)
  const color = pp === null || pp <= 0 ? th.dim : pp >= 1.5 ? th.needle : pp >= 0.5 ? th.amber : th.lcd
  const [nx, ny] = polar(cx, cy, 7, 135 + 270 * k)
  return (
    `<path d="${arc(cx, cy, 9, 135, 405)}" stroke="${th.track}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
    (k > 0 ? `<path d="${arc(cx, cy, 9, 135, 135 + Math.max(4, 270 * k))}" stroke="${color}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` : '') +
    `<line x1="${cx}" y1="${cy}" x2="${f1(nx)}" y2="${f1(ny)}" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="1.8" fill="${color}"/>`
  )
}

const sessionsSection = (th: Th, d: Dash, t: Texts) => {
  const out: string[] = []
  let y = 18
  out.push(txt(4, y, t.sessionsTitle, { size: 13, weight: 700, fill: th.ink }))
  const chipX = 4 + cols(t.sessionsTitle) * 7.2 + 8
  out.push(`<rect x="${f1(chipX)}" y="${y - 12}" width="${8 + String(d.sessionCount).length * 7}" height="16" rx="4" fill="${th.track}"/>`)
  out.push(txt(chipX + 4, y, String(d.sessionCount), { size: 11, weight: 700, fill: th.ink }))
  const wx = chipX + 22 + String(d.sessionCount).length * 7
  out.push(ICON.working?.(wx + 6, y - 4, th.lcd) ?? '')
  out.push(txt(wx + 16, y, `${t.working} ${d.counts.working}`, { size: 12, weight: 700, fill: th.ink }))
  out.push(txt(W - 4, y, t.weeklyUse, { size: 10.5, fill: th.muted, anchor: 'end' }))
  y += 12
  if (d.sessions.length === 0) {
    out.push(txt(4, y + 24, t.noSessions, { size: 11, fill: th.dim }))
    return { body: out.join(''), h: y + 40 }
  }
  for (const s of d.sessions) {
    const top = y
    out.push(miniDial(th, 24, top + 20, s.sharePerHour))
    out.push(txt(24, top + 42, s.sharePerHour === null ? '—' : `${s.sharePerHour.toFixed(1)}%${t.perHour}`, { size: 9, anchor: 'middle', fill: th.muted }))
    let x = 60
    if (s.status === 'working') {
      out.push(ICON.working?.(x + 6, top + 17, th.lcd) ?? '')
      x += 17
    } else if (s.status === 'waiting') {
      out.push(ICON.waiting?.(x + 7, top + 17, th.amber) ?? '')
      x += 19
    }
    const title = fit(s.title, 26)
    out.push(txt(x, top + 22, title, { size: 13, weight: 700, fill: th.ink }))
    if (s.children > 0) {
      const cx = x + cols(title) * 7.4 + 6
      const label = t.children(s.children)
      out.push(`<rect x="${f1(cx)}" y="${top + 10}" width="${f1(cols(label) * 6 + 12)}" height="16" rx="8" fill="none" stroke="${th.line}"/>`)
      out.push(txt(cx + 6, top + 22, label, { size: 10, fill: th.muted }))
    }
    const kind = KIND_NAME[s.kind] ?? s.kind
    out.push(txt(60, top + 40, kind, { size: 11.5, fill: kindColor(th, s.kind) }))
    let lx = 60 + cols(kind) * 6.6 + 6
    if (s.account !== null) {
      out.push(`<rect x="${f1(lx)}" y="${top + 29}" width="14" height="14" rx="3.5" fill="${th.track}"/>`)
      out.push(txt(lx + 7, top + 40, String(s.account), { size: 9.5, weight: 700, anchor: 'middle', fill: th.ink }))
      lx += 20
    }
    out.push(txt(lx, top + 40, `· ${fit(s.project, 22)}`, { size: 11.5, fill: th.muted }))
    const right = s.share !== null ? shareText(s.share) : s.tokens > 0 ? compactNumber(s.tokens) : '—'
    out.push(txt(W - 4, top + 27, right, { size: 13.5, weight: 700, anchor: 'end', fill: right === '—' ? th.dim : th.ink }))
    y = top + 52
    out.push(`<line x1="60" y1="${y}" x2="${W}" y2="${y}" stroke="${th.line}"/>`)
  }
  return { body: out.join(''), h: y + 6 }
}

const flowSection = (th: Th, d: Dash, t: Texts, period: Period) => {
  const out: string[] = []
  out.push(txt(4, 18, t.sections.flow, { size: 13, weight: 700, fill: th.ink }))
  out.push(txt(W - 4, 18, `${compactNumber(d.flowTotal)} ${t.tokens} · ${t.recent[period]}`, { size: 10.5, fill: th.muted, anchor: 'end' }))
  const x0 = 44
  const cw = W - x0 - 4
  const top = 34
  const h = 130
  const totals = d.flow.map(b => Object.values(b.byKind).reduce((a, c) => a + c, 0))
  const max = niceMax(Math.max(0, ...totals))
  for (const k of [0, 0.5, 1]) {
    const y = top + h - h * k
    out.push(`<line x1="${x0}" y1="${y}" x2="${x0 + cw}" y2="${y}" stroke="${th.line}"${k === 0 ? '' : ' stroke-dasharray="2 3"'}/>`)
    out.push(txt(x0 - 6, y + 3.5, k === 0 ? '0' : compactNumber(max * k), { size: 9.5, fill: th.dim, anchor: 'end' }))
  }
  if (d.flowTotal <= 0) out.push(txt(x0 + cw / 2, top + h / 2, t.noFlow, { size: 11, fill: th.dim, anchor: 'middle' }))
  const slot = cw / Math.max(1, d.flow.length)
  const bw = Math.max(1.5, slot * 0.72)
  d.flow.forEach((b, i) => {
    let yb = top + h
    for (const k of d.kinds) {
      const v = b.byKind[k] ?? 0
      if (v <= 0) continue
      const bh = (h * v) / max
      yb -= bh
      out.push(`<rect x="${f1(x0 + i * slot + (slot - bw) / 2)}" y="${f1(yb)}" width="${f1(bw)}" height="${f1(Math.max(0.8, bh))}" fill="${kindColor(th, k)}"/>`)
    }
  })
  const first = d.flow[0]
  const last = d.flow[d.flow.length - 1]
  const hm = (s: number) => {
    const x = new Date(s * 1000)
    return `${pad2(x.getHours())}:${pad2(x.getMinutes())}`
  }
  if (first && last) {
    out.push(txt(x0, top + h + 15, hm(first.t), { size: 9.5, fill: th.dim }))
    out.push(txt(x0 + cw, top + h + 15, hm(last.t), { size: 9.5, fill: th.dim, anchor: 'end' }))
  }
  let lx = 4
  const ly = top + h + 36
  for (const k of d.kinds.length > 0 ? d.kinds : ['Claude']) {
    const name = KIND_NAME[k] ?? k
    out.push(`<circle cx="${lx + 4}" cy="${ly - 4}" r="3.5" fill="${kindColor(th, k)}"/>`)
    out.push(txt(lx + 12, ly, name, { size: 10.5, fill: th.muted }))
    lx += 24 + cols(name) * 6.2
  }
  return { body: out.join(''), h: ly + 10 }
}

const limitsSection = (th: Th, d: Dash, t: Texts) => {
  const out: string[] = []
  out.push(txt(4, 18, t.limits, { size: 13, weight: 700, fill: th.ink }))
  let y = 34
  for (const m of d.accounts) {
    const color = kindColor(th, m.kind)
    out.push(`<circle cx="8" cy="${y + 8}" r="3" fill="${color}"/>`)
    out.push(txt(18, y + 12, `${m.title} ${m.index}`, { size: 12, weight: 700, fill: th.ink }))
    out.push(txt(18, y + 28, m.sub, { size: 10.5, fill: th.muted }))
    out.push(bar(th, 196, y + 7, 140, m.pct === null ? null : m.pct / 100, color, 6))
    out.push(txt(W - 4, y + 13, m.pct === null ? '--' : `${Math.round(m.pct)}%`, { size: 12.5, weight: 700, anchor: 'end', fill: th.ink }))
    if (m.rate !== null) out.push(txt(W - 4, y + 28, `${m.rate.toFixed(2)}%${t.perHour}`, { size: 10, anchor: 'end', fill: color }))
    y += 42
    out.push(`<line x1="0" y1="${y - 6}" x2="${W}" y2="${y - 6}" stroke="${th.line}"/>`)
  }
  return { body: out.join(''), h: y + 4 }
}

const mapSection = (th: Th, d: Dash, t: Texts) => {
  const out: string[] = []
  const total = d.tiles.reduce((a, b) => a + b.tokens, 0)
  out.push(txt(4, 18, t.sections.map, { size: 13, weight: 700, fill: th.ink }))
  out.push(txt(W - 4, 18, `${compactNumber(total)} ${t.tokens}`, { size: 10.5, fill: th.muted, anchor: 'end' }))
  const top = 30
  const h = 170
  if (total <= 0) {
    out.push(txt(W / 2, top + h / 2, t.noFlow, { size: 11, fill: th.dim, anchor: 'middle' }))
    return { body: out.join(''), h: top + h + 8 }
  }
  const palette = [th.kinds.Codex, th.kinds.GLM, th.kinds.Antigravity, th.kinds.Claude].map(c => c ?? th.muted)
  treemap(d.tiles, { x: 0, y: top, w: W, h }).forEach((tile, i) => {
    const color = tile.kind === '' ? th.dim : (palette[i % palette.length] ?? th.muted)
    const x = tile.x + 2
    const y = tile.y + 2
    const w = tile.w - 4
    const hh = tile.h - 4
    out.push(`<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(hh)}" rx="7" fill="${color}" fill-opacity="0.22"/>`)
    const pct = `${Math.round((tile.tokens * 100) / total)}%`
    if (w > 50 && hh > 36) {
      out.push(txt(x + 10, y + 20, fit(tile.label, Math.max(4, Math.floor(w / 7))), { size: 12, weight: 600, fill: th.ink }))
      out.push(txt(x + 10, y + 37, pct, { size: 11.5, fill: th.muted }))
    } else if (w > 30 && hh > 16) {
      out.push(txt(x + 6, y + 13, pct, { size: 10, fill: th.muted }))
    }
  })
  return { body: out.join(''), h: top + h + 8 }
}

const heatSection = (th: Th, t: Texts, minutes: readonly (readonly [number, number])[], nowS: number) => {
  const out: string[] = []
  out.push(txt(4, 18, t.sections.heat, { size: 13, weight: 700, fill: th.ink }))
  out.push(txt(W - 4, 18, t.recent['24h'], { size: 10.5, fill: th.muted, anchor: 'end' }))
  const grid = heatGrid(minutes, nowS)
  const peak = Math.max(1, ...grid.flat())
  const x0 = 26
  const cw = (W - x0 - 2) / 24
  const ch = 16
  const top = 32
  grid.forEach((row, r) => {
    out.push(txt(x0 - 6, top + r * (ch + 2) + 11.5, `${r * 10}`, { size: 9, fill: th.dim, anchor: 'end' }))
    row.forEach((v, c) => {
      const k = v / peak
      out.push(`<rect x="${f1(x0 + c * cw)}" y="${top + r * (ch + 2)}" width="${f1(cw - 2)}" height="${ch}" rx="2.5" fill="${v > 0 ? th.accent : th.track}" fill-opacity="${v > 0 ? f1(0.18 + 0.82 * Math.sqrt(k)) : 1}"/>`)
    })
  })
  const start = Math.floor(nowS / 3600) * 3600 - 23 * 3600
  for (let c = 0; c < 24; c += 6) {
    const hr = new Date((start + c * 3600) * 1000).getHours()
    out.push(txt(x0 + c * cw, top + 6 * (ch + 2) + 12, `${pad2(hr)}${t.hours}`, { size: 9.5, fill: th.dim }))
  }
  return { body: out.join(''), h: top + 6 * (ch + 2) + 22 }
}

const resourcesSection = (th: Th, d: Dash, t: Texts) => {
  const out: string[] = []
  out.push(txt(4, 18, t.sections.resources, { size: 13, weight: 700, fill: th.ink }))
  const r = d.resources
  if (r === null) {
    out.push(txt(4, 44, '--', { size: 11, fill: th.dim }))
    return { body: out.join(''), h: 56 }
  }
  const rows: [string, string, number | null][] = [
    [t.cpu, r.cpu === null ? '--' : `${r.cpu.toFixed(1)}%`, r.cpu === null ? null : r.cpu / 100],
    [t.memory, r.mem === null ? '--' : `${r.mem.toFixed(1)}%`, r.mem === null ? null : r.mem / 100],
    [t.network, `${r.rx === null ? '--' : rate(r.rx)} ↓  ${r.tx === null ? '--' : rate(r.tx)} ↑`, null],
    [t.disk, r.diskFree === null ? '--' : size(r.diskFree), null],
  ]
  let y = 40
  for (const [label, value, frac] of rows) {
    out.push(txt(4, y + 4, label, { size: 11.5, fill: th.muted }))
    if (frac !== null) out.push(bar(th, 96, y - 1, 200, frac, th.lcd, 5))
    out.push(txt(W - 4, y + 4, value, { size: 12, weight: 700, anchor: 'end', fill: th.ink }))
    y += 28
  }
  return { body: out.join(''), h: y }
}

const sessionSection = (th: Th, t: Texts, v: CockpitView | null, a: Activity, nowMs: number) => {
  const out: string[] = []
  out.push(txt(4, 18, t.sections.session, { size: 13, weight: 700, fill: th.ink }))
  if (v === null) return { body: out.join(''), h: 30 }
  out.push(txt(W - 4, 18, [v.model, v.effort].filter(Boolean).join(' · '), { size: 10.5, fill: th.muted, anchor: 'end' }))
  let y = 42
  for (const g of v.gauges) {
    const color = g.key === 'context' ? kindColor(th, 'Claude') : g.key === 'five_hour' ? th.kinds.GLM ?? th.muted : th.amber
    out.push(txt(4, y + 4, g.label, { size: 11, fill: th.muted }))
    out.push(bar(th, 80, y - 2, 170, g.pct === null ? null : g.pct / 100, color, 6))
    out.push(txt(W - 4, y + 4, `${g.pct === null ? '--' : Math.round(g.pct)}% · ${g.short}`, { size: 11, anchor: 'end', fill: th.ink, mono: true }))
    y += 24
  }
  for (const f of v.forecast) {
    out.push(txt(4, y + 4, f.label, { size: 11, fill: th.muted }))
    out.push(txt(80, y + 4, fit(f.text, 46), { size: 11, fill: th.ink }))
    y += 20
  }
  if (v.alert !== null) {
    out.push(`<rect x="0" y="${y - 6}" width="${W}" height="24" rx="6" fill="${th.needle}" fill-opacity="0.12"/>`)
    out.push(txt(10, y + 10, `▲ ${fit(v.alert, 56)}`, { size: 11, weight: 700, fill: th.needle }))
    y += 30
  }
  y += 4
  let x = 0
  if (a.running.length === 0) {
    out.push(txt(4, y + 10, `${t.idle} · ${t.toolCalls(a.calls)}`, { size: 10.5, fill: th.dim }))
  } else {
    for (const run of a.running.slice(-3)) {
      const label = `${run.isAgent ? 'agent · ' : ''}${run.tool} ${countdown((nowMs - run.since) / 1000)}`
      const w = 24 + label.length * 6.4
      if (x + w > W) break
      out.push(`<rect x="${f1(x)}" y="${y}" width="${f1(w)}" height="20" rx="10" fill="${th.accent}" fill-opacity="0.14"/>`)
      out.push(`<circle cx="${x + 10}" cy="${y + 10}" r="3" fill="${th.accent}"/>`)
      out.push(txt(x + 18, y + 14, label, { size: 10.5, fill: th.accent, mono: true }))
      x += w + 6
    }
  }
  return { body: out.join(''), h: y + 30 }
}

export const sectionSvg = (
  section: Section,
  d: Dash,
  t: Texts,
  theme: Theme,
  period: Period,
  extra: { session: CockpitView | null; activity: Activity; minutes: readonly (readonly [number, number])[]; nowMs: number },
): { source: string; alt: string } => {
  const th = THEMES[theme]
  const nowS = Math.floor(extra.nowMs / 1000)
  const drawn =
    section === 'flow'
      ? flowSection(th, d, t, period)
      : section === 'limits'
        ? limitsSection(th, d, t)
        : section === 'map'
          ? mapSection(th, d, t)
          : section === 'heat'
            ? heatSection(th, t, extra.minutes, nowS)
            : section === 'resources'
              ? resourcesSection(th, d, t)
              : section === 'session'
                ? sessionSection(th, t, extra.session, extra.activity, extra.nowMs)
                : sessionsSection(th, d, t)
  const alt =
    section === 'sessions'
      ? `${t.sessionsTitle} ${d.sessionCount}: ${d.sessions.map(s => `${s.title} ${KIND_NAME[s.kind] ?? s.kind} ${shareText(s.share)}`).join(', ')}.`
      : `${t.sections[section]}.`
  return { source: svg(drawn.h, drawn.body), alt }
}
