require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { pool } = require('../config/database');
const builderPartsService = require('../services/builderPartsService');

async function main() {
  const requestedType = String(process.argv[2] || 'all').trim().toLowerCase();
  const targets = requestedType === 'all' ? ['electric', 'bass'] : [requestedType];

  try {
    for (const guitarType of targets) {
      if (!['electric', 'bass'].includes(guitarType)) {
        throw new Error(`Unsupported guitar type "${guitarType}". Use electric, bass, or all.`);
      }

      const result = await builderPartsService.seedCustomizeParts({ guitarType });
      const stats = result?.seeded || {};
      console.log(
        `[seed-customize-parts] ${guitarType}: created=${stats.created || 0} updated=${stats.updated || 0} total=${stats.total || 0}`
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[seed-customize-parts] failed:', error?.message || error);
  process.exit(1);
});
