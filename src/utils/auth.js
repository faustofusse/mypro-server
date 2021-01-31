const jwt = require('jsonwebtoken');
require('dotenv').config();

const auth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.send({success:false, message:'Not authorized. Token missing.'});
    try {
        // Falta ver si el usuario fue eliminado / verificado (puede ser en otro middleware)
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        if (!verified) return res.send({success:false, message:'Not authorized. Invalid token.'});
        res.locals.userId = verified.userId;
        res.locals.sessionId = verified.sessionId;
        next();
    } catch(e) {return res.send({success: false, message: e.message});}
}

module.exports = auth;