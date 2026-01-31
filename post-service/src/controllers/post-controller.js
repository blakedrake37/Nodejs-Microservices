const logger = require('../utils/logger');
const Post = require('../models/Post');
const { validateCreatePost } = require('../utils/validation');
const { publishEvent } = require('../utils/rabbitmq');

const invalidatePostCache = async (req, input) => {
  const cacheKey = `post:${input}`;
  await req.redisClient.del(cacheKey);

  const keys = await req.redisClient.keys('posts:*');
  if (keys.length > 0) {
    await req.redisClient.del(keys);
    logger.info('Post cache invalidated');
  }
}

const createPost = async (req, res) => {
  try {
    logger.info('Create Post endpoint hit...');
    const { error } = validateCreatePost(req.body);
    if (error) {
      logger.warn('Validation error: ', error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      })
    }
    const { content, mediaIds } = req.body;
    const newlyCreatedPost = new Post({
      user: req.user.userId,
      content,
      mediaIds: mediaIds || []
    });
    await newlyCreatedPost.save();

    await publishEvent('post.created', {
      postId: newlyCreatedPost._id.toString(),
      userId: req.user.userId,
      content: newlyCreatedPost.content,
      createdAt: newlyCreatedPost.createdAt,
    });

    await invalidatePostCache(req, newlyCreatedPost._id.toString());
    logger.info(`Post created with ID: ${newlyCreatedPost._id} by User ID: ${req.user.id}`);
    logger.info(`Post: ${newlyCreatedPost}`);
    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: newlyCreatedPost
    });
  } catch (error) {
    logger.error('Error creating post:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating post'
    });
  }
}

const getAllPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const cacheKey = `posts:${page}:${limit}`;
    const cachedPosts = await req.redisClient.get(cacheKey);
    if (cachedPosts) {
      return res.json(JSON.parse(cachedPosts));
    }
    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalNumberOfPosts = await Post.countDocuments();

    const result = {
      posts,
      currentPage: page,
      totalPages: Math.ceil(totalNumberOfPosts / limit),
      totalPosts: totalNumberOfPosts
    }
    await req.redisClient.setex(cacheKey, 300, JSON.stringify(result));

    res.json(result);
  } catch (error) {
    logger.error('Error getting posts:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting posts'
    });
  }
}

const getPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const cacheKey = `post:${postId}`;
    const cachedPost = await req.redisClient.get(cacheKey);
    if (cachedPost) {
      return res.json(JSON.parse(cachedPost));
    }

    const postDetailsById = await Post.findById(postId);
    if (!postDetailsById) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }
    await req.redisClient.setex(cacheKey, 3600, JSON.stringify(postDetailsById));

    res.json(postDetailsById);
  } catch (error) {
    logger.error('Error getting post:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting post'
    });
  }
}

const deletePost = async (req, res) => {
  try {
    // const postId = req.params.id;
    // const deletedPost = await Post.findByIdAndDelete(postId);
    const deletedPost = await Post.findOneAndDelete({
      _id: req.params.id,
      user: req.user.userId
    });
    if (!deletedPost) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    await publishEvent('post.deleted', {
      postId: deletedPost._id.toString(),
      userId: req.user.userId,
      mediaIds: deletedPost.mediaIds
    });

    await invalidatePostCache(req, req.params.id);
    res.json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting post:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting post'
    });
  }
}

module.exports = {
  createPost,
  getAllPosts,
  getPost,
  deletePost
}