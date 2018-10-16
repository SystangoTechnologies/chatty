// 'use strict'
import * as utility from './../utility/index'
import config from "./../../config";

/**
 * Encapsulates all code for emitting and listening to socket events
 *
 */
var ioEvents = function (io) {
    // Users namespace
    require('./namespaces/user')(io)

    // Global namespace for master servers
    require('./namespaces/global')(io)

    // Receives messages published on redis for the client(recievers) connected to the current server
    io.messageListener.on('message', function (channel, message) {
        let msg = JSON.parse(message)
        let socket = io.localActiveUsersMap.get(msg.recipient + '_' + msg.application)
        if (socket) {
            if(msg.event){
                socket.emit(msg.event, msg)
            } else{
                socket.emit('addMessage', msg)
            }
        }
    })

    io.messageListener.subscribe(io.serverName)
}

/**
 * Initialize Socket.io
 * Uses Redis as Adapter for Socket.io
 *
 */
var init = function (app) {
    var server = require('http').Server(app)
    var io = require('socket.io')(server, { origins: '*:*'})
    const redis = require('redis')
    const redisAdapter = require('socket.io-redis')
    var redisUtility

    const port = config.redis.port
    const host = config.redis.host
    const password = config.redis.password

    const pub = redis.createClient(port, host, { auth_pass: password })
    const sub = redis.createClient(port, host, { auth_pass: password })
    const redisCache = redis.createClient(port, host, { auth_pass: password })
    const messageListener = redis.createClient(port, host, { auth_pass: password })
    const redisPublishChannel = redis.createClient(port, host, { auth_pass: password })

    io.serverName = config.serverName
    io.localActiveUsersMap = new Map()
    io.gamesServerMap = new Map()

    io.adapter(redisAdapter({ pubClient: pub, subClient: sub }))

    io.origins('*:*') 

    io.redisCache = redisCache
    io.messageListener = messageListener
    io.redisPublishChannel = redisPublishChannel
    io.redisUtility = require('./../utility/redis-cache')
    io.redisUtility.init(redisCache)

    // WIP
    // io.redisCache.set(serverName, '', 'EX', 10)

    // Force Socket.io to ONLY use "websockets"; No Long Polling.
    io.set('transports', ['websocket'])

    // Define all Events
    ioEvents(io)

    // The server object will be then used to list to a port number
    return server
}
 
module.exports = init


