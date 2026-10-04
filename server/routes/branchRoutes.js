const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const branchSettings = require('../services/branchSettingsService');
const { emitBroadcast } = require('../services/socketService');

const router = express.Router();

router.get('/settings', async (req, res) => {
  try {
    res.json({ success: true, data: await branchSettings.getBranchSettings() });
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

module.exports = router;
