import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import type { StatusJson } from '../types'
import { parseAnsi } from './ansi'
import { cpuFromPs, diskFromDf, fromLocal, fromOneTop, memFromPressure, netBytes, TEXT, treemap, trimOneTop } from './dash'
import { clusterSvg, dashboardSvg, sectionSvg } from './cluster'
import { buildView, countdown, forecastOf, paceOf, shortTool, sparkline } from './gauges'
import { addCacheUsage, keepExpiredWindows, NO_CACHE, prettyModel, promptCacheOf } from './register'

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
  expect(prettyModel('claude-fable-5-2')).toBe('Fable 5.2')
  expect(prettyModel('us.anthropic.claude-fable-5-2')).toBe('Fable 5.2')
  expect(prettyModel('claude-mythos-5-2')).toBe('Mythos 5.2')
  expect(prettyModel('fable')).toBe('Fable')
  expect(prettyModel('opus')).toBe('Opus')
  expect(prettyModel('gpt-x')).toBe('gpt-x')
})

test('the prompt cache: hit ratio, warm until the TTL runs out, then cold', async () => {
  const T = 1_000_000_000_000
  // A first write at 1h TTL, then two reads.
  let stats = addCacheUsage(NO_CACHE, { input_tokens: 2_000, cache_creation_input_tokens: 40_000, cache_read_input_tokens: 0, cache_creation: { ephemeral_1h_input_tokens: 40_000, ephemeral_5m_input_tokens: 0 } }, T, 5)
  stats = addCacheUsage(stats, { input_tokens: 1_000, cache_creation_input_tokens: 3_000, cache_read_input_tokens: 40_000 }, T + 60_000, 5)
  stats = addCacheUsage(stats, { input_tokens: 1_000, cache_creation_input_tokens: 2_000, cache_read_input_tokens: 43_000 }, T + 120_000, 5)

  const warm = promptCacheOf(stats, T + 600_000)
  expect(warm?.warm).toBe(true)
  expect(warm?.ttl).toBe('1h')
  expect(warm?.expires_at).toBe(Math.ceil((T + 120_000 + 3_600_000) / 1000))
  expect(warm?.requests).toBe(3)
  expect(Math.round((warm?.hit_ratio ?? 0) * 100)).toBe(63)
  expect(warm?.recache_tokens_if_cold).toBe(46_000)

  // Past the TTL: cold.
  expect(promptCacheOf(stats, T + 120_000 + 3_600_001)?.warm).toBe(false)
  // No request yet: nothing to report; a request without cache tokens: not observed.
  expect(promptCacheOf(NO_CACHE, T)).toBe(undefined)
  expect(promptCacheOf(addCacheUsage(NO_CACHE, { input_tokens: 900 }, T, 5), T)?.caching_observed).toBe(false)
  // /clear moves the session's start up: the counts start over.
  expect(addCacheUsage(stats, { input_tokens: 500, cache_read_input_tokens: 500 }, T, 9).requests).toBe(1)
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

})

// What 1top's GET /api/state carries, cut down: two accounts, two sessions, events.
const ONETOP_RAW = {
  action_token: 'secret-write-token',
  account_quotas: [
    { kind: 'Claude', plan: 'max', account_label: 'me@example.com', stale: false, windows: [{ label: '5H', pct: 48 }, { label: '주간', pct: 24 }] },
    { kind: 'Codex', plan: 'pro', stale: false, windows: [{ label: '주간', pct: 74 }] },
    { kind: 'Antigravity', plan: '', stale: false, windows: [{ label: '주간', pct: 0 }] },
  ],
  root_sessions: [
    { id: 'a', kind: 'Claude', project: 'claude-statusline', title: 'private', status: 'working', model: 'claude-opus-5-5', effort: 'xhigh', children_count: 2, location: { app: 'Terminal' }, usage: { windows: { '1h': [1, 900, 50, 49] }, weekly_estimate: { '1h': { used_pp: 7.4 } } } },
    { id: 'b', kind: 'Codex', project: 'artex', status: 'idle', model: 'gpt-6-astra', effort: 'high', location: { app: 'ChatGPT' }, usage: { windows: { '1h': [0, 300, 0, 0] } } },
  ],
  events: [{ t: NOW_S - 600, kind: 'Claude', fresh: 1, cached: 900, written: 50, output: 49 }, { t: NOW_S - 60, kind: 'Codex', fresh: 0, cached: 300, written: 0, output: 0 }],
  system: { host: { cpu: 33.7, memory: { percent: 59.8 }, network: { rx: 23_600, tx: 1_000 }, disk: { free: 44.6e9 } } },
}

