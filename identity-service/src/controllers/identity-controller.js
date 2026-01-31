

const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
// const { validate } = require('../models/User');
const generateToken = require('../utils/generateToken');
const logger = require('../utils/logger');
const { validateRegistration, validateLogin } = require('../utils/validation');

const registerUser = async (req, res) => {
  logger.info('Registering endpoint hit...');
  try {
    const { error } = validateRegistration(req.body);
    if (error) {
      logger.warn('Validation error: ', error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      })
    }
    const { username, email, password, firstName, lastName } = req.body;

    let user = await User.findOne({ $or: [{ username }, { email }] });

    if (user) {
      if (user.username === username) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with given username'
        });
      }
      if (user.email === email) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with given email'
        });
      }
    }

    user = new User({ username, email, password, firstName, lastName });
    await user.save();

    logger.info('User registered successfully: ', user._id);

    const { accessToken, refreshToken } = await generateToken(user);
    res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      accessToken,
      refreshToken
    });


  } catch (error) {
    logger.error('Error in registering user: ', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
}

const loginUser = async (req, res) => {
  logger.info('Login endpoint hit...');
  try {
    const { error } = validateLogin(req.body);
    if (error) {
      logger.warn('Validation error: ', error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      })
    }
    const { identifier, password } = req.body;
    const query = identifier.includes('@') ? { email: identifier } : { username: identifier };

    const user = await User.findOne(query);

    if (!user) {
      logger.warn('Invalid username or email: ', identifier);
      return res.status(400).json({
        success: false,
        message: 'Invalid username or email'
      });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      logger.warn('Invalid password');
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      });
    }

    logger.info('User logged in successfully: ', user._id);

    const { accessToken, refreshToken } = await generateToken(user);
    res.status(200).json({
      success: true,
      message: 'User logged in successfully!',
      accessToken,
      refreshToken,
      userId: user._id
    });
  } catch (error) {
    logger.error('Error in logging in user: ', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
}

const refreshTokenUser = async (req, res) => {
  logger.info('Refresh token endpoint hit...');
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      logger.warn('Refresh token missing');
      return res.status(400).json({
        success: false,
        message: 'Refresh token missing'
      });
    }

    const storedToken = await RefreshToken.findOne({ token: refreshToken });

    if (!storedToken || storedToken.expiryDate < new Date()) {
      logger.warn('Invalid refresh token');
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const user = await User.findById(storedToken.user);

    if (!user) {
      logger.warn('User not found for the given refresh token');
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await generateToken(user);

    await RefreshToken.deleteOne({ _id: storedToken._id });

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    logger.error('Error in refreshing token: ', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
};

const logoutUser = async (req, res) => {
  logger.info('Logout endpoint hit...');
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      logger.warn('Refresh token missing');
      return res.status(400).json({
        success: false,
        message: 'Refresh token missing'
      });
    }
    await RefreshToken.deleteOne({ token: refreshToken });
    logger.info('Token deleted for logout');
    res.status(200).json({
      success: true,
      message: 'User logged out successfully'
    });
  } catch (error) {
    logger.error('Error in logging out user: ', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
};

module.exports = { registerUser, loginUser, refreshTokenUser, logoutUser };