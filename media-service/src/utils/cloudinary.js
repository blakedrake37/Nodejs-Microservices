const cloudinary = require('cloudinary').v2;
const logger = require('./logger');

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
})

const uploadMediaToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({
      resource_type: 'auto'
    },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload error:', error);
          return reject(error);
        }
        resolve(result);
      });
    uploadStream.end(file.buffer);
  });
}

const deleteMediaFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.info(`Deleted media from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    logger.error('Error deleting media from Cloudinary:', error);
    throw error;
  }
}

module.exports = { uploadMediaToCloudinary, deleteMediaFromCloudinary };