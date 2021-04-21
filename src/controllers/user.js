const bcrypt = require("bcrypt");
const validate = require("validate.js");
const User = require("../models/User");
const UserSession = require("../models/UserSession");
const jwt = require("jsonwebtoken");
const { sendRegisterEmail } = require("../utils/mail");
require('dotenv').config();

const getValuesFromObject = (object, values) => {
  let newObject = {};
  for (key in object) if (values.includes(key)) newObject[key] = object[key];
  return newObject;
}

const userValues = ['email', 'name', 'phone', 'business', 'professional', 'password', 'google', 'enrollment', 'workZone', 'workArea', 'address', 'image'];
const particularValues = userValues.concat(['lastName', 'gender', 'birthdate', 'dni', 'experience'])
const businessValues = userValues.concat(['cuit', 'employees']);

const validationConstraints = {
  name: { presence: {allowEmpty: false}, type: "string" },
  lastName: { presence: {allowEmpty: true}, type: "string" },
  email:{ presence: {allowEmpty: false}, type: "string", email: true },
  password: { presence: {allowEmpty: true}, type: "string", length: { minimum: 8 } },
  repeatPassword: { presence: {allowEmpty: true}, equality: "password" }
};

exports.register = async (req, res) => {
  let { email, password, business, dni, cuit, name, google } = req.body;
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
  console.log('NEW USER', newUser);
  if (password) newUser.password = newUser.generateHash(password);
  // Send verification email
  if (process.env.EMAIL_VERIFICATION === 'true' && google == null) {
    const verificationToken = jwt.sign({ user: newUser._id, firstName: name, expires_at: Date.now() + 24 * 3600 * 1000 }, process.env.JWT_SECRET);
    await sendRegisterEmail(newUser, verificationToken);
    newUser.verificationToken = verificationToken;
  } else { newUser.verified_email = true; }
  // Save user
  newUser.save((err, user) => {
    if (err) console.error(err);
    if (err) return res.send({success: false, message: 'Server error, user not created.'})
    res.send({success: true, message: 'User registered.'})
  });
}

exports.checkEmail = async (req, res) => {
  const { email } = req.params;
  const user = await User.findOne({ email: email, is_deleted: false });
  const exists = user != null && user != undefined;
  res.send({ success: true, message: `Email ${exists ? 'already exists.' : 'is free.'}`, exists: exists});
}

exports.googleLogin = async (req, res) => {
  let { id } = req.body;
  const user = await User.findOne({ google: id, is_deleted: false });
  if (!user) return res.send({success: false, message: 'User not registered with google.'});
  const userSession = new UserSession();
  userSession.userId = user._id;
  userSession.save((err, doc) => {
      if (err) return res.send({success: false, message: 'Server error.'});
      const token = jwt.sign({userId: user._id, sessionId: doc._id}, process.env.JWT_SECRET);
      return res.send({success: user, message: 'Valid login.', token: token, user: user });
  });
}

exports.login = async (req, res) => {
  let { email, password } = req.body;
  if (!email || !password) return res.send({success: false, message: 'Complete all the fields.'});
  email = email.toLowerCase();
  const user = await User.findOne({ email, is_deleted: false }).catch(err => res.send({success: false, message: 'Error: database error.'}));
  if (!user) return res.send({success: false, message: 'Error: Invalid email.', errors: { email: ['Email not found.'] }});
  if (user.is_deleted) return res.send({success: false, message: 'User deleted.'});
  if (!user.verified_email) return res.send({success: false, message: 'User not verified.', errors: { email: ['Email not verified.']} });
  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) return res.send({success: false, message: 'Error: Invalid password.', errors: { password: ['Invalid Password.'] }});
  const userSession = new UserSession();
  userSession.userId = user._id;
  userSession.save((err, doc) => {
      if (err) return res.send({success: false, message: 'Server error.'});
      const token = jwt.sign({userId: user._id, sessionId: doc._id}, process.env.JWT_SECRET);
      return res.send({success: user, message: 'Valid login.', token: token, user: user });
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
  User.findOne({_id: userId, is_deleted: false}, (err, user) => {
    if (err) return res.send({success: false, message: 'Server error.'});
    if (!user) return res.send({success: false, message: 'User not found.'});
    res.send({success: user, user: user});
  });
}

exports.getUserByUsername = async (req, res) => {
  const { username } = req.params;
  User.findOne({ username, is_deleted: false }, (err, user) => {
    if (err) return res.send({success: false, message: 'Server error.'});
    if (!user) return res.send({success: false, message: 'User not found.'});
    res.send({ success: true, message: 'User found.', user: user });
  });
}

exports.fetchUsers = async (req, res) => {
  await User.find()
    .then(result => res.json(result))
    .catch(err => res.json(err));
};