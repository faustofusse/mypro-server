const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.DATABASE_URI, { useNewUrlParser: true, useFindAndModify: false, useUnifiedTopology: true })
    .then(db => console.log('Base de Datos Conectada.'))
    .catch(err => console.error(err));

module.exports = mongoose;  