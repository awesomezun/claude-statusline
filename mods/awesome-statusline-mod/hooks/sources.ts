// Where the cockpit's figures come from: the 1top app's local API when it runs
// on this computer, else this computer's own commands and the records the
// sessions running this mod write. Each takes `$` and touches no `$.state`:
// cockpit.tsx keeps what they return.

import type { EngineInterface } from 'claude-code'

import type { FleetRecord, OneTopState, Resources } from '../types'
import { cpuFromPs, cpuTicks, diskFromDf, LIVE_S, memFromMeminfo, memFromPressure, netBytes, trimOneTop } from './dash'

// 1top's read-only dashboard API: localhost only, no token needed to read.
const ONETOP_STATE = 'http://127.0.0.1:18766/api/state?period=1h'

async function run($: EngineInterface, argv: string[], timeoutMs = 3_000): Promise<string | null> {
  try {
    const r = await $.process.run(argv, { timeoutMs })
    return r.exitCode === 0 ? r.stdout : null
  } catch {
    return null
  }
}

async function firstOf($: EngineInterface, paths: string[]): Promise<string | null> {
  for (const p of paths) if (await $.fs.exists(p)) return p
  return null
}

/**
 * The 1top app's state, trimmed (its action token dropped at once), or null
 * where it doesn't run. AWESOME_STATUSLINE_ONETOP=off leaves 1top alone, as on
 * a computer without it.
 */
export async function fetchOneTop($: EngineInterface): Promise<OneTopState | null> {
  if ((await $.env.get('AWESOME_STATUSLINE_ONETOP')) === 'off') return null
  const curl = await firstOf($, ['/usr/bin/curl', '/bin/curl'])
  if (curl === null) return null
  const out = await run($, [curl, '-s', '--max-time', '2', '-H', 'Accept: application/json', ONETOP_STATE], 4_000)
  if (out === null || !out.trimStart().startsWith('{')) return null
  try {
    const raw = JSON.parse(out) as Record<string, unknown>
    delete raw.action_token
    return trimOneTop(raw)
  } catch {
    return null
  }
}

export type NetMark = { rx: number; tx: number; atMs: number; cpu?: [number, number] }

/** CPU, memory, network and free disk; `prev` turns byte and tick counters into rates. */
export async function sampleResources(
  $: EngineInterface,
  prev: NetMark | null,
  nowMs: number,
): Promise<{ resources: Resources; mark: NetMark | null }> {
  const isMac = await $.fs.exists('/usr/bin/memory_pressure')
  let cpu: number | null = null
  let mem: number | null = null
  let counters: { rx: number; tx: number } | null = null
  let ticks: [number, number] | null = null
  if (isMac) {
    const [ps, cores, pressure, net] = await Promise.all([
      run($, ['/bin/ps', '-A', '-o', '%cpu=']),
      run($, ['/usr/sbin/sysctl', '-n', 'hw.logicalcpu']),
      run($, ['/usr/bin/memory_pressure']),
      run($, ['/usr/sbin/netstat', '-ibn']),
    ])
    cpu = ps === null || cores === null ? null : cpuFromPs(ps, Number(cores.trim()))
    mem = pressure === null ? null : memFromPressure(pressure)
    counters = net === null ? null : netBytes(net)
  } else {
    const [stat, meminfo, dev] = await Promise.all([
      $.fs.read('/proc/stat').catch(() => null),
      $.fs.read('/proc/meminfo').catch(() => null),
      $.fs.read('/proc/net/dev').catch(() => null),
    ])
    ticks = typeof stat === 'string' ? cpuTicks(stat) : null
    if (ticks !== null && prev?.cpu !== undefined) {
      const busy = ticks[0] - prev.cpu[0]
      const total = ticks[1] - prev.cpu[1]
      cpu = total > 0 ? Math.round((busy * 1000) / total) / 10 : null
    }
    mem = typeof meminfo === 'string' ? memFromMeminfo(meminfo) : null
    counters = typeof dev === 'string' ? netBytes(dev) : null
  }
  const df = await run($, ['/bin/df', '-k', '/'])
  const dt = prev === null ? 0 : (nowMs - prev.atMs) / 1000
  const resources: Resources = {
    cpu,
    mem,
    rx: counters !== null && prev !== null && dt > 0 ? Math.max(0, (counters.rx - prev.rx) / dt) : null,
    tx: counters !== null && prev !== null && dt > 0 ? Math.max(0, (counters.tx - prev.tx) / dt) : null,
    diskFree: df === null ? null : diskFromDf(df),
  }
  const mark: NetMark | null = counters === null ? null : { ...counters, atMs: nowMs, ...(ticks === null ? {} : { cpu: ticks }) }
  return { resources, mark }
}

/** Where the sessions running this mod keep their records. */
export async function fleetDir($: EngineInterface): Promise<string> {
  const home = (await $.env.get('HOME')) ?? ''
  const configDir = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${home}/.claude`
  return `${configDir}/awesome-statusline-cockpit/sessions`
}

export async function writeFleet($: EngineInterface, record: FleetRecord): Promise<void> {
  try {
    await $.fs.write(`${await fleetDir($)}/${record.id.replace(/[^\w.-]/g, '_')}.json`, JSON.stringify(record))
  } catch {
    // the others' cockpits miss one update
  }
}

/** Every record written in the last day; the others are left for `pruneFleet`. */
export async function readFleet($: EngineInterface, nowMs: number): Promise<FleetRecord[]> {
  const dir = await fleetDir($)
  try {
    const entries = await $.fs.list(dir)
    const fresh = entries.filter(e => e.kind === 'file' && e.name.endsWith('.json') && nowMs - e.mtimeMs < 86_400_000)
    const records = await Promise.all(
      fresh.map(async e => {
        try {
          const r = JSON.parse(String(await $.fs.read(`${dir}/${e.name}`))) as FleetRecord
          return r.v === 1 && Array.isArray(r.bins) ? r : null
        } catch {
          return null
        }
      }),
    )
    return records.filter((r): r is FleetRecord => r !== null)
  } catch {
    return []
  }
}

/** Removes records older than two days, once per session. */
export async function pruneFleet($: EngineInterface): Promise<void> {
  const find = await firstOf($, ['/usr/bin/find', '/bin/find'])
  if (find === null) return
  await run($, [find, await fleetDir($), '-maxdepth', '1', '-name', '*.json', '-mtime', '+2', '-delete'])
}

/** The app the session runs in, as 1top names it: Claude (the desktop app), Orca, iTerm2, Terminal… */
export async function appName($: EngineInterface): Promise<string> {
  const [entry, orca, term] = await Promise.all([
    $.env.get('CLAUDE_CODE_ENTRYPOINT'),
    $.env.get('ORCA_APP_VERSION'),
    $.env.get('TERM_PROGRAM'),
  ])
  if (/desktop/i.test(entry ?? '')) return 'Claude'
  if (orca) return 'Orca'
  const names: Record<string, string> = { 'iTerm.app': 'iTerm2', Apple_Terminal: 'Terminal', ghostty: 'Ghostty', vscode: 'VS Code', WezTerm: 'WezTerm', tmux: 'tmux' }
  return names[term ?? ''] ?? 'Terminal'
}

export { LIVE_S }
