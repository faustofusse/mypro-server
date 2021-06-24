const bcrypt = require("bcrypt");
const validate = require("validate.js");
const User = require("../models/User");
const Image = require('../models/Image');
const UserSession = require("../models/UserSession");
const jwt = require("jsonwebtoken");
const request = require('request').defaults({ encoding: null });
const imageType = require('image-type');
const { sendRegisterEmail, sendEmailRecovery } = require("../utils/mail");
require('dotenv').config();

const emailExpression = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

const createImageFromUrl = (url, userId) => new Promise((resolve, reject) => request.get(url, (err, res, buffer) => {
    if (err) reject(err);
    const newImage = new Image({content: buffer, type: imageType(buffer).mime, user: userId});
    newImage.save((e, image) => {
        if(e) reject(e);
        resolve(image);
    });
}));

const getValuesFromObject = (object, values) => {
    let newObject = {};
    for (key in object) if (values.includes(key)) newObject[key] = object[key];
    return newObject;
}

const userValues = ['email', 'name', 'phone', 'business', 'professional', 'password', 'google', 'facebook', 'enrollment', 'workZone', 'workArea', 'address', 'image'];
const particularValues = userValues.concat(['lastName', 'dni', 'birthdate', 'dni', 'experience'])
const businessValues = userValues.concat(['cuit', 'employees']);

    // COMPLETAR ESTO!!!!!!
const validationConstraints = {
    name: { presence: true, type: "string" },
    lastName: { type: "string" },
    email:{ presence: true, type: "string", email: true },
    password: { type: "string", length: { minimum: 8 } },
    repeatPassword: { equality: "password" }
};

exports.register = async (req, res) => {
    let { email, password, business, dni, cuit, name, google, image, facebook } = req.body;
    email = email ? email.toLowerCase() : null;
    // Find errors
    let errors = validate(req.body, validationConstraints);
    if (!errors) errors = {};
    // Check email
    let users = await User.find({ email, is_deleted: false });
    if (users.length > 0) errors.email = [].concat(['Email is already registered.'], errors.email ? errors.email : []);
    // Check dni or cuit
    if (business != null && business == false && !errors.dni){
        users = await User.find({ dni, is_deleted: false });
        if (users.length > 0) errors.dni = ['DNI is already registered'];
    } else if (business != null && business == true && !errors.cuit){
        users = await User.find({ cuit, is_deleted: false });
        if (users.length > 0) errors.cuit = ['This CUIT is already registered'];
    }
    // Send errors
    if (Object.keys(errors).length > 0) return res.send({success:false, message: 'Invalid fields', errors: errors});
    // Create user and encrypt password
    const values = business ? businessValues : particularValues;
    const newUser = new User(getValuesFromObject(req.body, values));
    if (password) newUser.password = newUser.generateHash(password);
    // Save image
    if (image) {
        const newImage = await createImageFromUrl(image, newUser._id).catch(err => console.error(err));
        newUser.image = newImage._id;
    }
    // Send verification email
    if (process.env.EMAIL_VERIFICATION === 'true' && !google && !facebook) {
        const verificationToken = jwt.sign({ user: newUser._id, firstName: name, expires_at: Date.now() + 24 * 3600 * 1000 }, process.env.JWT_SECRET);
        await sendRegisterEmail(newUser, verificationToken);
        newUser.verificationToken = verificationToken;
    } else { newUser.verified_email = true; }
    // Save user
    newUser.save((err, user) => {
        if (err) console.error(err);
        if (err) return res.send({success: false, message: 'Server error, user not created.'})
        console.log('NEW USER', newUser);
        res.send({success: true, message: 'User registered.'})
    });
}

