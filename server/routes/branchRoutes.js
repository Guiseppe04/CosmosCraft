const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const branchSettings = require('../services/branchSettingsService');
const { emitBroadcast } = require('../services/socketService');

const router = express.Router();

router.get('/settings', async (req, res) => {
  try {
    const branch = await branchSettings.getBranchSettings();
    res.json({ success: true, data: branch, branches: await branchSettings.getBranchLocations(branch) });
  } catch (error) {
    console.error('Error loading branch settings:', error);
    res.status(500).json({ success: false, message: 'Failed to load branch address.' });
  }
});

router.put('/settings', authenticateToken, authorize('super_admin'), async (req, res) => {
  try {
    const branch = await branchSettings.updateBranchSettings(req.body);
    emitBroadcast('branch:updated', branch);
    res.json({ success: true, data: branch });
  } catch (error) {
    if (error.statusCode !== 400) console.error('Error saving branch settings:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 400 ? error.message : 'Failed to save branch address.',
    });
  }
});

async function saveLocation(req, res) {
  try {
    const branch = await branchSettings.saveBranchLocation(req.body, req.params.branchId);
    emitBroadcast('branch:updated', branch);
    res.status(req.params.branchId ? 200 : 201).json({ success: true, data: branch });
  } catch (error) {
    if (!error.statusCode) console.error('Error saving branch location:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Failed to save branch address.' });
  }
}
router.post('/locations', authenticateToken, authorize('super_admin'), saveLocation);
router.put('/locations/:branchId', authenticateToken, authorize('super_admin'), saveLocation);

module.exports = router;
