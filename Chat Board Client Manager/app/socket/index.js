'use strict'

let middleware = require('../middleware')

var Room = require('../models/room')

var User = require('../models/user')

var activeUsers = new Map()

var chatServers = new Map()

const defaultServer = process.env.DEFAULT_CHATSERVER || 'http://localhost:3000/chat'

/**
 * Encapsulates all code for emitting and listening to socket events
 *
 */
var ioEvents = function (io) {
  // Users namespace
  io.of('/users').on('connection', function (socket) {
    // It will detect the Socket disconnection, change the user's status in database and remove users from active list
    socket.on('disconnect', function () {
      if (socket.request.session.user) {
        let userId = (socket.request.session.user) ? socket.request.session.user.id : ''

        // Change user status
        User.findOneAndUpdate({$or: [ {'_id': userId}, {'socketId': socket.id} ]}, {status: 'offline', socketId: ''}, {new: false}, function (err, _user) {
          if (err) {
            return err
          }
        })

        // Remove user from active user map
        activeUsers.delete(socket.request.session.user.username.toLowerCase())

        // Emit
        socket.emit('activeUsersList', Array.from(activeUsers.keys()))
        socket.broadcast.emit('activeUsersList', Array.from(activeUsers.keys()))
      }
    })

    socket.on('login', async function (userName) {
      // Login or SignUp user
      let user = await middleware.authenicateUser(userName, socket.id)

      // Adding user object to socket session
      socket.request.session.user = user

      // Adding user name to activeUser Map
      activeUsers.set(user.username.toLowerCase(), socket)

      socket.emit('connected')

      // Emit active user list
      socket.emit('activeUsersList', Array.from(activeUsers.keys()))
      socket.broadcast.emit('activeUsersList', Array.from(activeUsers.keys()))
    })

    socket.on('initChat', async function (usersArray) {
      let tempArray = usersArray
      tempArray.push(socket.request.session.user.username)

      // WIP
      // chatServers

      let response = {
        url: defaultServer,
        roomName: tempArray.sort().join('_')
      }

      // Iterate the users list and send join request to the socket associted with the user array
      usersArray.forEach(function (element) {
        activeUsers.get(element).emit('roomConnection', response)
      })
    })
  })

  io.of('/slave_servers').on('connection', function (socket) {
    socket.on('registerIP', function (IP) {
      chatServers.set(IP, 0)
    })
  })

  io.of('/chat').on('connection', function (socket) {
    socket.on('enterRoom', async function (username, title) {
      // Login or SignUp user
      let user = await middleware.authenicateUser(username, socket.id)

      // Adding user object to socket session
      socket.request.session.user = user

      Room.findOne({
        'title': new RegExp('^' + title + '$', 'i')
      }, function (err, room) {
        if (err) throw err
        if (room) {
          Room.addUser(room, socket, function (_err, newRoom) {
            socket.join(newRoom.id)
            socket.request.roomId = newRoom.id
            socket.emit('roomReady')
          })
          socket.request.room = title
        } else {
          Room.create({
            title: title
          }, function (err, newRoom) {
            if (err) throw err
            socket.request.room = title

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
      // As the new message will be added manually in 'main.js' file
      // socket.emit('addMessage', message);

      // socket.broadcast.to(socket.request.roomId).emit('addMessage', message);
      socket.broadcast.to(socket.request.roomId).emit('addMessage', message)
    })

    // When a socket exits
    socket.on('disconnect', function () {
      // Check if user exists in the session
      if (socket.request.session.user == null) {
        return
      }

      // Find the room to which the socket is connected to,
      // and remove the current user + socket from this room
      // let userId = socket.request.session.user.id
      Room.removeUser(socket, function (err, room, _userId, _cuntUserInRoom) {
        if (err) throw err

        // Leave the room channel
        socket.leave(room.id)

        // Return the user id ONLY if the user was connected to the current room using one socket
        // The user id will be then used to remove the user from users list on chatroom page
        // if (cuntUserInRoom === 1) {
        // socket.broadcast.to(room.id).emit('removeUser', userId);
        // }
      })
    })
  })
}

/**
 * Initialize Socket.io
 * Uses Redis as Adapter for Socket.io
 *
 */
var init = function (app) {
  var server = require('http').Server(app)
  var io = require('socket.io')(server)

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
