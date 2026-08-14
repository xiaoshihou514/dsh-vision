import type { VisionSettings } from './VisionSettingsCard.tsx'

type Snapshot =
  | { status: 'loading'; value?: undefined; writable: false }
  | { status: 'ready'; value: VisionSettings; writable: true }
  | { status: 'unavailable'; value?: undefined; writable: false }

const ENDPOINT = '/dsh-vision/settings'
const HEADERS = { 'content-type': 'application/json', 'x-dsh-vision': 'dsh-vision' }

/** Small same-origin settings client; avoids pretending vision is an LLM provider. */
export class VisionSettingsScope {
  private snapshot: Snapshot = { status: 'loading', writable: false }
  private readonly listeners = new Set<() => void>()

  constructor() { void this.refresh() }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getSnapshot = (): Snapshot => this.snapshot

  async set(name: string, value: unknown): Promise<void> {
    await this.write({ op: 'set', path: [name], value })
  }

  async unset(name: string): Promise<void> {
    await this.write({ op: 'unset', path: [name] })
  }

  private async write(op: { op: 'set' | 'unset'; path: string[]; value?: unknown }): Promise<void> {
    const response = await fetch(ENDPOINT, { method: 'PATCH', headers: HEADERS, body: JSON.stringify({ ops: [op] }) })
    const body = await response.json() as { ok?: boolean; value?: VisionSettings; error?: string }
    if (!response.ok || body.ok !== true || body.value === undefined) throw new Error(body.error ?? '设置保存失败')
    this.publish({ status: 'ready', value: body.value, writable: true })
  }

  private async refresh(): Promise<void> {
    try {
      const response = await fetch(ENDPOINT, { headers: HEADERS })
      const body = await response.json() as { ok?: boolean; value?: VisionSettings }
      if (!response.ok || body.ok !== true || body.value === undefined) throw new Error('unavailable')
      this.publish({ status: 'ready', value: body.value, writable: true })
    } catch {
      this.publish({ status: 'unavailable', writable: false })
    }
  }

  private publish(snapshot: Snapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }
}
