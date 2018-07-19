'use strict'

var userModel = require('../database').models.user

var create = function (data, callback) {
  var newUser = new userModel(data)
  newUser.save(callback)
}

var findOne = function (data, callback) {
  userModel.findOne(data, callback)
}

var findById = function (id, callback) {
  userModel.findById(id, callback)
}

/**
 * Find a user, and create one if doesn't exist already.
 * This method is used ONLY to find user accounts registered via Social Authentication.
 *
 */
var findOrCreate = function (data, callback) {
  findOne({'socialId': data.id}, function (err, user) {
    if (err) { return callback(err) }
    if (user) {
      return callback(err, user)
    } else {
      var userData = {
        username: data.displayName,
        status: 'offline',
        socketId: ''
      }
      create(userData, function (err, newUser) {
        callback(err, newUser)
      })
    }
  })
}

var findOneAndUpdate = async function (searchParam, updateParam, _data) {
  let user = await userModel.findOneAndUpdate(searchParam, updateParam, { new: true })
  return user
}

/**
 * A middleware allows user to get access to pages ONLY if the user is already logged in.
 *
 */
var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated()) {
    next()
  } else {
    res.redirect('/')
  }
}

module.exports = {
  create,
  findOne,
  findById,
  findOrCreate,
  findOneAndUpdate,
  isAuthenticated
}
