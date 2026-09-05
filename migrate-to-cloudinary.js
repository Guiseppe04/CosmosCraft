#!/usr/bin/env node
/**
 * migrate-to-cloudinary.js
 *
 * Bulk-uploads a local asset folder to Cloudinary, preserving the folder
 * structure and using clean (non-suffixed) public IDs. Fixes the issue where
 * assets uploaded through the Cloudinary web UI got a random suffix appended
 * to their filename (e.g. "bodymask_itso6h" instead of "bodymask"), which
 * breaks any app code that predicts asset URLs from a known folder/file
 * naming convention.
 *
 * USAGE:
 *   1. npm install cloudinary
 *   2. Set env vars (or pass as CLI flags, see below):
 *        CLOUDINARY_CLOUD_NAME=dfrgh3ww7
 *        CLOUDINARY_API_KEY=xxxxxxxx
 *        CLOUDINARY_API_SECRET=xxxxxxxx
 *   3. Run:
 *        node migrate-to-cloudinary.js \
 *          --local ./public/builder/electric_assets/builder \
 *          --remote cosmoscraft_assets/electric_assets/builder
 *
 *      This walks every file under --local and uploads it to Cloudinary
 *      under --remote, mirroring the local sub-path exactly (with clean
 *      filenames, no extension in the public_id since Cloudinary infers it,
 *      and no random suffix).
 *
 *   Optional flags:
 *     --dry-run           Print what would be uploaded without uploading
 *     --overwrite=false   Skip files that already exist at the target
 *                          public_id (default: true, i.e. overwrite/replace)
 *     --concurrency=5     Number of parallel uploads (default: 5)
 *     --only=dc,delos     Comma-separated list of top-level subfolders to
 *                          restrict the migration to (default: all)
 *     --report=out.json   Write a JSON report of successes/failures
 *
 * SAFETY NOTES:
 *   - This script only touches files under --local; it does not delete
 *     anything on Cloudinary. Suffixed duplicates (e.g. bodymask_itso6h)
 *     will remain unless you clean them up separately.
 *   - Run with --dry-run first to sanity-check the mapping before uploading
 *     for real.
 */

const fs = require('fs')
const path = require('path')
const { cloudinary } = (() => {
  try {
    return { cloudinary: require('cloudinary').v2 }
  } catch (e) {
    console.error('Missing dependency. Run: npm install cloudinary')
    process.exit(1)
  }
})()

// ---------- CLI arg parsing ----------
function parseArgs(argv) {
  const args = { dryRun: false, overwrite: true, concurrency: 5, only: null, report: null }
  for (const raw of argv.slice(2)) {
    const [flag, ...rest] = raw.replace(/^--/, '').split('=')
    const value = rest.join('=')
    switch (flag) {
      case 'local':
        args.local = value
        break
      case 'remote':
        args.remote = value
        break
      case 'dry-run':
        args.dryRun = true
        break
      case 'overwrite':
        args.overwrite = value !== 'false'
        break
      case 'concurrency':
        args.concurrency = parseInt(value, 10) || 5
        break
      case 'only':
        args.only = value.split(',').map(s => s.trim()).filter(Boolean)
        break
      case 'report':
        args.report = value
        break
      default:
        console.warn(`Unknown flag: --${flag}`)
    }
  }
  return args
}

const args = parseArgs(process.argv)

if (!args.local || !args.remote) {
  console.error('Usage: node migrate-to-cloudinary.js --local <dir> --remote <cloudinary-folder> [--dry-run] [--only=dc,delos]')
  process.exit(1)
}

const LOCAL_ROOT = path.resolve(args.local)
const REMOTE_ROOT = args.remote.replace(/\/+$/, '')

if (!fs.existsSync(LOCAL_ROOT)) {
  console.error(`Local root does not exist: ${LOCAL_ROOT}`)
  process.exit(1)
}

// ---------- Cloudinary config ----------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

