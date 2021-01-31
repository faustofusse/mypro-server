const { Schema, model } = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new Schema({
    email: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dni: { type: Number, required: true },
    birthdate: { type: Date, required: true },
    gender: { type: String, required: true, enum: ['male', 'female', 'other'] },
    password: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    is_deleted: { type: Boolean, default: false },
    image: { type: Schema.ObjectId, ref: 'Image', default: null },
    verified_email: { type: Boolean, default: false },
    verificationToken: { type: String, default: null },
    verified_professional: { type: Boolean, default: false },
    favorites: [{ type: Schema.ObjectId, ref: 'User', default: null }],
    rating: { type: Number, required: false, default: 0 },
    gold: { type: Boolean, default: false },
    userType: { type: String, required: true, enum: ['client', 'professional']}
});

UserSchema.methods.generateHash = (password) => {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
}

module.exports = model('User', UserSchema);