// The cockpit (prototype): a pane beside the chat with dials for context and the
// usage limits, the session's flow, a forecast at the pace so far and the tools
// running now. `/cockpit` opens it; the option `cockpit: auto` opens it at the
// start of every session too. The desktop app draws it as SVG, the terminal as
// text bars and sparklines. While it is drawn the band above the prompt steps
// aside: the cockpit shows the same figures and more.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Activity, Sample, StatusJson } from '../types'
import { buildView, C, countdown, hudSvg, PACE_COLOR, PACE_WORD, shortTool, sparkline, textBar, topTools } from './gauges'

const status = atom({ plugin: 'awesome-statusline-mod', key: 'status' } as const, null as StatusJson | null)
const history = atom({ plugin: 'awesome-statusline-mod', key: 'history' } as const, [] as Sample[])
const activity = atom(
  { plugin: 'awesome-statusline-mod', key: 'activity' } as const,
  { running: [], counts: {}, calls: 0 } as Activity,
)
const cockpitShown = atom({ plugin: 'awesome-statusline-mod', key: 'cockpitShown' } as const, false)

export const PANE = 'cockpit'
const OPEN = { id: PANE, title: 'Cockpit', backgroundColor: C.crust } as const
const MAX_SAMPLES = 240
const SAMPLE_EVERY_MS = 60_000

/** Hands the cockpit the figures the band just rendered from. */
export async function publishStatus($: EngineInterface, s: StatusJson, nowMs: number) {
  await update($, status, () => s)
  await recordSample($, s, nowMs)
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

/** Registers /cockpit, and opens the pane where the option says so; from session.start. */
export async function startCockpit($: EngineInterface, mode: 'command' | 'auto') {
  await $.command.register({
    name: 'cockpit',
    description: 'Open the Awesome Statusline cockpit: dials, session flow, forecast and live tools',
  })
  // A reload finds the pane as it was left.
  await syncCockpit($)
  if (mode === 'auto') void $.ui.open(OPEN).then(() => syncCockpit($))
}

export function registerCockpit(on: On) {
  on('command.run', { command: 'cockpit' }, async $ => {
    const opened = await $.ui.open(OPEN)
    await syncCockpit($)
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
    const [s, samples, a, now] = await Promise.all([read($, status), read($, history), read($, activity), $.clock.now()])
    const compact = () => {
      void $.session.compact()
    }

    if (e.surface === 'terminal') {
      const { Box, Text, Button } = $.ui.resolve(e)
      if (s === null) return <Text dimColor>Cockpit: waiting for the session's first figures…</Text>
      const v = buildView(s, now)
      const barW = Math.max(6, Math.min(24, e.props.bodyColumns - 48))
      const sparkW = Math.max(8, e.props.bodyColumns - 12)
      return (
        <Box flexDirection="column">
          <Text>
            <Text color={C.peach} weight="bold">⚡ COCKPIT </Text>
            <Text color={C.teal}>{[v.model, v.effort, v.isThinking ? 'thinking' : null].filter(Boolean).join(' · ')}</Text>
            <Text dimColor>{`  session ${v.duration}`}</Text>
          </Text>
          {v.alert !== null && <Text color={C.red}>{`▲ ${v.alert}`}</Text>}
          {v.gauges.map(g => {
            const [filled, empty] = textBar(g.pct, barW)
            return (
              <Text mono wrap="truncate-end">
                <Text color={g.color}>{g.label.padEnd(8)}</Text>
                <Text color={g.color}>{filled}</Text>
                <Text color={C.s1}>{empty}</Text>
                <Text weight="bold">{` ${g.pct === null ? ' --' : String(Math.round(g.pct)).padStart(3)}%`}</Text>
                <Text dimColor>{`  ${g.short}`}</Text>
                {g.pace !== null && <Text color={PACE_COLOR[g.pace]}>{`  ${PACE_WORD[g.pace].toLowerCase()}`}</Text>}
              </Text>
            )
          })}
          <Text mono wrap="truncate-end">
            <Text dimColor>{'flow    '}</Text>
            {samples.filter(p => p.ctx !== null).length < 2 ? (
              <Text dimColor>collecting… fills in as the session runs</Text>
            ) : (
              <Text color={C.pink}>{sparkline(samples.map(p => p.ctx), sparkW)}</Text>
            )}
          </Text>
          {v.forecast.map(f => (
            <Text wrap="truncate-end">
              <Text color={f.color}>{f.label.padEnd(8)}</Text>
              <Text>{f.text}</Text>
            </Text>
          ))}
          <Text wrap="truncate-end">
            <Text dimColor>{'live    '}</Text>
            <Text color={C.teal}>
              {a.running.length === 0 ? 'idle' : a.running.map(r => `${r.tool} ${countdown((now - r.since) / 1000)}`).join(' · ')}
            </Text>
            <Text dimColor>{`   ${topTools(a, 5).map(([n, c]) => `${n} ${c}`).join(' · ')}`}</Text>
          </Text>
          <Button key="compact" variant={(v.contextPct ?? 0) >= 75 ? 'primary' : 'secondary'} onPress={compact}>
            Compact now
          </Button>
        </Box>
      )
    }

    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    if (s === null) return <Text dimColor>Cockpit: waiting for the session's first figures…</Text>
    const v = buildView(s, now)
    const hud = hudSvg(v, samples, a, now)
    return (
      <Box flexDirection="column" gap={1}>
        <Svg source={hud.source} alt={hud.alt} />
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Button key="compact" variant={(v.contextPct ?? 0) >= 75 ? 'primary' : 'secondary'} onPress={compact}>
            Compact now
          </Button>
          <Text dimColor size="footnote">
            {`Context ${v.contextPct ?? '--'}%. Compacting summarizes the conversation to free context.`}
          </Text>
        </Box>
      </Box>
    )
  })
}