if (!args.dryRun) {
  const missing = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
    .filter(k => !process.env[k])
  if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(', ')}`)
    process.exit(1)
  }
}

// Image-ish extensions we care about for this asset library
const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'])

// ---------- Walk local directory ----------
function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, base, out)
    } else {
      const ext = path.extname(entry.name).toLowerCase()
      if (ALLOWED_EXT.has(ext)) {
        out.push(fullPath)
      }
    }
  }
  return out
}

let files = walk(LOCAL_ROOT)

if (args.only) {
  files = files.filter(f => {
    const rel = path.relative(LOCAL_ROOT, f)
    const topFolder = rel.split(path.sep)[0]
    return args.only.includes(topFolder)
  })
}

console.log(`Found ${files.length} file(s) under ${LOCAL_ROOT}${args.only ? ` (filtered to: ${args.only.join(', ')})` : ''}`)

// ---------- Build upload jobs ----------
function toUploadJob(localFile) {
  const relPath = path.relative(LOCAL_ROOT, localFile) // e.g. dc/bodies/front/masks/bodymask.png
  const relDir = path.dirname(relPath).split(path.sep).join('/') // dc/bodies/front/masks
  const baseName = path.basename(relPath, path.extname(relPath)) // bodymask

  const folder = relDir === '.' ? REMOTE_ROOT : `${REMOTE_ROOT}/${relDir}`
  const publicId = `${folder}/${baseName}`

  return { localFile, relPath, folder, publicId, baseName }
}

const jobs = files.map(toUploadJob)

// ---------- Upload with limited concurrency ----------
async function uploadOne(job) {
  if (args.dryRun) {
    console.log(`[dry-run] ${job.relPath}  ->  ${job.publicId}`)
    return { ok: true, job }
  }
  try {
    const result = await cloudinary.uploader.upload(job.localFile, {
      // Dynamic Folder Mode: `folder` carries the full path and controls both
      // the delivery URL AND the Media Library folder. `public_id` should be
      // filename-only here -- passing the full slash-path in public_id too
      // would double it up (folder/folder/file).
      public_id: job.baseName,
      folder: job.folder,
      use_filename: true,
      unique_filename: false,
      overwrite: args.overwrite,
      resource_type: 'image',
      invalidate: true, // bust CDN cache for overwritten assets
    })
    console.log(`OK    ${job.relPath}  ->  ${result.public_id}.${result.format}`)
    return { ok: true, job, result }
  } catch (err) {
    console.error(`FAIL  ${job.relPath}  ->  ${job.publicId}  (${err.message || err})`)
    return { ok: false, job, error: err.message || String(err) }
  }
}

async function runPool(items, concurrency, worker) {
  const results = []
  let i = 0
  async function next() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await worker(items[idx])
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, next)
  await Promise.all(workers)
  return results
}

async function main() {
  const start = Date.now()
  const results = await runPool(jobs, args.concurrency, uploadOne)
  const succeeded = results.filter(r => r.ok)
  const failed = results.filter(r => !r.ok)

  console.log('\n----------------------------------------')
  console.log(`${args.dryRun ? '[DRY RUN] ' : ''}Done in ${((Date.now() - start) / 1000).toFixed(1)}s`)
  console.log(`  Succeeded: ${succeeded.length}`)
  console.log(`  Failed:    ${failed.length}`)

  if (failed.length) {
    console.log('\nFailed files:')
    for (const f of failed) {
      console.log(`  - ${f.job.relPath}: ${f.error}`)
    }
  }

  if (args.report) {
    const reportPath = path.resolve(args.report)
    fs.writeFileSync(reportPath, JSON.stringify({
      dryRun: args.dryRun,
      localRoot: LOCAL_ROOT,
      remoteRoot: REMOTE_ROOT,
      total: jobs.length,
      succeeded: succeeded.length,
      failed: failed.map(f => ({ file: f.job.relPath, publicId: f.job.publicId, error: f.error })),
    }, null, 2))
    console.log(`\nReport written to ${reportPath}`)
  }

  process.exit(failed.length ? 1 : 0)
}

main()