// The cockpit (prototype): a pane beside the chat drawn as 1top's menu bar, in
// its light and dark themes and its two views. The instrument cluster has two
// dials (tokens and weekly limit per hour), the status strip, the odometer with
// a trip counter, and what is left of each limit; the dashboard has a radial
// token chart, the model mix and the account cards. Below either: sessions,
// token flow, limits, usage map, heatmap, resources and this session.
//
// With the 1top app running on this computer it shows every AI's accounts and
// sessions from 1top's local API; without it, this computer's resources and the
// Claude Code sessions running this mod. `/cockpit` opens it; the option
// `cockpit: auto` opens it at every session start. The desktop app draws it as
// SVG, the terminal as text. While it is drawn the band above the prompt steps aside.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Activity, FleetRecord, LangChoice, OneTopState, Period, Resources, Sample, Section, StatusJson, Theme, Trip, View } from '../types'
import { THEMES, clusterSvg, dashboardSvg, sectionSvg } from './cluster'
import { addTokens, advanceTrip, compactNumber, fromLocal, fromOneTop, KIND_NAME, KIND_SHORT, langOf, pctRate, PERIODS, rate, SECTIONS, shareText, size, TEXT, VIEWS } from './dash'
import { buildView, shortTool, textBar } from './gauges'
import { appName, fetchOneTop, pruneFleet, readFleet, sampleResources, writeFleet } from './sources'
import type { NetMark } from './sources'

const status = atom({ plugin: 'awesome-statusline-mod', key: 'status' } as const, null as StatusJson | null)
const history = atom({ plugin: 'awesome-statusline-mod', key: 'history' } as const, [] as Sample[])
const activity = atom(
  { plugin: 'awesome-statusline-mod', key: 'activity' } as const,
  { running: [], counts: {}, calls: 0 } as Activity,
)
const cockpitShown = atom({ plugin: 'awesome-statusline-mod', key: 'cockpitShown' } as const, false)
const cockpitView = atom({ plugin: 'awesome-statusline-mod', key: 'cockpitView' } as const, 'cluster' as View)
const cockpitPeriod = atom({ plugin: 'awesome-statusline-mod', key: 'cockpitPeriod' } as const, '1h' as Period)
const cockpitTheme = atom({ plugin: 'awesome-statusline-mod', key: 'cockpitTheme' } as const, 'dark' as Theme)
const cockpitSection = atom({ plugin: 'awesome-statusline-mod', key: 'cockpitSection' } as const, 'sessions' as Section)
const cockpitLang = atom({ plugin: 'awesome-statusline-mod', key: 'cockpitLang' } as const, 'auto' as LangChoice)
const trip = atom({ plugin: 'awesome-statusline-mod', key: 'trip' } as const, null as Trip | null)
const oneTop = atom({ plugin: 'awesome-statusline-mod', key: 'oneTop' } as const, null as OneTopState | null)
const resources = atom({ plugin: 'awesome-statusline-mod', key: 'resources' } as const, null as Resources | null)
const fleet = atom({ plugin: 'awesome-statusline-mod', key: 'fleet' } as const, [] as FleetRecord[])
const tokenBins = atom({ plugin: 'awesome-statusline-mod', key: 'tokenBins' } as const, [] as [number, number][])
const isWorking = atom({ plugin: 'awesome-statusline-mod', key: 'isWorking' } as const, false)

export const PANE = 'cockpit'
const openArgs = (theme: Theme) => ({ id: PANE, title: 'Cockpit', backgroundColor: THEMES[theme].bg })
const MAX_SAMPLES = 240
const SAMPLE_EVERY_MS = 60_000
const REFRESH_MS = 5_000
const RESOURCES_EVERY_MS = 10_000

// Module state: a reload starts it over.
let lastRefresh = 0
let lastResources = 0
let isRefreshing = false
let netMark: NetMark | null = null
let app: string | null = null

