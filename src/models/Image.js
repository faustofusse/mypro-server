const { Schema, model } = require('mongoose');

const ImageSchema = new Schema({
    original_name: { type: String, required: false, default: null },
    description: { type: String, required: false, default: null },
    type: {type: String, required: true },
    created_at: { type: Date, default: Date.now },
    is_deleted: { type: Boolean, default: false },
    user: { type: Schema.ObjectId, ref: 'User', required: true },
    content: { type: Buffer, required: true }
});

module.exports = model('Image', ImageSchema);