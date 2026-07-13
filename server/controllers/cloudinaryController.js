const cloudinaryService = require('../services/cloudinaryService');

exports.browse = async (req, res, next) => {
  try {
    const { folder = '', max = 60, cursor = null } = req.query;
    const data = await cloudinaryService.browseFolder({
      folder,
      maxResults: Number(max) || 60,
      cursor: cursor || null,
    });
    res.status(200).json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
};