exports.login = async (req, res) => {
    let { email, password, google, facebook } = req.body;
    // Check if email and password were entered
    if ((email && !password) || (!email && password)) return res.send({success: false, message: 'Complete all the fields.'});
    if (email) email = email.toLowerCase();
    // Get user
    const query = google ? { google, is_deleted: false } : ( facebook ?  { facebook, is_deleted: false } : { email, is_deleted: false });
    const user = await User.findOne(query).catch(err => res.send({success: false, message: 'Error: database error.'}));
    if (!user) return res.send({success: false, message: 'Error: User not found.', errors: { email: ['Email not found.'] }});
    if (!google && !facebook && !user.password) return res.send({ success: false, message: 'User registered with facebook or google'});
    // Email login
    if (!google && !facebook && email) {
        if (!user.verified_email) return res.send({success: false, message: 'User not verified.', errors: { email: ['Email not verified.']} });
        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) return res.send({success: false, message: 'Error: Invalid password.', errors: { password: ['Invalid Password.'] }});
    }
    // Save session
    const userSession = new UserSession();
    userSession.userId = user._id;
    userSession.save((err, doc) => {
        if (err) return res.send({success: false, message: 'Server error.'});
        const token = jwt.sign({userId: user._id, sessionId: doc._id}, process.env.JWT_SECRET);
        return res.send({success: user, message: 'Valid login.', token: token, user: user });
    });
}

exports.checkEmail = async (req, res) => {
    const { email } = req.params;
    const user = await User.findOne({ email: email, is_deleted: false });
    const exists = user != null && user != undefined;
    res.send({ success: true, message: `Email ${exists ? 'already exists.' : 'is free.'}`, exists: exists, google: (user && user.google), facebook: (user && user.facebook)});
}

exports.isVerified = async(req, res) => {
    const { id } = req.params;
    const user = await User.find({ _id: id, is_deleted: false });
    if (!user) return res.send({success: false, message: 'User not found.'});
    res.send({success:true, verified: user.verified_email, message: `User is ${user.verified ? '' : 'not '}verified`});
}

exports.merge = async (req, res) => {
    // merge accounts
}

exports.verifyUser = async (req, res) => {
    const { token, password, repeatPassword } = req.body;
    if (!token || !password || !repeatPassword) return res.send({success:false, message: 'Fields missing.'});
    if (password !== repeatPassword) return res.send({success:false, message: 'Not verified. Passwords do not match', errors: { repeatPassword: 'Passwords do not match'}});
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (!verified) return res.send({success:false, message: 'Not authorized. Invalid token.'});
    if (verified.expires_at - Date.now() < 0) return res.send({success: false, message: 'Email expired.'});
    const user = await User.findOne({_id: verified.user, is_deleted: false});
    if (!user) return res.send({success: false, message: 'User not found.'});
    if (user.verified) return res.send({success: false, message: 'User already verified.'});
    if (token !== user.verificationToken) return res.send({success:false, message: 'Different verification token.'});
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) return res.send({success: false, message: 'Error: Invalid password.', errors: { password: ['Invalid Password.'] }});
    User.findOneAndUpdate({_id: verified.user, is_deleted: false}, {$set: {verified_email: true, verificationToken: null}}, {new: true}, (err, doc) => {
        if (err) return res.send({success: false, message: 'Server error, user not deleted.'});
        if (!doc) return res.send({success: false, message: 'User not found.'});
        res.send({success: true, message: 'User verified.'});
    });
}

exports.logout = async (req, res) => {
    const { sessionId } = res.locals;
    UserSession.findByIdAndUpdate(sessionId, {$set:{is_deleted: true}}, {new: true}, (err, doc) => {
        if (err) return res.send({success: false, message: 'Error: invalid'});
        return res.send({success: true, message:'Logged out.'});
    });
} 

exports.deleteUser = async (req, res) => {
    const { userId } = res.locals;
    User.findByIdAndUpdate(userId, {$set: {is_deleted: true}}, {new: true}, (err, doc) => {
        if (err) return res.send({success: false, message: 'Server error, user not deleted.'});
        if (!doc) return res.send({success: false, message: 'User not found.'});
        res.send({success: true, message: 'User deleted.'})
    });
};

