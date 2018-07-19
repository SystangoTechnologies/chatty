'use strict'

let middleware = require('../middleware')

var Room = require('../models/room')

var User = require('../models/user')

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
        let userId = (socket.request.session.user) ? socket.request.session.user.id : ''

        // Change user status
        let user = await User.findOneAndUpdate({$or: [ {'_id': userId}, {'socketId': socket.id} ]}, {status: 'offline', socketId: ''}, {new: false}) //, function (err, _user) {

        // Delete user from active user list
        io.redisCache.hdel(socket.nsp.name, user.username.toLowerCase())

        // Get all active users
        let activeUsersName = await getActiveUsersName()

        socket.emit('activeUsersList', activeUsersName)
        io.emit('activeUsersList', activeUsersName)
      }
    })

    socket.on('login', async function (userName) {
      // Login or SignUp user
      let user = await middleware.authenicateUser(userName, socket.id)

      // Adding user object to socket session
      socket.request.session.user = user

      // Adding username and its socket.id for active user list
      io.redisCache.hmset(socket.nsp.name, user.username.toLowerCase(), socket.id)

      socket.emit('connected')

      let activeUsersName = await getActiveUsersName()

      socket.emit('activeUsersList', activeUsersName)
      io.emit('activeUsersList', activeUsersName)
    })

    // WIP
    // socket.on('initChat', async function (usersArray) {
    //   let tempArray = usersArray
    //   tempArray.push(socket.request.session.user.username)

    //   let response = {
    //     roomName: tempArray.sort().join('_')
    //   }

    //   // Iterate the users list and send join request to the socket associted with the user array
    //   usersArray.forEach(function (element) {
    //     activeUsers.get(element).emit('roomConnection', response)
    //   })
    // })

    /* One to one chat with chat room provided by the server
    data = {
      peername: 'XYZ'
    } */
    socket.on('initOneToOneChat', async function (data) {
      let currentUser = socket.request.session.user.username
      // creating room by concating usernames in lexicographically order
      let roomname = (currentUser > data.peername) ? (data.peername + '_' + currentUser) : (currentUser + '_' + data.peername)

      io.redisCache.hget(socket.nsp.name, data.peername.toLowerCase(), function (_err, socketId) {
        socket.emit('roomConnection', roomname)
        socket.broadcast.to(socketId).emit('roomConnection', roomname)
      })
    })

    /* One to one chat with chat room provided by the server
    data = {
      roomname: 'XYZ'
    } */
    socket.on('enterRoom', async function (title) {
      // First find the room
      Room.findOne({
        'title': new RegExp('^' + title + '$', 'i')
      }, function (err, room) {
        if (err) throw err
        if (room) {
          // Adding user to the room
          Room.addUser(room, socket, function (_err, newRoom) {
            socket.join(newRoom.id)
            socket.request.roomId = newRoom.id
            socket.emit('roomReady')
          })
          socket.request.room = title
        } else {
          // Creating the new room
          Room.create({
            title: title
          }, function (err, newRoom) {
            if (err) throw err
            socket.request.room = title
            // Adding user to the room
            Room.addUser(newRoom, socket, function (_err, newRoom) {
              socket.request.roomId = newRoom.id
              socket.join(newRoom.id)
              socket.emit('roomReady')
            })
          })
        }
      })
    })

    // When a new message arrives
    socket.on('newMessage', function (message) {
      // No need to emit 'addMessage' to the current socket
      socket.broadcast.to(socket.request.roomId).emit('addMessage', message)
    })

    socket.on('typing', function (room) {
    })

    let activeUsers = function () {
      return new Promise(function (resolve, reject) {
        io.of(socket.nsp.name).adapter.clients((_err, clients) => {
          resolve(clients) // an array containing all connected socket ids
        })
      })
    }

    let getActiveUsersName = function () {
      return new Promise(function (resolve, reject) {
        // Get all active users
        io.redisCache.hgetall(socket.nsp.name, async function (_err, obj) {
          let activeUsersSockets = await activeUsers()
          // Emit active user list
          let activeUsersName = []
          for (var property1 in obj) {
            if (activeUsersSockets.indexOf(obj[property1]) >= 0) {
              activeUsersName.push(property1)
            } // scope of if
          } // scope of for
          resolve(activeUsersName)
        })
      })
    }
  })

  // WIP
  // io.of('/chat').on('connection', function (socket) {
  //   // When a socket exits
  //   socket.on('disconnect', function () {
  //     // Check if user exists in the session
  //     if (socket.request.session.user == null) {
  //       return
  //     }

  //     // Find the room to which the socket is connected to,
  //     // and remove the current user + socket from this room
  //     // let userId = socket.request.session.user.id
  //     Room.removeUser(socket, function (err, room, _userId, _cuntUserInRoom) {
  //       if (err) throw err

  //       // Leave the room channel
  //       socket.leave(room.id)

  //       // Return the user id ONLY if the user was connected to the current room using one socket
  //       // The user id will be then used to remove the user from users list on chatroom page
  //       // if (cuntUserInRoom === 1) {
  //       // socket.broadcast.to(room.id).emit('removeUser', userId);
  //       // }
  //     })
  //   })
  // })
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

  io.adapter(redisAdapter({ pubClient: pub, subClient: sub }))

  io.redisCache = redisCache

  // Force Socket.io to ONLY use "websockets"; No Long Polling.
  io.set('transports', ['websocket'])

  // io.adapter(redis({ host: '192.168.1.40', port: 6379 }))

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
