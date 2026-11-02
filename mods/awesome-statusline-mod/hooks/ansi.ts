// Turns the renderer's ANSI output into lines of styled runs a surface can draw.
// The renderer only writes SGR reset (0), bold (1) and 24-bit foreground colour
// (38;2;r;g;b), plus erase-to-end-of-line (K); 256-colour and a few other codes
// are read too so a changed renderer still draws.

export type Run = { text: string; color?: string; bold?: true }
export type Line = Run[]

const CSI = /\x1b\[([0-9;]*)([A-Za-z])/g

const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')

const BASE16 = [
  '#000000', '#cd0000', '#00cd00', '#cdcd00', '#0000ee', '#cd00cd', '#00cdcd', '#e5e5e5',
  '#7f7f7f', '#ff0000', '#00ff00', '#ffff00', '#5c5cff', '#ff00ff', '#00ffff', '#ffffff',
]

const xterm256 = (n: number): string | undefined => {
  if (n < 0 || n > 255) return undefined
  if (n < 16) return BASE16[n]
  if (n >= 232) {
    const v = 8 + (n - 232) * 10
    return hex(v, v, v)
  }
  const i = n - 16
  const step = (c: number) => (c === 0 ? 0 : 55 + c * 40)
  return hex(step(Math.floor(i / 36)), step(Math.floor(i / 6) % 6), step(i % 6))
}

const parseLine = (source: string): Line => {
  const runs: Run[] = []
  let color: string | undefined
  let bold = false
  let text = ''

  const flush = () => {
    if (text === '') return
    const last = runs[runs.length - 1]
    if (last !== undefined && last.color === color && (last.bold === true) === bold) {
      last.text += text
    } else {
      const run: Run = { text }
      if (color !== undefined) run.color = color
      if (bold) run.bold = true
      runs.push(run)
    }
    text = ''
  }

  let at = 0
  for (const match of source.matchAll(CSI)) {
    text += source.slice(at, match.index)
    at = (match.index ?? 0) + match[0].length
    if (match[2] !== 'm') continue

    flush()
    const params = (match[1] ?? '') === '' ? [0] : (match[1] ?? '').split(';').map(Number)
    for (let k = 0; k < params.length; k++) {
      const code = params[k]
      if (code === 0) {
        color = undefined
        bold = false
      } else if (code === 1) {
        bold = true
      } else if (code === 22) {
        bold = false
      } else if (code === 39) {
        color = undefined
      } else if ((code === 38 || code === 48) && params[k + 1] === 2) {
        if (code === 38) color = hex(params[k + 2] ?? 0, params[k + 3] ?? 0, params[k + 4] ?? 0)
        k += 4
      } else if ((code === 38 || code === 48) && params[k + 1] === 5) {
        if (code === 38) color = xterm256(params[k + 2] ?? -1)
        k += 2
      }
    }
  }
  text += source.slice(at)
  flush()

  // Other control characters (a stray escape, a tab) would draw as boxes.
  for (const run of runs) run.text = run.text.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
  return runs.filter(run => run.text !== '')
}

/** The renderer's whole output as lines, trailing blank lines dropped. */
export const parseAnsi = (output: string): Line[] => {
  const lines = output.replace(/\r/g, '').split('\n').map(parseLine)
  while (lines.length > 0 && (lines[lines.length - 1] ?? []).every(run => run.text.trim() === '')) {
    lines.pop()
  }
  return lines
}
