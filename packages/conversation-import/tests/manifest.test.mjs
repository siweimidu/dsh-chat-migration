import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkManifest } from '../../../scripts/check-manifests.mjs'

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)))
const read = path => readFile(join(packageDir, path), 'utf8')

test('the package satisfies the installable-plugin contract', async () => {
  assert.deepEqual(checkManifest(packageDir), [])
})

test('it ships a web client half declared to the host', async () => {
  const manifest = JSON.parse(await read('package.json'))
  assert.equal(manifest.dsh?.client?.platform, 'web')
  assert.ok(manifest.dsh.client.inject.length > 0)
  for (const file of ['lib/index.js', 'lib/client.js', 'cordis.patch.yml', 'README.md']) {
    assert.ok(manifest.files.includes(file), `files must ship ${file}`)
  }
})

test('targets every currently published harness line', async () => {
  const manifest = JSON.parse(await read('package.json'))
  assert.equal(manifest.version, '0.3.0')
  assert.match(manifest.engines.dsh, />=0\.1\.7/)
})

test('the client half registers only slots the stock host renders', async () => {
  const source = await read('src/client/index.ts')
  assert.doesNotMatch(source, /settings\.section\.icon/)
  assert.match(source, /settings\.section/)
})

test('the shipped bundles contain no fork-only slot ids', async () => {
  const forbidden = [
    'settings.section.icon',
    'conversation.input.add',
    'conversation.hero.actions',
    'conversation.input.permission.extra',
    'sidebar.primary.action',
    'shell.documentTitle',
  ]
  for (const file of ['lib/index.js', 'lib/client.js']) {
    const bundle = await read(file)
    for (const slot of forbidden) {
      assert.equal(bundle.includes(slot), false, `${file} still references ${slot}`)
    }
  }
})

test('the client bundle keeps the host module-loader contract', async () => {
  const bundle = await read('lib/client.js')
  assert.match(bundle, /window\.__ModuleLoader__\.load\(/)
  assert.match(bundle, /id: "@siweimidu\/conversation-import"/)
  assert.match(bundle, /exports\.apply = apply/)
})

test('the client bundle guards fork-only primitives behind a runtime fallback', async () => {
  const bundle = await read('lib/client.js')
  // Stock DSH has no SettingsSectionHeader primitive; calling it directly would crash the settings page.
  assert.equal(bundle.includes('jsx)(_deepseek_ai_dsh_client_ui_primitives.SettingsSectionHeader,'), false)
  assert.match(bundle, /SettingsSectionHeaderFallback/)
})

test('the host half emits a replaceable cordis row', async () => {
  const patch = await read('cordis.patch.yml')
  assert.match(patch, /id: conversation-import/)
  assert.match(patch, /name: \.\/lib\/index\.js/)
})
