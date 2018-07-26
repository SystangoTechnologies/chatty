'use strict'

let serverName = 'ChatServer_server1'

let localActiveUsersMap = new Map()

/**
 * Encapsulates all code for emitting and listening to socket events
 *
 */
var ioEvents = function (io) {
  // Users namespace
  io.of('/users').on('connection', function (socket) {
    // It will detect the Socket disconnection, change the user's status in database and remove users from active list
    socket.on('disconnect', async function () {
      if (socket.request.session.user) {
        let userName = (socket.request.session.user) ? socket.request.session.user : ''

        // Delete user from active user list
        io.redisCache.hdel('OnlineUsers', userName.toLowerCase())

        // Delete user from localActiveUsersMap
        localActiveUsersMap.delete(socket.request.session.user.toLowerCase())

        // Get all active users
        let activeUsersName = await getActiveUsersName()

        socket.emit('activeUsersList', activeUsersName)
        socket.broadcast.emit('activeUsersList', activeUsersName)
      }
    })

    // Login or SignUp user
    socket.on('login', async function (userName) {
      
      // Adding user object to socket session
      socket.request.session.user = userName

      let userData = {
        'serverName': serverName,
        'heartBeat': Date.now()
      }

      // Adding username and its last active time on redis cache
      io.redisCache.hmset('OnlineUsers', userName.toLowerCase(), JSON.stringify(userData))

      // Adding user name to activeUserMap
      localActiveUsersMap.set(userName.toLowerCase(), socket)

      socket.emit('connected')

      let activeUsersName = await getActiveUsersName()

      socket.emit('activeUsersList', activeUsersName)
      socket.broadcast.emit('activeUsersList', activeUsersName)
    })

    socket.on('sendMessage', async function (data) {
      // Set username through with the message was sent (sender)
      data.from = this.request.session.user

      // Get the server name of the client (recipient)
      io.redisCache.hget('OnlineUsers', data.to.toLowerCase(), async function (_err, obj) {
        let message = {
          event: 'addMessage',
          from: data.from,
          to: data.to,
          message: data.message
        }
        let channelName = JSON.parse(obj).serverName

        // Check if recipient is connected to the current server
        if (channelName === serverName) {
          let tempSocket = localActiveUsersMap.get(data.to.toLowerCase())
          if (tempSocket) {
            // emit message directly to client
            tempSocket.emit('addMessage', message)
          }
        } else {
          // publish message on the redis channel to specific server
          io.redisPublishChannel.publish(channelName, JSON.stringify(message))
        }
      })
    })

    socket.on('typing', function (room) {
    })

    let getActiveUsersName = function () {
      return new Promise(function (resolve, reject) {
        // Get all active users
        io.redisCache.hgetall('OnlineUsers', async function (_err, users) {
          let activeUsersName = []
          for (var element in users) {
            activeUsersName.push(element)
          } // scope of for
          // Active users
          resolve(activeUsersName)
        })
      })
    }
  })

  // Receives messages published on redis for the client(recievers) connected to the current server
  io.messageListener.on('message', function (channel, message) {
    let socket = localActiveUsersMap.get(JSON.parse(message).to)
    if (socket) {
      socket.emit('addMessage', message)
    }
  })

  io.messageListener.subscribe(serverName)
}

/**
 * Initialize Socket.io
 * Uses Redis as Adapter for Socket.io
 *
 */
var init = function (app) {
  var server = require('http').Server(app)
  var io = require('socket.io')(server)
  const redis = require('redis')
  const redisAdapter = require('socket.io-redis')

  const port = process.env.REDIS_PORT || 6379
  const host = process.env.REDIS_HOST || 'localhost'
  const password = process.env.REDIS_PASSWORD || 6379

  const pub = redis.createClient(port, host, { auth_pass: password })
  const sub = redis.createClient(port, host, { auth_pass: password })
  const redisCache = redis.createClient(port, host, { auth_pass: password })
  const messageListener = redis.createClient(port, host, { auth_pass: password })
  const redisPublishChannel = redis.createClient(port, host, { auth_pass: password })

  io.adapter(redisAdapter({ pubClient: pub, subClient: sub }))

  io.redisCache = redisCache
  io.messageListener = messageListener
  io.redisPublishChannel = redisPublishChannel

  // WIP
  io.redisCache.set(serverName, '', 'EX', 10)

  // Force Socket.io to ONLY use "websockets"; No Long Polling.
  io.set('transports', ['websocket'])

  // Allow sockets to access session data
  io.use((socket, next) => {
    require('../session')(socket.request, {}, next)
  })

  // Define all Events
  ioEvents(io)

  // The server object will be then used to list to a port number
  return server
}

module.exports = init
