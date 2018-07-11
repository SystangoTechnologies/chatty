'use strict'

var config = require('../config')
var Mongoose = require('mongoose')

let dbUser = ((process.env.DB_USER) ? encodeURIComponent(process.env.DB_USER) + ':' : '')  || ((config.db.username) ? encodeURIComponent(config.db.username) + ':' : '')
let dbPassword = ((process.env.DB_PASS) ? encodeURIComponent(process.env.DB_PASS) + '@' : '') || ((config.db.password) ? encodeURIComponent(config.db.password) + '@' : '')
let dbHost = process.env.DB_HOST || config.db.host
let dbPort = process.env.DB_PORT || config.db.port
let dbName = process.env.DB_NAME || config.db.name

// Connect to the database
// construct the database URI and encode username and password.
var dbURI = 'mongodb://' +
			//dbUser +
			//dbPassword +
			dbHost + ':' +
			dbPort + '/' +
			dbName

console.log(dbURI);

Mongoose.connect(dbURI)

// Throw an error if the connection fails
Mongoose.connection.on('error', function (err) {
  if (err) throw err
})

// mpromise (mongoose's default promise library) is deprecated, 
// Plug-in your own promise library instead.
// Use native promises
Mongoose.Promise = global.Promise

module.exports = { Mongoose,
  models: {
    user: require('./schemas/user.js'),
    room: require('./schemas/room.js')
  }
}
