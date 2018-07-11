'use strict'

var User = require('../models/user')

exports.authenicateUser = async function (userName, socketId) {
  return new Promise(function (resolve, reject) {
    try {
      User.findOneAndUpdate({username: new RegExp(userName, 'i')}, {status: 'online', socketId: socketId}, {new: true}, function (err, user) {
        if (err) { reject(err) }

        if (!user) {
          User.create({ username: userName }, function (err, newUser) {
            console.log(err)
            return resolve(newUser)
          })
        } else {
          return resolve(user)
        }
      })
    } catch (err) {
      return reject(err)
    }
  })
}

// module.exports = init();