/** Hands the cockpit the figures the band just rendered from, and tells the other sessions' cockpits. */
export async function publishStatus($: EngineInterface, s: StatusJson, nowMs: number) {
  await update($, status, () => s)
  await recordSample($, s, nowMs)
  app ??= await appName($)
  const a = await read($, activity)
  const record: FleetRecord = {
    v: 1,
    id: s.session_id,
    project: s.workspace.project_dir.split('/').filter(Boolean).pop() ?? s.workspace.project_dir,
    app,
    model: s.model.display_name,
    effort: s.effort?.level ?? null,
    status: (await read($, isWorking)) ? 'working' : 'idle',
    children: a.running.filter(r => r.tool === 'Agent' || r.tool === 'Task').length,
    updatedS: Math.floor(nowMs / 1000),
    bins: await read($, tokenBins),
  }
  await writeFleet($, record)
}

async function recordSample($: EngineInterface, s: StatusJson, nowMs: number) {
  const sample: Sample = {
    t: nowMs,
    ctx: s.context_window.used_percentage ?? null,
    h5: s.rate_limits?.five_hour?.used_percentage ?? null,
    d7: s.rate_limits?.seven_day?.used_percentage ?? null,
  }
  const list = await read($, history)
  const last = list[list.length - 1]
  const isSame = last !== undefined && last.ctx === sample.ctx && last.h5 === sample.h5 && last.d7 === sample.d7
  if (last !== undefined && isSame && nowMs - last.t < SAMPLE_EVERY_MS) return
  await update($, history, l => [...l, sample].slice(-MAX_SAMPLES))
}

/** Every request's tokens (all four kinds), for the token flow and the usage map. */
export async function countTokens($: EngineInterface, usage: unknown) {
  const u = (usage ?? {}) as Record<string, unknown>
  const n = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']
    .map(k => (typeof u[k] === 'number' ? (u[k] as number) : 0))
    .reduce((x, y) => x + y, 0)
  if (n <= 0) return
  const nowS = Math.floor((await $.clock.now()) / 1000)
  await update($, tokenBins, bins => addTokens(bins, nowS, n))
}

/** Whether a turn of the main loop is running. */
export async function markWorking($: EngineInterface, value: boolean) {
  if ((await read($, isWorking)) !== value) await update($, isWorking, () => value)
}

/** Starts work nobody waits for; a failure of it is dropped, not left unhandled. */
const fire = (work: Promise<unknown>) => {
  work.catch(() => undefined)
}

// A failure here must never fail the tool call it watches.
const quietly = async (work: () => Promise<unknown>) => {
  try {
    await work()
  } catch {
    // the cockpit misses one update; the call goes on
  }
}

/** Whether a surface draws the cockpit now; read while drawing the band, it redraws it on a change. */
export async function isCockpitShown($: EngineInterface) {
  return read($, cockpitShown)
}

/**
 * Keeps `cockpitShown` to the engine's record of the pane. Run after an open
 * and a close, and on the band's tick, for what raises no event of ours: a
 * pane placed once the terminal widens, or dropped as its drawing threw.
 */
export async function syncCockpit($: EngineInterface) {
  try {
    const isShown = (await $.ui.panes()).some(pane => pane.id === PANE && pane.isPlaced)
    if ((await read($, cockpitShown)) !== isShown) await update($, cockpitShown, () => isShown)
  } catch {
    // the band keeps its last word until the next tick
  }
}

/** Every finished minute of the last day as [epoch s, tokens], all sessions summed. */
const minutesOf = (ot: OneTopState | null, records: readonly FleetRecord[]): [number, number][] => {
  const by = new Map<number, number>()
  if (ot !== null) for (const [t, , n] of ot.events) by.set(t, (by.get(t) ?? 0) + n)
  else for (const r of records) for (const [t, n] of r.bins) by.set(t, (by.get(t) ?? 0) + n)
  return [...by.entries()].sort((a, b) => a[0] - b[0])
}

/** On the band's tick: while the cockpit is drawn, its figures every few seconds. */
export async function refreshCockpit($: EngineInterface) {
  if (isRefreshing || !(await read($, cockpitShown))) return
  const now = await $.clock.now()
  if (now - lastRefresh < REFRESH_MS) return
  isRefreshing = true
  lastRefresh = now
  try {
    const ot = await fetchOneTop($)
    await update($, oneTop, () => ot)
    let records = await read($, fleet)
    if (ot === null) {
      if (now - lastResources >= RESOURCES_EVERY_MS) {
        lastResources = now
        const sampled = await sampleResources($, netMark, now)
        netMark = sampled.mark
        await update($, resources, () => sampled.resources)
      }
      records = await readFleet($, now)
      await update($, fleet, () => records)
    }
    const nowS = Math.floor(now / 1000)
    const current = (await read($, trip)) ?? { since: nowS, total: 0, lastT: nowS }
    const next = advanceTrip(current, minutesOf(ot, records), nowS)
    await update($, trip, () => next)
    await quietly(() => $.store.set('cockpit.trip', next))
  } finally {
    isRefreshing = false
  }
}

