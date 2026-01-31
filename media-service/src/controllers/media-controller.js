const logger = require('../utils/logger');
const { uploadMediaToCloudinary } = require('../utils/cloudinary');
const Media = require('../models/Media');

const uploadMedia = async (req, res) => {
  logger.info('Received media upload request');
  try {
    if (!req.file) {
      logger.error('No file provided in the request');
      return res.status(400).json({
        success: false,
        message: 'No file provided for upload.'
      });
    }
    const { originalname, mimetype, buffer } = req.file;
    const userId = req.user.userId;
    logger.info(`Uploading file: ${originalname}, type: ${mimetype}`);
    logger.info('Uploading to Cloudinary...');
    const cloudinaryUploadResult = await uploadMediaToCloudinary(req.file);
    logger.info(`Upload to Cloudinary successful. Public ID: ${cloudinaryUploadResult.public_id}`);

    const newlyUploadedMedia = new Media({
      publicId: cloudinaryUploadResult.public_id,
      originalName: originalname,
      mimeType: mimetype,
      url: cloudinaryUploadResult.secure_url,
      userId
    })
    await newlyUploadedMedia.save();
    res.status(201).json({
      success: true,
      media: newlyUploadedMedia._id,
      url: newlyUploadedMedia.url,
      message: 'Media uploaded successfully',
    });
  } catch (error) {
    logger.error('Error uploading media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload media',
    });
  }
}

const getAllMedias = async (req, res) => {
  try {
    const results = await Media.find({});
    res.json({ results });
  } catch (error) {
    logger.error('Error fetching media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch media',
    });
  }
}

module.exports = { uploadMedia, getAllMedias };