exports.deleteSessions = async (req, res) => {
    const { userId } = res.locals;
    UserSession.updateMany({userId: userId, is_deleted: false}, {$set:{is_deleted: true}}, (err, docs) => {
        if (err) return res.send({success: false, message: 'Server error, sessions not deleted.'});
        res.send({success: true, message: 'All sessions deleted.'});
    });
}

exports.getSessions = async (req, res) => {
    const { userId } = res.locals;
    await UserSession.find({userId: userId})
        .then(result => res.json(result))
        .catch(err => res.json(err));
};

exports.verifyToken = async (req, res) => {
    const token = req.header('x-auth-token');
    if (!token) return res.send({success:false, message:'Token missing.'});
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        if (!verified) return res.send({success:false, message:'Invalid token.'});
    } catch(e) {return res.send({success: false, message: e.message});}
    UserSession.find({_id: verified.sessionId}, (err, sessions) => {
        if (err) return res.send({success:false, message:err.message});
        if (!sessions || sessions.length != 1) return res.send({success: false, message: 'Session not found.'});
        if (sessions[0].is_deleted) return res.send({success: false, message: 'Session expired.'});
        User.findById(verified.userId, (err, docs) => {
        if (err) return res.send({success:false, message:err.message});
        if (!docs || docs.length !== 1) return res.send({success:false, message: 'User not found.'});
        if (docs[0].is_deleted) return res.send({success:false, message: 'User deleted.'});
        res.send({success: true, message: null});
        });
    });
} 

exports.getUser = async (req, res) => {
    const { userId } = res.locals;
    User.findOne({_id: userId, is_deleted: false}, (err, user) => {
        if (err) return res.send({success: false, message: 'Server error.'});
        if (!user) return res.send({success: false, message: 'User not found.'});
        res.send({success: user, user: user});
    });
}

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email || !emailExpression.exec(email)) return res.send({ success: false, message: 'Invalid Email.'});
    // Find user and validate
    const user = await User.findOne({email: email, is_deleted: false});
    if (!user) return res.send({success: false, message: 'User not found.'});
    if (!user.verified_email) return res.send({ success: false, message: 'User not verified.' });
    // Send email
    const verificationToken = jwt.sign({ user: user._id, firstName: user.name, expires_at: Date.now() + 24 * 3600 * 1000 }, process.env.JWT_SECRET);
    await sendEmailRecovery(user, verificationToken);
    user.verificationToken = verificationToken;
    // Save user
    user.save(err => err ? 
        res.send({ success: false, message: 'Error saving user.' }) : 
        res.send({ success: true, message: 'Email sent.' })
    );
}

exports.changePassword = async (req, res) => {
    const { token, password, repeatPassword } = req.body;
    if (!token || !password || !repeatPassword) return res.send({ success:false, message: 'Fields missing.' });
    if (password !== repeatPassword) return res.send({ success:false, message: 'Password was not changed. Passwords do not match', errors: { repeatPassword: 'Passwords do not match'}});
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (!verified) return res.send({ success:false, message: 'Not authorized. Invalid token.' });
    if (verified.expires_at - Date.now() < 0) return res.send({ success: false, message: 'Email expired.' });
    const user = await User.findOne({_id: verified.user, is_deleted: false});
    if (!user) return res.send({success: false, message: 'User not found.'});
    if (token !== user.verificationToken) return res.send({ success:false, message: 'Different verification token.' });
    const newPassword = user.generateHash(password);
    User.findOneAndUpdate({_id: verified.user, is_deleted: false}, {$set: {verificationToken: null, password: newPassword }}, {new: true}, (err, doc) => {
        if (err) return res.send({success: false, message: 'Server error.'});
        if (!doc) return res.send({success: false, message: 'User not found.'});
        res.send({success: true, message: 'Password changed.'});
    });
}