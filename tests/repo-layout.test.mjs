import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

test('workspace declares packages/* and the root stays private', async () => {
  const workspace = await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8')
  assert.match(workspace, /packages:\s*\n\s*-\s*'?packages\/\*'?/)

  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  assert.equal(pkg.private, true)
  assert.equal(pkg.workspaces, undefined)
})

test('the four plugin packages live under packages/', async () => {
  const entries = await readdir(join(root, 'packages'), { withFileTypes: true })
  const names = entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
  for (const expected of ['chat-preset', 'composer-add-menu', 'conversation-import', 'ui-plain-chat']) {
    assert.ok(names.includes(expected), `missing packages/${expected}`)
  }
})

test('the fork export is archived under legacy/ and not installable', async () => {
  // Empty directories are not tracked by git, so assert on the archived files themselves.
  assert.ok(await exists(join(root, 'legacy', 'manifest.json')), 'legacy manifest missing')
  assert.ok(await exists(join(root, 'legacy', 'INSTALL.md')), 'legacy INSTALL.md missing')
  assert.ok(
    await exists(join(root, 'legacy', 'payload', 'shared', 'settings-and-ui-slots.patch')),
    'legacy core patches missing',
  )
  assert.equal(await exists(join(root, 'payload')), false, 'payload/ must be moved, not copied')
})
