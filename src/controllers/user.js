const bcrypt = require("bcrypt");
const validate = require("validate.js");
const User = require("../models/User");
const UserSession = require("../models/UserSession");
const jwt = require("jsonwebtoken");
const { sendRegisterEmail } = require("../utils/mail");
require('dotenv').config();

const validationConstraints = {
  username: { 
    presence: {allowEmpty: false}, type: "string", length: { minimum: 5 }, 
    format: { pattern: "[a-z0-9]+", flags: "i", message: "can only contain a-z and 0-9" } 
  },
  firstName: { presence: {allowEmpty: false}, type: "string" },
  lastName: { presence: {allowEmpty: false}, type: "string" },
  email:{ presence: {allowEmpty: false}, type: "string", email: true },
  password: { presence: {allowEmpty: false}, type: "string", length: { minimum: 8 } },
  repeatPassword: { presence: {allowEmpty: false}, equality: "password" }
};

exports.register = async (req, res) => {
  let { username, email, password, firstName, lastName } = req.body;
  email = email ? email.toLowerCase() : null;
  let errors = validate(req.body, validationConstraints);
  if (!errors) errors = {};
  let users = await User.find({ email, is_deleted: false });
  if (users.length > 0) errors.email = [].concat(['Email is already registered.'], errors.email ? errors.email : []);
  users = await User.find({ username, is_deleted: false });
  if (users.length > 0) errors.username = [].concat(['Username is already registered.'], errors.username ? errors.username : []);
  if (Object.keys(errors).length > 0) return res.send({success:false, message: 'Invalid fields', errors: errors});
  const newUser = new User({email, username, firstName, lastName});
  newUser.password = newUser.generateHash(password);
  if (process.env.EMAIL_VERIFICATION) {
    const verificationToken = jwt.sign({ user: newUser._id, firstName, expires_at: Date.now() + 24 * 3600 * 1000 }, process.env.JWT_SECRET);
    await sendRegisterEmail(newUser, verificationToken);
    newUser.verificationToken = verificationToken;
  } else { newUser.verified_email = true; }
  newUser.save((err, user) => {
    if (err) return res.send({success: false, message: 'Server error, user not created.'})
    res.send({success: true, message: 'User registered.'})
  });
}

exports.login = async (req, res) => {
  let { email, password } = req.body;
  if (!email || !password) return res.send({success: false, message: 'Complete all the fields.'});
  email = email.toLowerCase();
  User.find({ email, is_deleted: false }, (err, users) => {
    if (err) return res.send({success: false, message: 'Error: database error.'});
    if (users.length != 1) return res.send({success: false, message: 'Error: Invalid email.', errors: { email: ['Email not found.'] }});
    let user = users[0];
    if (user.is_deleted) return res.send({success: false, message: 'User deleted.'});
    if (!user.verified_email) return res.send({success: false, message: 'User not verified.', errors: { email: ['Email not verified.']} });
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) return res.send({success: false, message: 'Error: Invalid password.', errors: { password: ['Invalid Password.'] }});
    const userSession = new UserSession();
    userSession.userId = user._id;
    userSession.save((err, doc) => {
        if (err) return res.send({success: false, message: 'Server error.'});
        const token = jwt.sign({userId: user._id, sessionId: doc._id}, process.env.JWT_SECRET);
        const { email, username, firstName, lastName, image} = user;
        user = { email, username, firstName, lastName, image };
        return res.send({success: user, message: 'Valid login.', token: token, user: user });
    });
  });
}

exports.isVerified = async(req, res) => {
  const { id } = req.params;
  const user = await User.find({ _id: id, is_deleted: false });
  if (!user) return res.send({success: false, message: 'User not found.'});
  res.send({success:true, verified: user.verified_email, message: `User is ${user.verified ? '' : 'not '}verified`});
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

exports.fetchSessions = async (req, res) => {
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
  User.findOne({_id: userId, is_deleted: false}, (err, doc) => {
    if (err) return res.send({success: false, message: 'Server error.'});
    if (!doc) return res.send({success: false, message: 'User not found.'});
    const { email, firstName, lastName, username, image } = doc;
    const user = { email, firstName, lastName, username, image };
    res.send({success: user, user: user});
  });
}

exports.getUserByUsername = async (req, res) => {
  const { username } = req.params;
  User.findOne({ username, is_deleted: false }, (err, user) => {
    if (err) return res.send({success: false, message: 'Server error.'});
    if (!user) return res.send({success: false, message: 'User not found.'});
    const { email, firstName, lastName, username, image } = user;
    const u = { email, firstName, lastName, username, image };
    res.send({ success: true, message: 'User found.', user: u });
  });
}

exports.fetchUsers = async (req, res) => {
  await User.find()
    .then(result => res.json(result))
    .catch(err => res.json(err));
};