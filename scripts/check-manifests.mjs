#!/usr/bin/env node
/** Contract checker: guarantees every workspace package is installable as a standard DSH plugin. */

import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEP_BLOCKS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

/** Collect relative `name:` specs from a cordis patch file (module ids the host will load). */
function patchEntries(source) {
  return [...source.matchAll(/^\s*name:\s*['"]?(\.{1,2}\/[^'"\s]+)['"]?\s*$/gm)].map(match => match[1])
}

function checkPatchFile(packageDir, name, patchPath) {
  const errors = []
  const absolutePatch = resolve(packageDir, patchPath)
  if (!existsSync(absolutePatch)) {
    return [`${name}: dsh.bundle.patch points at a missing file (${patchPath})`]
  }
  for (const entry of patchEntries(readFileSync(absolutePatch, 'utf8'))) {
    const target = resolve(packageDir, entry)
    const rel = relative(packageDir, target)
    if (rel.startsWith('..') || rel.split(sep).includes('..')) {
      errors.push(`${name}: patch entry escapes package (${entry})`)
      continue
    }
    if (!existsSync(target)) {
      errors.push(`${name}: patch entry does not exist (${entry})`)
    }
  }
  return errors
}

/** @returns {string[]} contract violations; empty means the package may ship. */
export function checkManifest(packageDir) {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
  } catch (error) {
    return [`${packageDir}: unreadable package.json (${error.message})`]
  }

  const errors = []
  for (const block of DEP_BLOCKS) {
    for (const [dep, spec] of Object.entries(manifest[block] ?? {})) {
      if (typeof spec === 'string' && spec.startsWith('workspace:')) {
        errors.push(`${manifest.name}: ${block}.${dep} still uses workspace: (${spec}) — unpublishable`)
      }
    }
  }

  const patchPath = manifest.dsh?.bundle?.patch
  if (typeof patchPath !== 'string' || patchPath === '') {
    errors.push(`${manifest.name}: missing dsh.bundle.patch — the host would never load it`)
  } else {
    errors.push(...checkPatchFile(packageDir, manifest.name, patchPath))
  }

  if (manifest.dsh?.client !== undefined) {
    if (manifest.dsh.client.platform !== 'web') {
      errors.push(`${manifest.name}: dsh.client.platform must be "web"`)
    }
    if (!Array.isArray(manifest.dsh.client.inject)) {
      errors.push(`${manifest.name}: dsh.client.inject must be an array`)
    }
  }

  return errors
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)))
  const packagesDir = join(root, 'packages')
  const entries = await readdir(packagesDir, { withFileTypes: true })

  let failed = 0
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const target = join(packagesDir, entry.name)
    try {
      await stat(join(target, 'package.json'))
    } catch {
      continue
    }
    const errors = checkManifest(target)
    if (errors.length === 0) {
      console.log(`ok   ${relative(root, target)}`)
      continue
    }
    failed += 1
    console.log(`FAIL ${relative(root, target)}`)
    for (const error of errors) console.log(`     - ${error}`)
  }
  process.exit(failed === 0 ? 0 : 1)
}
