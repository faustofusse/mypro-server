var nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({   
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    type: 'OAuth2',
    user: process.env.GMAIL_ADDRESS,
    clientId: process.env.GMAIL_OAUTH_CLIENT_ID,
    clientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_OAUTH_REFRESH_TOKEN,
    accessToken: process.env.GMAIL_OAUTH_ACCESS_TOKEN,
    expires: Number.parseInt(process.env.GMAIL_OAUTH_TOKEN_EXPIRE, 10),
  },
});


module.exports.sendEmail = mailOptions => new Promise((resolve, reject) => {
  transporter.sendMail(mailOptions, (error) => {
    if (error) return reject(error);
    resolve();
  });
});

module.exports.sendRegisterEmail = (user, token) => {
  var mailOptions = {
    from: 'Discover.me',
    to:  user.email,
    subject: 'Discover.me email verification.',
    text:'Hi '+ user.firstName + '!' +
    '\nEnter this link to verify your discover.me user: '+
    '\n' + process.env.CLIENT_URL + '/verify/' + token +
    '\n' +
    '\nName: ' + user.firstName + ' ' + user.lastName + 
    '\nUsername: ' + user.username
  };
  return this.sendEmail(mailOptions);
};

// function sendEmailRecovery(user, res){
    // var mailOptions = {
    //     from: 'Restoar',
    //     to:  user.email,
    //     subject: 'Recupero de usuario Restoar',
    //     text:'Hola '+ user.firstName + 
    //     '\n Accede al link para recuperar tu usuario en Restoar: '+
    //     '\n http://restoar.com.ar/recovery/'+user._id+'/'+user.password +
    //     '\n' +
    //     '\n Usuario: '+ user.email 

    // };

//     // Enviamos el email
//     sendEmail(mailOptions);

// };

// function sendMailSolicitud(usuario, res){

//     // Definimos el email
//     var mailOptions = {
//         from: 'Restoar',
//         to:  usuario.mail,
//         subject: 'Confirma tu usuario en Restoar',
//         text:'Hola '+ usuario.nombre + 
//         '\n Accede al link para habilitar tu usuario en Restoar: '+
//         '\n http://server.restoar.com.ar/api/usuarios/activa/'+usuario._id +
//         '\n' +
//         '\n Usuario: '+ usuario.mail 

//     };

//     // Enviamos el email
//     sendEmail(mailOptions);

// };

// function sendMailRecupero(usuario, res){
//     // Definimos el email
//     var mailOptions = {
//         from: 'Restoar',
//         to:  usuario.mail,
//         subject: 'Tus datos de usuario en Restoar',
//         text:'Hola '+ usuario.nombre + 
//         '\n Los datos para tu acceso a Restoar son: '+
//         '\n' +
//         '\n Usuario: '+ usuario.mail +
//         '\n Clave: '+ usuario.clave

//     };
//     // Enviamos el email
//     sendEmail(mailOptions, function(error, info){
//         if (error){
//             console.log(error);
//             res.send(500, error.message);
//         } else {
//             console.log("Email sent");
//             res.status(200).jsonp(req.body);
//         }
//     });

// };