import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import type { StatusJson } from '../types'
import { parseAnsi } from './ansi'
import { buildView, countdown, forecastOf, hudSvg, paceOf, shortTool, sparkline } from './gauges'
import { keepExpiredWindows, prettyModel } from './register'

const E = '\x1b'
// Two lines as the renderer writes them (large preset, shortened).
const OUTPUT =
  `🤖 ${E}[1m${E}[38;2;148;226;213mOpus 5.5${E}[0m ${E}[38;2;250;179;135m⚡high${E}[0m${E}[K\n` +
  `🧠 ${E}[38;2;245;194;231mContext${E}[0m   ${E}[38;2;245;194;231m█${E}[38;2;234;99;119m░░${E}[0m ${E}[1m 23%${E}[0m${E}[K\n`

const BAND = {
  plugin: 'awesome-statusline-mod',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 12 },
    view: {},
  },
} as const

test('ANSI output becomes coloured runs, line by line', async () => {
  const lines = parseAnsi(OUTPUT)

  expect(lines.length).toBe(2)
  expect(lines[0]?.[1]).toEqual({ text: 'Opus 5.5', color: '#94e2d5', bold: true })
  expect(lines[0]?.[3]).toEqual({ text: '⚡high', color: '#fab387' })
  expect(lines[1]?.map(run => run.text).join('')).toBe('🧠 Context   █░░  23%')
})

test('model ids read as the statusline names them', async () => {
  expect(prettyModel('claude-opus-5-5')).toBe('Opus 5.5')
  expect(prettyModel('claude-opus-5-5[1m]')).toBe('Opus 5.5')
  expect(prettyModel('claude-sonnet-5-5-20261001')).toBe('Sonnet 5.5')
  expect(prettyModel('claude-fable-5-1')).toBe('Fable 5.1')
  expect(prettyModel('opus')).toBe('Opus')
  expect(prettyModel('gpt-x')).toBe('gpt-x')
})

test('a 5-hour window past its reset reads as a fresh 0%, so Pro / Max keep their layout', async () => {
  const seen = new Map([['five_hour', 1_000], ['seven_day', 9_000]])
  const weekly = { seven_day: { used_percentage: 12, resets_at: 9_000 } }

  // Reset time passed and Claude Code stopped reporting it: a fresh window.
  expect(keepExpiredWindows(weekly, seen, 2_000)).toEqual({ ...weekly, five_hour: { used_percentage: 0 } })
  // Not reported but not past its reset: left out, as reported.
  expect(keepExpiredWindows(weekly, seen, 500)).toEqual(weekly)
  // Reported again: the report wins.
  const both = { ...weekly, five_hour: { used_percentage: 3, resets_at: 19_000 } }
  expect(keepExpiredWindows(both, seen, 2_000)).toEqual(both)
  // Never seen (Ultra): nothing added.
  expect(keepExpiredWindows(weekly, new Map([['seven_day', 9_000]]), 2_000)).toEqual(weekly)
})

const seed = (on: On, hasStatusLine: boolean) => {
  on('state.get', (_, e) => {
    const key = (e as { key?: string }).key
    if (key === 'snapshot') return { value: { value: { output: OUTPUT, error: null }, version: 1 } }
    if (key === 'hasStatusLine') return { value: { value: hasStatusLine, version: 1 } }
    return { value: { value: undefined, version: 0 } }
  })
}

test('the band draws the renderer output on the terminal and in the desktop app', async ($, on) => {
  seed(on, false)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /Opus/ }))?.text).toContain('Opus')
    expect(await ui.find({ type: 'Text', text: /23%/ })).toBeDefined()
    await ui.unmount()
  }
})

test('with a statusLine set, the terminal keeps the band empty and the desktop app still draws it', async ($, on) => {
  seed(on, true)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await terminal.find({ type: 'Text', text: /Opus/ })).toBeUndefined()
  await terminal.unmount()

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desktop.find({ type: 'Text', text: /Opus/ })).toBeDefined()
  await desktop.unmount()
})