test('the dashboard from 1top: accounts, flow, map and sessions, the write token dropped', async () => {
  const st = trimOneTop(ONETOP_RAW)
  expect(JSON.stringify(st)).not.toContain('secret-write-token')
  expect(JSON.stringify(st)).not.toContain('me@example.com')
  const d = fromOneTop(st, '1h', NOW_S, TEXT.ko)
  expect(d.accounts.map(m => [m.title, m.index, m.pct, m.sub])).toEqual([
    ['Claude Code', 1, 24, 'Max · 주간 · 5H 48%'],
    ['Codex', 1, 74, 'Pro · 주간'],
  ])
  expect(d.flowTotal).toBe(1300)
  expect(d.kinds).toEqual(['Claude', 'Codex'])
  expect(d.tiles.map(x => x.label)).toEqual(['claude-statusline', 'artex'])
  expect(d.sessions[0]).toMatchObject({ project: 'claude-statusline', children: 2, app: 'Terminal', model: 'Opus 5.5', share: 7.4, sharePerHour: 7.4, account: 1 })
  expect(d.resources?.cpu).toBe(33.7)
  expect(d.tokensPerHour).toBe(1300)
  expect(d.counts).toMatchObject({ working: 1 })
  expect(d.models.map(m => m.name)).toEqual(['Opus 5.5', 'gpt-6-astra'])

  for (const theme of ['dark', 'light'] as const) {
    const cluster = clusterSvg(d, TEXT.ko, theme, '1h', { since: NOW_S - 3600, total: 434e6, lastT: NOW_S }, NOW_S)
    expect(cluster.source.startsWith('<svg')).toBe(true)
    expect(cluster.alt).toContain('1,300')
    expect(dashboardSvg(d, TEXT.ko, theme, '1h').alt).toContain('Opus 5.5')
    for (const section of ['sessions', 'flow', 'limits', 'map', 'heat', 'resources', 'session'] as const) {
      const s = sectionSvg(section, d, TEXT.ko, theme, '1h', { session: buildView(STATUS, NOW_S * 1000, 'ko'), activity: { running: [], counts: {}, calls: 0 }, minutes: [[NOW_S - 600, 1000]], nowMs: NOW_S * 1000 })
      expect(s.source.startsWith('<svg')).toBe(true)
    }
  }
})

test('the dashboard without 1top: this session and the records of the others', async () => {
  const fleet = [
    { v: 1, id: 's1', project: 'claude-statusline', app: 'Orca', model: 'Opus 5.5', effort: 'xhigh', status: 'working', children: 1, updatedS: NOW_S - 10, bins: [[NOW_S - 120, 5_000], [NOW_S - 60, 3_000]] },
    { v: 1, id: 's2', project: 'old', app: 'Terminal', model: 'Opus 5.5', effort: null, status: 'idle', children: 0, updatedS: NOW_S - 7_200, bins: [[NOW_S - 7_300, 9_000]] },
  ] as const
  const d = fromLocal(STATUS, fleet.map(r => ({ ...r, bins: r.bins.map(b => [...b] as [number, number]) })), null, '1h', NOW_S, TEXT.en)
  expect(d.source).toBe('local')
  expect(d.accounts.map(m => [m.window, m.sub])).toEqual([['Weekly', 'Weekly · 5H 34%']])
  expect(d.flowTotal).toBe(8_000)
  expect(d.sessions.map(s => s.project)).toEqual(['claude-statusline'])
})

