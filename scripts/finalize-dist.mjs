import { copyFile, readdir } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const output = new URL('lib/', root)
await copyFile(
  new URL('assets/client.d.ts', root),
  new URL('client.d.ts', output),
)

const expected = [
  'client.d.ts',
  'client.js',
  'glm-backend.d.ts',
  'glm-backend.js',
  'index.d.ts',
  'index.js',
  'qwen-backend.d.ts',
  'qwen-backend.js',
  'vision-preprocessor.d.ts',
  'vision-preprocessor.js',
  'vision-tool.d.ts',
  'vision-tool.js',
  'vision-upload.d.ts',
  'vision-upload.js',
]
const actual = (await readdir(output)).sort()
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`unexpected lib output: ${actual.join(', ')}`)
}
