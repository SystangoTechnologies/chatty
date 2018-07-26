'use strict'

var init = function () {
  if (process.env.NODE_ENV === 'production') {
    return {
      sessionSecret: process.env.sessionSecret
    }
  } else {
    return require('./config.json')
  }
}

module.exports = init()
