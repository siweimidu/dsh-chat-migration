import { defineConfig } from 'tsdown'

const HOST = [/^@deepseek-ai\//, /^react($|\/)/]

/** Client halves must land as a `window.__ModuleLoader__` factory, like the host's own bundles. */
function moduleLoader(id) {
  return {
    banner: [
      'window.__ModuleLoader__.load({',
      `\tid: ${JSON.stringify(id)},`,
      '\tfactory: (require) => {',
      '\t\tvar module = { exports: {} };',
      '\t\tvar exports = module.exports;',
    ].join('\n'),
    footer: '\t\treturn module.exports;\n\t}\n});',
  }
}

const id = '@xiaozhuang-dsh/composer-add-menu'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    dts: false,
    clean: false,
    external: HOST,
  },
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    external: HOST,
    ...moduleLoader(id),
  },
])
