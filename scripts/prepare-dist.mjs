import { mkdir, readdir, rm } from 'node:fs/promises'

const output = new URL('../lib/', import.meta.url)
await mkdir(output, { recursive: true })
for (const entry of await readdir(output, { withFileTypes: true })) {
  await rm(new URL(entry.name, output), { recursive: entry.isDirectory(), force: true })
}
