const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user');

const auth = require('../utils/auth');

router.get('/', auth, UserController.getUser);
router.delete('/', auth, UserController.deleteUser);
router.post('/register', UserController.register);
router.post('/login', UserController.login);
router.get('/verified/:id', UserController.isVerified);
router.post('/verify', UserController.verifyUser);
router.get('/verifyToken', UserController.verifyToken);
router.get('/logout', auth, UserController.logout);
router.get('/sessions', auth, UserController.fetchSessions);
router.delete('/sessions', auth, UserController.deleteSessions);
router.get('/:username', UserController.getUserByUsername);

module.exports = router;