test('resources from macOS commands, and the treemap fills its box', async () => {
  expect(cpuFromPs(' 50.0\n 30.0\n 10.0\n', 4)).toBe(22.5)
  expect(cpuFromPs('', 4)).toBe(null)
  expect(memFromPressure('System-wide memory free percentage: 48%')).toBe(52)
  expect(diskFromDf('Filesystem 1024-blocks Used Available Capacity\n/dev/disk3s1s1 100 10 366265204 4% /')).toBe(366_265_204 * 1024)
  const net = 'Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll\nlo0 16384 <Link#1> 1 0 999 1 0 999 0\nen0 1500 <Link#11> aa:bb 1 0 100 1 0 40 0'
  expect(netBytes(net)).toEqual({ rx: 100, tx: 40 })
  const tiles = treemap([{ label: 'a', tokens: 3, kind: 'Claude' }, { label: 'b', tokens: 1, kind: 'Codex' }], { x: 0, y: 0, w: 100, h: 50 })
  expect(tiles.map(r => Math.round(r.w))).toEqual([75, 25])
})

const PANE_MOUNT = {
  plugin: 'awesome-statusline-mod',
  component: 'Pane',
  requestId: 'cockpit',
  props: { title: 'Cockpit', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const seedCockpit = (on: On) => {
  on('clock.now', () => ({ value: NOW_S * 1000 + 12_000 }))
  on('settings.read', () => ({ value: { language: 'Korean' } }))
  on('env.get', () => ({ value: undefined }))
  on('state.get', (_, e, next) => {
    const key = (e as { key?: string }).key
    if (key === 'status') return { value: { value: STATUS, version: 1 } }
    if (key === 'history') {
      const t = NOW_S * 1000
      return { value: { value: [{ t: t - 120_000, ctx: 20, h5: 30, d7: 64 }, { t: t - 60_000, ctx: 32, h5: 34, d7: 65 }], version: 1 } }
    }
    if (key === 'activity') {
      return { value: { value: { running: [{ id: 't1', tool: 'Bash', since: NOW_S * 1000, isAgent: false }], counts: { Read: 9, Bash: 4 }, calls: 13 }, version: 1 } }
    }
    return next(e)
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
  expect(await terminal.find({ type: 'Text', text: /콕핏/ })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: /Claude/ })).toBeDefined()
  expect(await terminal.find({ type: 'Button', text: /1시간/ })).toBeDefined()
  expect(await terminal.find({ type: 'Button', text: /지금 compact/ })).toBeDefined()
  await terminal.unmount()

  const desktop = await $.ui.mount({ ...PANE_MOUNT, surface: 'desktop' })
  expect(await desktop.find({ type: 'Svg' })).toBeDefined()
  expect(await desktop.find({ type: 'Button', text: /24시간/ })).toBeDefined()
  expect(await desktop.find({ type: 'Button', text: /지금 compact/ })).toBeDefined()
  expect(await desktop.find({ type: 'Button', text: /대시보드/ })).toBeDefined()
  expect(await desktop.find({ type: 'Button', text: /히트맵/ })).toBeDefined()
  await desktop.unmount()
})

test('the period tabs and the view pager change what the cockpit draws', async ($, on) => {
  seedCockpit(on)
  const stored = new Map<string, unknown>()
  on('store.set', (_, e) => {
    const x = e as { key: string; value: unknown }
    stored.set(x.key, x.value)
    return { value: undefined }
  })
  const desktop = await $.ui.mount({ ...PANE_MOUNT, surface: 'desktop' })
  await desktop.press({ key: 'period-24h' })
  const svg = await desktop.find({ type: 'Svg' })
  expect(String((svg?.props as { alt?: string } | undefined)?.alt)).toContain('최근 24시간')
  await desktop.press({ key: 'view' })
  expect(String(((await desktop.find({ type: 'Svg' }))?.props as { alt?: string } | undefined)?.alt)).toContain('대시보드')
  await desktop.press({ key: 'section-heat' })
  await desktop.press({ key: 'theme' })
  expect([stored.get('cockpit.period'), stored.get('cockpit.view'), stored.get('cockpit.section'), stored.get('cockpit.theme')]).toEqual(['24h', 'dashboard', 'heat', 'light'])
  await desktop.unmount()
})
