const express = require('express');
const multer = require('multer');

const { uploadMedia, getAllMedias } = require('../controllers/media-controller');
const { authenticateRequest } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  } // 10 MB limit
}).single('file');

router.post('/upload', authenticateRequest, async (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      logger.error('Multer error during file upload:', err);
      return res.status(400).json({
        success: false,
        message: 'File upload failed',
        error: err.message,
        stack: err.stack
      });
    } else if (err) {
      logger.error('Unknown error during file upload:', err);
      return res.status(500).json({
        success: false,
        message: 'An unknown error occurred during file upload',
        error: err.message,
        stack: err.stack
      });
    }
    if (!req.file) {
      logger.error('No file provided in the upload request');
      return res.status(400).json({
        success: false,
        message: 'No file provided for upload.'
      });
    }
    next();
  });
}, uploadMedia);

router.get('/', authenticateRequest, getAllMedias);

module.exports = router;