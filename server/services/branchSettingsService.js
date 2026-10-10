const { pool } = require('../config/database');
const Joi = require('joi');
const { randomUUID } = require('node:crypto');
const { branchAddressBaseSchema } = require('../utils/validation');
const { validateShippingAddress } = require('../utils/phAddress');

const DEFAULT_BRANCH = {
  id: 'balagtas-main',
  name: 'CosmosCraft Balagtas Branch',
  address: 'Sp 047-K St Peter Compound, Balagtas, 3016 Bulacan',
  hours: 'Mon-Sat 9:00 AM - 6:00 PM',
  address_details: null,
};

const branchAddressSchema = branchAddressBaseSchema.required()
  .fork(['city', 'stateProvince', 'postalZipCode'], (field) => field.trim())
  .keys({
    stateProvince: Joi.string().trim().min(2).max(50).optional().allow(null, ''),
    label: Joi.forbidden(),
    isDefault: Joi.forbidden(),
    barangay: Joi.string().trim().max(80).when('country', {
      is: 'PH', then: Joi.string().min(2).required(), otherwise: Joi.string().optional().allow(''),
    }),
  }).custom((value, helpers) => value.stateProvince ? value : validateShippingAddress(value, helpers));
const branchLocationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  hours: Joi.string().trim().min(2).max(200).required(),
  address_details: branchAddressSchema,
}).required();

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
    )).then(() => pool.query(`CREATE TABLE IF NOT EXISTS branch_locations (
      branch_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      hours TEXT NOT NULL,
      address_details JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)).catch((error) => {
      settingsReady = null;
      throw error;
    });
  }
  return settingsReady;
}

function formatBranchAddress(details) {
  return [details.streetLine1, details.streetLine2, details.barangay, details.city,
    [details.stateProvince, details.postalZipCode].filter(Boolean).join(' '), details.country === 'PH' ? 'Philippines' : details.country]
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

async function getBranchLocations(primary) {
  const mainBranch = primary || await getBranchSettings();
  const result = await pool.query('SELECT branch_id AS id, name, address, hours, address_details FROM branch_locations ORDER BY created_at, branch_id');
  return [mainBranch, ...result.rows];
}

async function saveBranchLocation(details, branchId) {
  const { error, value } = branchLocationSchema.validate(details, { abortEarly: false });
  if (error) {
    const invalid = new Error(error.details.map(detail => detail.message).join(' '));
    invalid.statusCode = 400;
    throw invalid;
  }
  await ensureBranchSettings();
  const params = [value.name, formatBranchAddress(value.address_details), value.hours, JSON.stringify(value.address_details), branchId || randomUUID()];
  const result = await pool.query(branchId
    ? `UPDATE branch_locations SET name=$1, address=$2, hours=$3, address_details=$4::jsonb, updated_at=NOW() WHERE branch_id=$5 RETURNING branch_id AS id, name, address, hours, address_details`
    : `INSERT INTO branch_locations (name,address,hours,address_details,branch_id) VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING branch_id AS id, name, address, hours, address_details`, params);
  if (!result.rows[0]) {
    const missing = new Error('Branch not found.');
    missing.statusCode = 404;
    throw missing;
  }
  return result.rows[0];
}

module.exports = { DEFAULT_BRANCH, ensureBranchSettings, getBranchSettings, updateBranchSettings, getBranchLocations, saveBranchLocation };