// ---------------------------------------------------------------- cockpit

const NOW_S = 1_800_000_000
const STATUS: StatusJson = {
  session_id: 's1',
  cwd: '/tmp/demo',
  model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' },
  workspace: { current_dir: '/tmp/demo', project_dir: '/tmp/demo' },
  version: '2.1.316',
  output_style: { name: 'default' },
  effort: { level: 'xhigh' },
  thinking: { enabled: true },
  cost: { total_cost_usd: 0, total_duration_ms: 3_900_000 },
  context_window: { context_window_size: 1_000_000, used_percentage: 32, remaining_percentage: 68, current_usage: 320_000 },
  rate_limits: {
    five_hour: { used_percentage: 34, resets_at: NOW_S + 2 * 3600 + 600 },
    seven_day: { used_percentage: 65, resets_at: NOW_S + 2 * 86_400 + 14 * 3600 },
  },
}

test('cockpit figures: countdowns, pace and the forecast', async () => {
  expect(countdown(12_600)).toBe('3h30m')
  expect(countdown(590_000)).toBe('6d19h')
  expect(countdown(2_880)).toBe('48m')
  expect(paceOf(34, 0.56)).toBe('under')
  expect(paceOf(55, 0.57)).toBe('on')
  // 23% with 17% of the week gone: past 100% by the reset, as the forecast says.
  expect(paceOf(23, 0.17)).toBe('ahead')
  expect(forecastOf(23, NOW_S + 5 * 86_400 + 19 * 3600, 604_800, NOW_S)).toContain('before it resets')
  expect(paceOf(70, 0.5)).toBe('ahead')
  expect(paceOf(91, 0.99)).toBe('ahead')
  // 34% used with 2h50m of 5h gone: about 60% by the reset.
  expect(forecastOf(34, NOW_S + 7_800, 18_000, NOW_S)).toContain('about 60% by the reset')
  // 80% used after 2h of 5h: full before the reset.
  expect(forecastOf(80, NOW_S + 10_800, 18_000, NOW_S)).toContain('before it resets')
  expect(sparkline([0, 50, 100, null], 4)).toBe('▁▅█ ')
  expect(shortTool('mcp__github__create_issue')).toBe('mcp:github')
})

test('cockpit view: three dials on Pro / Max, two and a per-day budget on Ultra', async () => {
  const pro = buildView(STATUS, NOW_S * 1000)
  expect(pro.gauges.map(g => g.label)).toEqual(['CONTEXT', '5-HOUR', '7-DAY'])
  expect(pro.gauges[1]?.pace).toBe('under')

  const ultra = buildView({ ...STATUS, rate_limits: { seven_day: { used_percentage: 48, resets_at: NOW_S + 2 * 86_400 } } }, NOW_S * 1000)
  expect(ultra.gauges.map(g => g.label)).toEqual(['CONTEXT', 'WEEKLY'])
  expect(ultra.forecast[0]?.text).toContain('≈26%/day')

  const loading = buildView({ ...STATUS, rate_limits: undefined }, NOW_S * 1000)
  expect(loading.gauges.map(g => g.sub)).toEqual(['320k / 1M', 'loading..', 'loading..'])

  // Before the first request: 0%, as the statusline shows it.
  const fresh = buildView({ ...STATUS, context_window: { context_window_size: 1_000_000 } }, NOW_S * 1000)
  expect([fresh.gauges[0]?.pct, fresh.gauges[0]?.sub]).toEqual([0, '0k / 1M'])

  const svg = hudSvg(pro, [], { running: [], counts: {}, calls: 0 }, NOW_S * 1000)
  expect(svg.source.startsWith('<svg')).toBe(true)
  expect(svg.alt).toContain('CONTEXT 32%')
})

