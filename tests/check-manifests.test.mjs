import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { checkManifest } from '../scripts/check-manifests.mjs'

async function fixture({ pkg = {}, patch, entryFile = 'lib/index.js', extra = {} } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-manifest-'))
  const manifest = {
    name: '@xiaozhuang-dsh/fixture',
    version: '0.3.0',
    type: 'module',
    main: 'lib/index.js',
    ...pkg,
  }
  await writeFile(join(dir, 'package.json'), JSON.stringify(manifest, null, 2))
  if (patch !== null) {
    const body = patch ?? '- insert:\n    - id: fixture\n      name: ./lib/index.js\n'
    await writeFile(join(dir, 'cordis.patch.yml'), body)
  }
  if (entryFile !== null) {
    await mkdir(join(dir, entryFile, '..'), { recursive: true })
    await writeFile(join(dir, entryFile), 'export function apply() {}\n')
  }
  for (const [path, body] of Object.entries(extra)) {
    await mkdir(join(dir, path, '..'), { recursive: true })
    await writeFile(join(dir, path), body)
  }
  return dir
}

test('a standard package with a resolvable patch passes', async () => {
  const dir = await fixture({
    pkg: {
      dsh: { bundle: { patch: './cordis.patch.yml' } },
      peerDependencies: { '@deepseek-ai/cordis': '^0.2.1-rc.2' },
    },
  })
  assert.deepEqual(checkManifest(dir), [])
})

test('workspace protocol in any dependency block is rejected', async () => {
  const dir = await fixture({
    pkg: {
      dsh: { bundle: { patch: './cordis.patch.yml' } },
      dependencies: { '@deepseek-ai/cordis': 'workspace:^' },
    },
  })
  const errors = checkManifest(dir)
  assert.equal(errors.length, 1)
  assert.match(errors[0], /workspace:/)
})

test('a package without dsh.bundle.patch is rejected', async () => {
  const dir = await fixture()
  const errors = checkManifest(dir)
  assert.ok(errors.some(error => /missing dsh\.bundle\.patch/.test(error)), errors.join('; '))
})

test('a patch entry escaping the package is rejected', async () => {
  const dir = await fixture({
    pkg: { dsh: { bundle: { patch: './cordis.patch.yml' } } },
    patch: '- insert:\n    - id: escape\n      name: ../../../etc/evil.js\n',
  })
  const errors = checkManifest(dir)
  assert.ok(errors.some(error => /escapes package/.test(error)), errors.join('; '))
})

test('a patch entry pointing at a missing file is rejected', async () => {
  const dir = await fixture({
    pkg: { dsh: { bundle: { patch: './cordis.patch.yml' } } },
    patch: '- insert:\n    - id: missing\n      name: ./lib/nope.js\n',
  })
  const errors = checkManifest(dir)
  assert.ok(errors.some(error => /does not exist/.test(error)), errors.join('; '))
})

test('client packages must declare a web platform and their inject list', async () => {
  const dir = await fixture({
    pkg: {
      dsh: { bundle: { patch: './cordis.patch.yml' }, client: { inject: [], platform: 'web' } },
    },
    entryFile: 'lib/index.js',
    extra: { 'lib/client.js': 'window.__ModuleLoader__.load({})\n' },
  })
  assert.deepEqual(checkManifest(dir), [])
})
