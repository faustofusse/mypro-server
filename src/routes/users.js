const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user');

const auth = require('../utils/auth');

router.get('/', auth, UserController.getUser);
router.delete('/', auth, UserController.deleteUser);
router.put('/merge', UserController.merge);
router.post('/register', UserController.register);
router.post('/login', UserController.login);
router.get('/verified/:id', UserController.isVerified);
router.post('/verify', UserController.verifyUser);
router.post('/forgot', UserController.forgotPassword);
router.post('/password/change', UserController.changePassword);
router.get('/verifyToken', UserController.verifyToken);
router.get('/logout', auth, UserController.logout);
router.get('/email/check/:email', UserController.checkEmail);
router.get('/sessions', auth, UserController.getSessions);
router.delete('/sessions', auth, UserController.deleteSessions);

module.exports = router;
