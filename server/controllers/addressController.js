const {
  validateZipCode,
  validateZipCodeGeneral,
  getCityByCode,
  getCitiesByZipCode,
  getValidZipCodes,
  getDatasetInfo,
} = require('../utils/phZipValidator.js');

/**
 * GET /api/address/validate-zip
 * Validates a Philippine zip code against a selected city (PSGC code).
 * Public endpoint — used during signup address entry.
 *
 * Query params:
 *   cityCode  – 10-digit PSGC city/municipality code (from the ph-address dropdown)
 *   zipCode   – user-entered postal/zip code
 *
 * Response:
 *   { valid: boolean, message: string, city?: {...}, zips?: string[] }
 */
const validateZipForCity = (req, res, next) => {
  try {
    const { cityCode, zipCode } = req.query;

    if (!cityCode && !zipCode) {
      const info = getDatasetInfo();
      return res.json({ status: 'success', data: info });
    }

    if (cityCode && zipCode) {
      const result = validateZipCode(String(cityCode), String(zipCode));
      return res.json({
        status: 'success',
        data: {
          valid: result.valid,
          message: result.message,
          city: result.city,
          zips: result.zips,
        },
      });
    }

    if (cityCode) {
      const city = getCityByCode(String(cityCode));
      if (!city) {
        return res.status(404).json({
          status: 'error',
          message: 'Selected city is not recognized.',
        });
      }
      return res.json({
        status: 'success',
        data: {
          city: {
            code: city.code,
            city: city.city,
            province: city.province,
            provinceCode: city.provinceCode,
          },
          zips: city.zips,
          hasZipData: city.zips.length > 0,
        },
      });
    }

    if (zipCode) {
      const result = validateZipCodeGeneral(String(zipCode));
      const lookup = getCitiesByZipCode(String(zipCode));
      return res.json({
        status: 'success',
        data: {
          valid: result.valid,
          exists: result.exists,
          message: result.message,
          cities: lookup.cities || [],
        },
      });
    }
  } catch (err) {
    next(err);
  }
};

module.exports = {
  validateZipForCity,
};
