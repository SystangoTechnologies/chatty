'use strict'

// Chat application dependencies
var express = require('express')
var app = express()
var ioServer = require('./app/socket')(app)

// Set the port number
var port = process.env.PORT || 6001
ioServer.listen(port)
