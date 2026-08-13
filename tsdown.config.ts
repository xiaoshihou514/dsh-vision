import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/durable-descriptions.ts', 'src/transformers-backend.ts'],
  clean: true,
  dts: true,
  fixedExtension: false,
  format: 'esm',
  outDir: 'lib',
  platform: 'node',
})
