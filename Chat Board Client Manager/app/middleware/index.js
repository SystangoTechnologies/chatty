'use strict'

var User = require('../models/user')

exports.authenicateUser = async function (userName, socketId) {
  try {
    let user = await User.findOneAndUpdate({username: new RegExp(userName, 'i')}, {status: 'online', socketId: socketId}, {new: true})

    if (!user) {
      User.create({ username: userName }, function (err, newUser) {
        console.log(err)
        return newUser
      })
    } else {
      return user
    }
  } catch (err) {
    return err
  }
}

// module.exports = init();
