import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkManifest } from '../scripts/check-manifests.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const packagesDir = join(root, 'packages')

/** Slots that only exist in the fork; a standard plugin must not reference them. */
const FORK_ONLY_SLOTS = [
  'settings.section.icon',
  'conversation.input.add',
  'conversation.hero.actions',
  'conversation.input.permission.extra',
  'sidebar.primary.action',
  'shell.documentTitle',
]

/**
 * Packages that depend on fork-only contracts (composer owner props, conversation
 * presentation, sidebar session groups). They stay private until ported, so the
 * host never installs a plugin whose UI silently renders nothing.
 */
const BLOCKED_ON_FORK_CONTRACTS = ['composer-add-menu', 'ui-plain-chat']

const names = (await readdir(packagesDir, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)

const manifests = new Map()
for (const name of names) {
  manifests.set(name, JSON.parse(await readFile(join(packagesDir, name, 'package.json'), 'utf8')))
}

const shippable = names.filter(name => manifests.get(name).private !== true)

for (const name of shippable) {
  const manifest = manifests.get(name)

  test(`${name} satisfies the installable-plugin contract`, () => {
    assert.deepEqual(checkManifest(join(packagesDir, name)), [])
  })

  test(`${name} never targets a fork-only slot`, async () => {
    const files = ['lib/index.js', 'lib/client.js'].filter(file => manifest.files?.includes(file))
    for (const file of files) {
      const bundle = await readFile(join(packagesDir, name, file), 'utf8')
      for (const slot of FORK_ONLY_SLOTS) {
        assert.equal(bundle.includes(slot), false, `${name}/${file} references ${slot}`)
      }
    }
  })

  test(`${name} client bundles require only declared host modules`, async () => {
    if (!manifest.files?.includes('lib/client.js')) return
    const bundle = await readFile(join(packagesDir, name, 'lib/client.js'), 'utf8')
    const required = [...bundle.matchAll(/require\("(@deepseek-ai\/[^"]+)"\)/g)].map(match => match[1])
    const declared = new Set(manifest.dsh?.client?.inject ?? [])
    const undeclared = [...new Set(required)].filter(id => !declared.has(id))
    assert.deepEqual(
      undeclared,
      [],
      `${name}: lib/client.js requires host modules missing from dsh.client.inject: ${undeclared.join(', ')}`,
    )
  })
}

for (const name of BLOCKED_ON_FORK_CONTRACTS) {
  test(`${name} stays uninstallable until it is ported`, () => {
    assert.equal(manifests.get(name)?.private, true, `${name} must declare "private": true`)
  })
}

test('every shipped package is listed here exactly once', () => {
  assert.deepEqual(
    shippable.sort(),
    ['chat-preset', 'conversation-import'],
    'update this list together with the README compatibility table',
  )
})