const isOneOf = <T extends string>(list: readonly T[]) => (v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v)
const isView = isOneOf(VIEWS)
const isPeriod = isOneOf(PERIODS)
const isSection = isOneOf(SECTIONS)
const isTheme = isOneOf(['dark', 'light'] as const)
const isLang = isOneOf(['auto', 'ko', 'en'] as const)

/** Registers /cockpit, restores the person's last choices, and opens the pane where the option says so; from session.start. */
export async function startCockpit($: EngineInterface, mode: 'command' | 'auto') {
  await $.command.register({
    name: 'cockpit',
    description: 'Open the Awesome Statusline cockpit: dials, accounts, token flow and running sessions',
  })
  // A reload finds the pane as it was left.
  await syncCockpit($)
  await quietly(async () => {
    const [view, period, theme, section, lang, saved] = await Promise.all(
      ['cockpit.view', 'cockpit.period', 'cockpit.theme', 'cockpit.section', 'cockpit.lang', 'cockpit.trip'].map(k => $.store.get(k)),
    )
    if (isView(view)) await update($, cockpitView, () => view)
    if (isPeriod(period)) await update($, cockpitPeriod, () => period)
    if (isTheme(theme)) await update($, cockpitTheme, () => theme)
    if (isSection(section)) await update($, cockpitSection, () => section)
    if (isLang(lang)) await update($, cockpitLang, () => lang)
    const tr = saved as Trip | undefined
    if (tr && typeof tr.since === 'number' && typeof tr.total === 'number' && typeof tr.lastT === 'number') await update($, trip, () => tr)
  })
  if (mode === 'auto') fire($.ui.open(openArgs(await read($, cockpitTheme))).then(() => syncCockpit($)))
  fire(quietly(() => pruneFleet($)))
}

