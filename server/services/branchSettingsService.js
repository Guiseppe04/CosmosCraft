const { pool } = require('../config/database');
const Joi = require('joi');
const { addAddressSchema } = require('../utils/validation');

const DEFAULT_BRANCH = {
  id: 'balagtas-main',
  name: 'CosmosCraft Balagtas Branch',
  address: 'Sp 047-K St Peter Compound, Balagtas, 3016 Bulacan',
  hours: 'Mon-Sat 9:00 AM - 6:00 PM',
  address_details: null,
};

const branchAddressSchema = addAddressSchema.required()
  .fork(['city', 'stateProvince', 'postalZipCode'], (field) => field.trim())
  .keys({
    label: Joi.forbidden(),
    isDefault: Joi.forbidden(),
    barangay: Joi.string().trim().max(80).when('country', {
      is: 'PH', then: Joi.string().min(2).required(), otherwise: Joi.string().optional().allow(''),
    }),
  });

let settingsReady;
async function ensureBranchSettings() {
  if (!settingsReady) {
    settingsReady = pool.query(`
      CREATE TABLE IF NOT EXISTS branch_settings (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        branch_id TEXT NOT NULL,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        hours TEXT NOT NULL,
        address_details JSONB,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).then(() => pool.query(
      `INSERT INTO branch_settings (id, branch_id, name, address, hours)
       VALUES (1, $1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [DEFAULT_BRANCH.id, DEFAULT_BRANCH.name, DEFAULT_BRANCH.address, DEFAULT_BRANCH.hours],
    )).catch((error) => {
      settingsReady = null;
      throw error;
    });
  }
  return settingsReady;
}

function formatBranchAddress(details) {
  return [details.streetLine1, details.streetLine2, details.barangay, details.city,
    `${details.stateProvince} ${details.postalZipCode}`, details.country === 'PH' ? 'Philippines' : details.country]
    .filter(Boolean).join(', ');
}

async function getBranchSettings() {
  await ensureBranchSettings();
  const result = await pool.query(
    'SELECT branch_id AS id, name, address, hours, address_details FROM branch_settings WHERE id = 1',
  );
  return result.rows[0] || DEFAULT_BRANCH;
}

async function updateBranchSettings(details) {
  const { error, value } = branchAddressSchema.validate(details, { abortEarly: false });
  if (error) {
    const invalid = new Error(error.details.map((detail) => detail.message).join(' '));
    invalid.statusCode = 400;
    throw invalid;
  }
  await ensureBranchSettings();
  const result = await pool.query(
    `UPDATE branch_settings SET address = $1, address_details = $2::jsonb, updated_at = NOW()
     WHERE id = 1 RETURNING branch_id AS id, name, address, hours, address_details`,
    [formatBranchAddress(value), JSON.stringify(value)],
  );
  return result.rows[0];
}

module.exports = { DEFAULT_BRANCH, ensureBranchSettings, getBranchSettings, updateBranchSettings };
