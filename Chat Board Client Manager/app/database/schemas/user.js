'use strict'

var Mongoose = require('mongoose')
// var bcrypt      = require('bcrypt-nodejs');

// const SALT_WORK_FACTOR = 10;
// const DEFAULT_USER_PICTURE = "/img/user.jpg";

/**
 * Every user has a username, password, socialId, and a picture.
 * If the user registered via username and password(i.e. LocalStrategy), 
 *      then socialId should be null.
 * If the user registered via social authenticaton, 
 *      then password should be null, and socialId should be assigned to a value.
 * 2. Hash user's password
 *
 */
var UserSchema = new Mongoose.Schema({
  username: {type: String, required: true},
  status: {type: String, default: 'online'},
  socketId: {type: String, default: null}
})

// Create a user model
var userModel = Mongoose.model('user', UserSchema)

module.exports = userModel
