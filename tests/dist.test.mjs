import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const distDir = join(root, 'dist')

/**
 * The dist/ tarballs are what raw URLs and GitHub Release assets serve. If they lag
 * behind packages/<name>/lib, every "one command install" ships the old code — so
 * compare the packed files byte for byte.
 */
const SHIPPED = ['conversation-import', 'chat-preset']

function tarballFor(name) {
  const prefix = `xiaozhuang-dsh-${name}-`
  if (!existsSync(distDir)) return undefined
  const match = readdirSync(distDir)
    .find(file => file.startsWith(prefix) && file.endsWith('.tgz'))
  return match === undefined ? undefined : join(distDir, match)
}

for (const name of SHIPPED) {
  test(`dist tarball for ${name} matches the current build`, async () => {
    const tarball = tarballFor(name)
    assert.ok(tarball, `missing dist/${name}.tgz — run pnpm pack:all`)

    const workdir = mkdtempSync(join(tmpdir(), 'dsh-dist-'))
    try {
      execFileSync('tar', ['-xzf', tarball, '-C', workdir], { stdio: 'ignore' })
      const packed = join(workdir, 'package')
      const packageDir = join(root, 'packages', name)
      const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))

      for (const entry of manifest.files) {
        if (!entry.endsWith('.js')) continue
        // Line endings are normalised: the working tree may be CRLF on Windows while
        // CI checks out LF, and that difference must not look like a stale artifact.
        const shipped = readFileSync(join(packageDir, entry), 'utf8').replace(/\r\n/g, '\n')
        const fromTarball = readFileSync(join(packed, entry), 'utf8').replace(/\r\n/g, '\n')
        assert.equal(
          fromTarball,
          shipped,
          `${name}/${entry} in dist is stale — run pnpm pack:all and commit dist/`,
        )
      }

      const packedManifest = JSON.parse(readFileSync(join(packed, 'package.json'), 'utf8'))
      assert.equal(packedManifest.name, manifest.name)
      assert.equal(packedManifest.version, manifest.version)
      assert.equal(JSON.stringify(packedManifest).includes('workspace:'), false)
    } finally {
      rmSync(workdir, { recursive: true, force: true })
    }
  })
}

test('dist contains no tarballs for unported packages', async () => {
  const files = await readdir(distDir)
  for (const blocked of ['composer-add-menu', 'ui-plain-chat']) {
    assert.equal(
      files.some(file => file.includes(blocked)),
      false,
      `${blocked} is not portable yet and must not ship a tarball`,
    )
  }
})