export function registerCockpit(on: On) {
  on('command.run', { command: 'cockpit' }, async $ => {
    const opened = await $.ui.open(openArgs(await read($, cockpitTheme)))
    await syncCockpit($)
    lastRefresh = 0
    return { text: opened.isPlaced ? 'Cockpit opened.' : `Cockpit is waiting to be placed (${opened.reason}).` }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    const result = await next(e)
    await syncCockpit($)
    return result
  })

  on('tool.call', async ($, e, next) => {
    const now = await $.clock.now()
    const run = { id: e.tool_use_id, tool: shortTool(String(e.tool)), since: now, isAgent: e.agentId !== undefined }
    await quietly(() => update($, activity, a => ({ ...a, running: [...a.running, run].slice(-20) })))
    try {
      return await next(e)
    } finally {
      await quietly(() =>
        update($, activity, a => ({
          running: a.running.filter(r => r.id !== run.id),
          counts: { ...a.counts, [run.tool]: (a.counts[run.tool] ?? 0) + 1 },
          calls: a.calls + 1,
        })),
      )
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const [s, a, samples, view, period, theme, section, langChoice, tr, ot, res, records, now, settings, locale] = await Promise.all([
      read($, status),
      read($, activity),
      read($, history),
      read($, cockpitView),
      read($, cockpitPeriod),
      read($, cockpitTheme),
      read($, cockpitSection),
      read($, cockpitLang),
      read($, trip),
      read($, oneTop),
      read($, resources),
      read($, fleet),
      $.clock.now(),
      $.settings.read(),
      $.env.get('LANG'),
    ])
    const lang = langOf(langChoice, (settings as Record<string, unknown> | undefined)?.language, locale ?? null)
    const t = TEXT[lang]
    const nowS = Math.floor(now / 1000)
    const d = ot !== null ? fromOneTop(ot, period, nowS, t) : fromLocal(s, records, res, period, nowS, t, pctRate(samples, period, now))
    const session = s === null ? null : buildView(s, now, lang)
    const th = THEMES[theme]

    const nextView: View = view === 'cluster' ? 'dashboard' : 'cluster'
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    const nextLang: LangChoice = lang === 'ko' ? 'en' : 'ko'
    const pickPeriod = (p: Period) => () => {
      fire(update($, cockpitPeriod, () => p))
      fire($.store.set('cockpit.period', p))
    }
    const pickSection = (x: Section) => () => {
      fire(update($, cockpitSection, () => x))
      fire($.store.set('cockpit.section', x))
    }
    const toggleView = () => {
      fire(update($, cockpitView, () => nextView))
      fire($.store.set('cockpit.view', nextView))
    }
    const toggleLang = () => {
      fire(update($, cockpitLang, () => nextLang))
      fire($.store.set('cockpit.lang', nextLang))
    }
    const toggleTheme = () => {
      fire(update($, cockpitTheme, () => nextTheme))
      fire($.store.set('cockpit.theme', nextTheme))
      fire($.ui.open(openArgs(nextTheme)))
    }
    const resetTrip = () => {
      const fresh = { since: nowS, total: 0, lastT: nowS }
      fire(update($, trip, () => fresh))
      fire($.store.set('cockpit.trip', fresh))
    }
    const compact = () => {
      fire($.session.compact())
    }
    const live = d.source === '1top' ? t.live1top : t.liveLocal
    const isHot = (session?.contextPct ?? 0) >= 75

    if (e.surface === 'terminal') {
      const { Box, Text, Button } = $.ui.resolve(e)
      const barW = Math.max(6, Math.min(14, e.props.bodyColumns - 46))
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text color={th.accent} weight="bold">{`● ${t.title}`}</Text>
            <Text dimColor>{live}</Text>
            <Button key="view" plain onPress={toggleView}>
              {t.views[nextView]}
            </Button>
            <Button key="lang" plain onPress={toggleLang}>
              {lang === 'ko' ? 'EN' : '한'}
            </Button>
          </Box>
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {PERIODS.map(p => (
              <Button key={`period-${p}`} variant={p === period ? 'primary' : 'secondary'} onPress={pickPeriod(p)}>
                {t.periods[p]}
              </Button>
            ))}
          </Box>
          <Text wrap="truncate-end">
            <Text weight="bold">{compactNumber(d.tokensPerHour)}</Text>
            <Text dimColor>{` ${t.tokensPerHour}   `}</Text>
            <Text weight="bold">{d.pctPerHour === null ? '--' : d.pctPerHour.toFixed(2)}</Text>
            <Text dimColor>{` ${t.pctPerHour}   ${t.strip.working} ${d.counts.working} · ${t.strip.waiting} ${d.counts.waiting} · ${t.strip.low} ${d.counts.low}`}</Text>
          </Text>
          <Text wrap="truncate-end">
            <Text dimColor>{`${t.total} · ${t.recent[period]} `}</Text>
            <Text weight="bold">{Math.round(d.flowTotal).toLocaleString('en-US')}</Text>
            <Text dimColor>{tr === null ? '' : `   ${t.trip} `}</Text>
            <Text weight="bold">{tr === null ? '' : compactNumber(tr.total)}</Text>
          </Text>
          {d.resources !== null && (
            <Text dimColor wrap="truncate-end">
              {`${t.cpu} ${d.resources.cpu === null ? '--' : `${d.resources.cpu.toFixed(1)}%`} · ${t.memory} ${d.resources.mem === null ? '--' : `${d.resources.mem.toFixed(1)}%`} · ${t.network} ${d.resources.rx === null ? '--' : `${rate(d.resources.rx)} ↓`} · ${t.disk} ${d.resources.diskFree === null ? '--' : size(d.resources.diskFree)}`}
            </Text>
          )}
          {d.accounts.map(m => {
            const [filled, empty] = textBar(m.pct === null ? null : 100 - m.pct, barW)
            return (
              <Text mono wrap="truncate-end">
                <Text color={th.kinds[m.kind] ?? th.muted}>{`${`${KIND_SHORT[m.kind] ?? m.kind} ${m.plan}`.trim().padEnd(13)}`}</Text>
                <Text color={th.kinds[m.kind] ?? th.muted}>{filled}</Text>
                <Text dimColor>{empty}</Text>
                <Text weight="bold">{` ${m.pct === null ? ' --' : String(Math.round(m.pct)).padStart(3)}%`}</Text>
                <Text dimColor>{`  ${m.sub}${m.rate === null ? '' : ` · ${m.rate.toFixed(1)}%${t.perHour}`}`}</Text>
              </Text>
            )
          })}
          <Text dimColor>{`${t.sessionsTitle} ${d.sessionCount}`}</Text>
          {d.sessions.length === 0 && <Text dimColor>{`  ${t.noSessions}`}</Text>}
          {d.sessions.map(r => (
            <Text wrap="truncate-end">
              <Text color={r.status === 'working' ? th.lcd : r.status === 'waiting' ? th.amber : undefined}>{r.status === 'working' ? '▮ ' : r.status === 'waiting' ? '△ ' : '  '}</Text>
              <Text weight="bold">{r.title}</Text>
              <Text dimColor>{r.children > 0 ? ` ${t.children(r.children)}` : ''}</Text>
              <Text color={th.kinds[r.kind] ?? th.muted}>{`  ${KIND_NAME[r.kind] ?? r.kind}${r.account === null ? '' : ` ${r.account}`}`}</Text>
              <Text dimColor>{` · ${r.project}  `}</Text>
              <Text weight="bold">{r.share !== null ? shareText(r.share) : r.tokens > 0 ? `${compactNumber(r.tokens)} ${t.tokens}` : '—'}</Text>
            </Text>
          ))}
          <Box flexDirection="row" gap={1}>
            <Button key="compact" variant={isHot ? 'primary' : 'secondary'} onPress={compact}>
              {t.compact}
            </Button>
            <Button key="trip-reset" onPress={resetTrip}>
              {`${t.trip} ${t.reset}`}
            </Button>
          </Box>
        </Box>
      )
    }

    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    const top = view === 'cluster' ? clusterSvg(d, t, theme, period, tr, nowS) : dashboardSvg(d, t, theme, period)
    const below = sectionSvg(section, d, t, theme, period, { session, activity: a, minutes: minutesOf(ot, records), nowMs: now })
    return (
      <Box flexDirection="column" gap={1} paddingX={1} paddingY={1}>
        <Box flexDirection="row" alignItems="center" justifyContent="space-between">
          <Box flexDirection="row" alignItems="center" gap={1}>
            <Text weight="bold" size="heading" color={th.ink}>
              {t.title}
            </Text>
            <Text size="footnote" color={th.accent}>
              {`● ${live}`}
            </Text>
          </Box>
          <Box flexDirection="row" alignItems="center" gap={1}>
            <Button key="view" onPress={toggleView}>
              {t.views[nextView]}
            </Button>
            <Button key="theme" onPress={toggleTheme}>
              {theme === 'dark' ? '☀' : '☾'}
            </Button>
            <Button key="lang" onPress={toggleLang}>
              {lang === 'ko' ? 'EN' : '한'}
            </Button>
          </Box>
        </Box>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {PERIODS.map(p => (
            <Button key={`period-${p}`} variant={p === period ? 'primary' : 'secondary'} onPress={pickPeriod(p)}>
              {t.periods[p]}
            </Button>
          ))}
        </Box>
        <Svg source={top.source} alt={top.alt} />
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {SECTIONS.map(x => (
            <Button key={`section-${x}`} variant={x === section ? 'primary' : 'secondary'} onPress={pickSection(x)}>
              {t.sections[x]}
            </Button>
          ))}
        </Box>
        <Svg source={below.source} alt={below.alt} />
        <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap">
          <Button key="compact" variant={isHot ? 'primary' : 'secondary'} onPress={compact}>
            {t.compact}
          </Button>
          {view === 'cluster' && (
            <Button key="trip-reset" onPress={resetTrip}>
              {`${t.trip} ${t.reset}`}
            </Button>
          )}
          <Text size="footnote" color={th.muted}>
            {`${session?.gauges[0]?.label ?? ''} ${session?.contextPct ?? '--'}% · ${t.compactHint}`}
          </Text>
        </Box>
      </Box>
    )
  })
}
