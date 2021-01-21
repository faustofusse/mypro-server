const streamifier = require("streamifier");
const User = require("../models/User");
const Image = require("../models/Image");

const mimetypes = ['image/jpeg', 'image/png'];
const maxSize = 10 * 1000 * 1000; // 10 MB

exports.setUserImage = async (req, res) => {
    const { mimetype, buffer, originalname } = req.file;
    const { userId } = res.locals;
    const newImage = new Image({ content: buffer, type: mimetype, user: userId, original_name: originalname });
    try {
        const uploadedImage = await newImage.save();
        let user = await User.findOne({ _id: userId, is_deleted: false });
        if (user.image) await Image.findByIdAndUpdate(user.image, {$set: {is_deleted: true}});
        user.image = uploadedImage._id;
        user.save().then((doc) => res.send({ success: doc, message: 'User image updated.' }));
    } catch(err) { res.send({ success: false, message: err.message }); }
}

exports.deleteImage = async (req, res) => {
    const { imageId } = req.params;
    const { userId } = res.locals;
    const query = imageId ? { image: imageId, is_deleted: false } : { _id: userId, is_deleted: false };
    try {
        let user = await User.findOne(query);
        if (imageId && user._id != userId) return res.send({ success: false, message: 'You can\'t delete someone else\'s image.'});
        await Image.findByIdAndUpdate(imageId ? imageId : user.image, {$set: {is_deleted: true}});
        if (imageId && !user) return res.send({ success: true, message: 'Image deleted.' });
        if (!user) return res.send({ success: false, message: 'User not found.' });
        user.image = null;
        user.save().then((doc) => res.send({ success: true, message: 'Image deleted.' }));
    } catch(err) { res.send({ success: false, message: err.message }); }
}

exports.streamImage = async (req, res) => {
    const { imageId } = req.params;
    Image.findOne({ _id: imageId, is_deleted: false }, (err, doc) => {
        if (err) return res.send({ success: false, message: err.message });
        if (!doc) return res.send({ success: false, message: 'Image not found!' });
        const stream = streamifier.createReadStream(doc.content);
        stream.pipe(res);
    });
}

exports.checkImage = async (req, res, next) => {
    if (!req.file) return res.send({ success: false, message: 'No images found.' });
    const { mimetype, size } = req.file;
    if (!mimetypes.includes(mimetype)) return res.send({ success: false, message: 'Invalid image type (only png and jpeg accepted).' });
    if (size > maxSize) return res.send({ success: false, message: `Image too big (max: ${maxSize / 1000000}MB).` });
    next();
}

exports.errorHandler = multerUpload => ((req, res, next) => {
    multerUpload(req, res, (err) => {
        if (err) return res.send({ success: false, message: err.message });
        next();
    });
})