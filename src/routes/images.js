const express = require('express');
const router = express.Router();
const ImageController = require('../controllers/image');
const { errorHandler, checkImage } = ImageController;

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const auth = require('../utils/auth');

router.get('/:imageId', ImageController.streamImage);
router.delete('/:imageId', auth, ImageController.deleteImage);
router.post('/user', auth, errorHandler(upload.single('image')), checkImage, ImageController.setUserImage);
router.delete('/user', auth, ImageController.deleteImage);

module.exports = router;
