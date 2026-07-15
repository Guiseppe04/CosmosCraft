// Read-only: dump the full public_id tree under the builder roots.
// Run from server/:  node scripts/_dump_assets.js
// Paste the output back so the builder image paths can be mapped correctly.
require('dotenv').config();
const cloudinary = require('cloudinary').v2;
function configureCloudinary() {
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
    return;
  }
  const url = new URL(process.env.CLOUDINARY_URL);
  cloudinary.config({ cloud_name: url.hostname, api_key: decodeURIComponent(url.username || ''), api_secret: decodeURIComponent(url.password || '') });
}
configureCloudinary();

async function listAll(prefix) {
  const out = []; let cursor = undefined;
  do {
    const r = await cloudinary.api.resources({ type: 'upload', prefix: `${prefix}/`, max_results: 500, next_cursor: cursor });
    out.push(...r.resources.map(x => x.public_id));
    cursor = r.next_cursor;
  } while (cursor);
  return out;
}

(async () => {
  for (const root of ['cosmoscraft_assets/electric_assets', 'cosmoscraft_assets/bass_assets', 'cosmoscraft_assets/admin_assets', 'cosmoscraft_assets/builder_assets']) {
    let ids = [];
    try { ids = await listAll(root); } catch (e) { console.log(`\n## ${root}\n  (empty or not found)`); continue; }
    console.log(`\n## ${root}  (${ids.length} assets)`);
    ids.sort().forEach(id => console.log('  ' + id));
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
