const { Schema, model } = require('mongoose');

const UserSessionSchema = new Schema({
    userId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now() },
    is_deleted: { type: Boolean, default: false }
});

module.exports = model('UserSession', UserSessionSchema);