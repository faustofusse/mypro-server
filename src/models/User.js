const { Schema, model } = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new Schema({
    // basic
    email: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    business: { type: Boolean, required: true },
    professional: { type: Boolean, required: true },
    password: { type: String, required: false },
    google: { type: String, default: null },
    // particular
    lastName: { type: String, required: false },
    gender: { type: String, required: false, enum: ['male', 'female', 'other'] },
    birthdate: { type: Date, required: false },
    cuit: { type: String, required: false },
    // profesional
    enrollment: { type: String, required: false },
    workZone: { type: String, required: false },
    workArea: { type: String, required: false },
    address: { type: String, required: false },
    dni: { type: Number, required: false },
    experience: { type: Number, required: false },
    employees: { type: Number, required: false },
    // other
    image: { type: Schema.ObjectId, ref: 'Image', default: null },
    favorites: [{ type: Schema.ObjectId, ref: 'User' }],
    rating: { type: Number, required: false, default: 0 },
    // verification
    verified_email: { type: Boolean, default: false },
    verificationToken: { type: String, default: null },
    verified_professional: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
    is_deleted: { type: Boolean, default: false },
});

UserSchema.methods.generateHash = (password) => {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
}

module.exports = model('User', UserSchema);