const PANE_MOUNT = {
  plugin: 'awesome-statusline-mod',
  component: 'Pane',
  requestId: 'cockpit',
  props: { title: 'Cockpit', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const seedCockpit = (on: On) => {
  on('clock.now', () => ({ value: NOW_S * 1000 + 12_000 }))
  on('state.get', (_, e) => {
    const key = (e as { key?: string }).key
    if (key === 'status') return { value: { value: STATUS, version: 1 } }
    if (key === 'history') {
      const t = NOW_S * 1000
      return { value: { value: [{ t: t - 120_000, ctx: 20, h5: 30, d7: 64 }, { t: t - 60_000, ctx: 32, h5: 34, d7: 65 }], version: 1 } }
    }
    if (key === 'activity') {
      return { value: { value: { running: [{ id: 't1', tool: 'Bash', since: NOW_S * 1000, isAgent: false }], counts: { Read: 9, Bash: 4 }, calls: 13 }, version: 1 } }
    }
    return { value: { value: undefined, version: 0 } }
  })
}

const PLACED = { id: 'cockpit', title: 'Cockpit', isShown: true, isFocused: false, isPlaced: true }
// The person typing /cockpit at the main screen.
const COCKPIT = { command: 'cockpit', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

// The snapshot is seeded; `cockpitShown` goes to the store beneath, as written.
const seedBand = (on: On) => {
  on('state.get', (_, e, next) => {
    const key = (e as { key?: string }).key
    if (key === 'snapshot') return { value: { value: { output: OUTPUT, error: null }, version: 1 } }
    return next(e)
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
}

const bandShows = async ($: Engine, surface: 'terminal' | 'desktop') => {
  const ui = await $.ui.mount({ ...BAND, surface })
  const found = await ui.find({ type: 'Text', text: /Opus/ })
  await ui.unmount()
  return found !== undefined
}

test('/cockpit hides the band on the terminal and in the desktop app', async ($, on) => {
  let panes: (typeof PLACED)[] = []
  on('ui.open', () => {
    panes = [PLACED]
    return { value: { isPlaced: true } }
  })
  on('ui.panes', () => ({ value: panes }))
  seedBand(on)

  expect(await bandShows($, 'desktop')).toBe(true)
  expect((await $.command.run(COCKPIT)).text).toBe('Cockpit opened.')
  expect(await bandShows($, 'terminal')).toBe(false)
  expect(await bandShows($, 'desktop')).toBe(false)
})

test('a cockpit left up across a reload hides the band, and its close brings the band back by the next tick', async ($, on) => {
  const clock = mock.clock(on, { now: NOW_S * 1000 })
  let panes: (typeof PLACED)[] = [PLACED]
  on('ui.panes', () => ({ value: panes }))
  on('command.register', () => ({ value: { command: 'cockpit' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  seedBand(on)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(await bandShows($, 'desktop')).toBe(false)

  // Closed by hand, or dropped: no event of ours, the tick finds it gone.
  panes = []
  await clock.advance(1_000)
  expect(await bandShows($, 'desktop')).toBe(true)
})

test('a cockpit opened but not yet placed leaves the band up', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'the terminal is 100 columns; 144 places it' } }))
  on('ui.panes', () => ({ value: [{ id: 'cockpit', title: 'Cockpit', isShown: false, isFocused: false, isPlaced: false }] }))
  seed(on, false)

  await $.command.run(COCKPIT)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Opus/ })).toBeDefined()
  await ui.unmount()
})

test('the cockpit pane draws on the terminal and in the desktop app', async ($, on) => {
  seedCockpit(on)

  const terminal = await $.ui.mount({ ...PANE_MOUNT, surface: 'terminal' })
  expect(await terminal.find({ type: 'Text', text: /COCKPIT/ })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: /5-HOUR/ })).toBeDefined()
  expect(await terminal.find({ type: 'Button', text: /Compact now/ })).toBeDefined()
  await terminal.unmount()

  const desktop = await $.ui.mount({ ...PANE_MOUNT, surface: 'desktop' })
  const svg = await desktop.find({ type: 'Svg' })
  expect(svg).toBeDefined()
  expect(await desktop.find({ type: 'Button', text: /Compact now/ })).toBeDefined()
  await desktop.unmount()
})
