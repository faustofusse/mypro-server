const { Router } = require('express');
const router = Router();
const { google } = require('googleapis');
const Mail = require('../utils/mail');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_OAUTH_CLIENT_ID,
    process.env.GMAIL_OAUTH_CLIENT_SECRET,
    process.env.GMAIL_OAUTH_REDIRECT_URL,
);

// Generate a url that asks permissions for Gmail scopes
const GMAIL_SCOPES = [
    'https://mail.google.com/',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send',
];

router.post('/', async (req, res) => {
    const { mail, subject ,message } = req.body;
    const options = { to: mail, subject: subject, html: message };
    Mail.sendEmail(options).then(() => {
        res.send({ success: true, message: 'Mail Enviado' });
    }).catch(error => {
        res.send({ success: false, message: error.message });
    });
});

// Servicio para obtener las URL esto me dara el {code} para llamar al servicio getTokens
router.get('/generateAuthUrl', async (req, res) => {
 	const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: GMAIL_SCOPES,
    });
    res.send({ success: true, url: url });
});

// Servicio para obtener los token a completar en .env
router.post('/getTokens', async (req, res) => {
    const { code } = req.body;
    const { tokens } = await oauth2Client.getToken(code);
    console.info(tokens);
    res.send(tokens);
});

module.exports = router;