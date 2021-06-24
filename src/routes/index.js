const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

router.get('/', (req, res) => {
  res.render('index', { title: 'myPro' });
});

router.get('/verify/:token', (req, res) => {
  const { token } = req.params;
  const name = jwt.decode(token).firstName;
  res.render('verify', { name: name, title: 'Verify user' })
});

router.get('/password/change/:token', (req, res) => {
  const { token } = req.params;
  const name = jwt.decode(token).firstName;
  res.render('changePassword', { name: name, title: 'Change password' })
});

module.exports = router;
