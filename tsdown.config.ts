import { defineConfig } from 'tsdown'

/** Platform module table entries the client bundle resolves through the loader require. */
const CLIENT_EXTERNALS = ['react', 'react/jsx-runtime']
const NODE_ENTRIES = ['index', 'durable-descriptions', 'qwen-backend', 'glm-backend', 'vision-tool', 'vision-upload'] as const

export default defineConfig([
  ...NODE_ENTRIES.map(entry => ({
    name: `dsh-vision/${entry}`,
    entry: { [entry]: `src/${entry}.ts` },
    clean: false,
    dts: true,
    fixedExtension: false,
    format: 'esm',
    outDir: 'lib',
    platform: 'node',
    splitting: false,
  })),
  {
    name: 'dsh-vision/client',
    entry: { client: 'src/client/index.ts' },
    // Browser bundle lands as lib/client.js next to the node half; clean must
    // stay off so the node-half output above survives.
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    splitting: false,
    external: CLIENT_EXTERNALS,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
    // Everything not in the loader module table inlines; a require the table
    // cannot answer is a runtime throw, so the external list is the rule.
    noExternal: (id: string) => CLIENT_EXTERNALS.includes(id) ? undefined : true,
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-vision", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
