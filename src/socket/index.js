// 'use strict'
import * as utility from './../utility/index'

let serverName = process.env.SERVER_NAME || 'ChatServer_server1'

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
      if (socket.request.user) {
        let userName = (socket.request.user) ? socket.request.user : ''

        // Delete user from active user list
        io.redisCache.hdel('OnlineUsers', userName.toLowerCase())

        // Delete user from localActiveUsersMap
        localActiveUsersMap.delete(socket.request.user.toLowerCase())

        // Get all active users
        let activeUsersName = await getActiveUsersName()

        socket.emit('activeUsersList', activeUsersName)
        socket.broadcast.emit('activeUsersList', activeUsersName)
     }
    })

    // Login or SignUp user
    socket.on('login', async function (userName) {
      
      // Adding user object to socket session
      socket.request.user = userName

      let userData = {
        'serverName': serverName,
        'heartBeat': Date.now()
      }

      // Adding username and its last active time on redis cache
      io.redisCache.hmset('OnlineUsers', userName.toLowerCase(), JSON.stringify(userData))

      // Adding user name to activeUserMap
      localActiveUsersMap.set(userName.toLowerCase(), socket)

      socket.emit('loginsuccess')

      let activeUsersName = await getActiveUsersName()

      socket.emit('activeUsersList', activeUsersName)
      socket.broadcast.emit('activeUsersList', activeUsersName)
    })

    // Sends messages to clients
    socket.on('sendMessage', async function (data) {
      // Set username through with the message was sent (sender)
      data.sender = this.request.user
      sendMessage(data)
    })

    // Persist message and sends messages to clients
    socket.on('sendMessageAndPersist', async function (data) {
      // If users is not logged in
      if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }
      // Set username through with the message was sent (sender)
      data.sender = this.request.user

      // Persist one to one Message in async way
      utility.persistOneToOneMsg(data.sender, data.recipient, data.data)

      sendMessage(data)
    })

    // Get all the pending message of current user
    socket.on('getPendingMessages', async function () {
      
      // If users is not logged in
       if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }

      let msg = await  utility.getPendingMessages(this.request.user)   
      socket.emit('addPendingMessages', msg)
    })

    socket.on('getChatHistory', async function (data) {
       // If users is not logged in
       if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }

      // data = {
      //   peer: 'xyz',
      //   messageCount: 10
      // }
      let msg = await  utility.getChatHistory(data, this.request.user)   
      socket.emit('addChatHistoryMessages', msg)
    })


    socket.on('ackReceivedPendingMessages', async function () {
       // If users is not logged in
       if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }

      let status = await utility.deleteAndChangeStatus(this.request.user)
    })

    // Gives list of user chats and latest message for the each chat record 
    socket.on('getinboxMessages', async function () {
       // If users is not logged in
       if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }

      let data = await utility.getinboxMessages(this.request.user)
       // If users is not logged in
       if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }

      socket.emit('addInboxMessages', data)
    })

    // Gives list of user chats and latest message for the each chat record 
    socket.on('getInboxMessages', async function () {
       // If users is not logged in
       if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }
      
      let data = await utility.getinboxMessages(this.request.user)
      socket.emit('addInboxMessages', data)
    })
    
  
    // Utility methods for sockets events
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

    // sends message to socket clients
    let sendMessage = function (data) {
      // Get the server name of the client (recipient)
      io.redisCache.hget('OnlineUsers', data.recipient.toLowerCase(), async function (_err, obj) {
        if(!obj){
          return
        }
        
        let message = {
          event: 'addMessage',
          sender: data.sender,
          recipient: data.recipient,
          type: data.type,
          data: data.data,
          created_at: new Date()
        }
        let channelName = JSON.parse(obj).serverName

        // Check if recipient is connected to the current server
        if (channelName === serverName) {
          let tempSocket = localActiveUsersMap.get(data.recipient.toLowerCase())
          if (tempSocket) {
            // emit message directly to client
            tempSocket.emit('addMessage', message)
          }
        } else {
          // publish message on the redis channel to specific server
          io.redisPublishChannel.publish(channelName, JSON.stringify(message))
        }
      })
    }
  })

  io.of('/').on('connection', function(socket) {
    if (socket.handshake.query.token !== 'hgQaPKevgEkwV2wK' ){
      return
    }

    socket.on('sendMessageToClients', async function (data) {
      /* msg = {
        receipent = 'xyz',
        peer = 'abc',
        data = 'msg',
        type = 'text',
        sender = 'server'
      } */
     
      // Persist one to one Message in async way
      utility.sendAndPersistMsg( data.sender, data.peer, data.recipient, data.data)

      // Get the server name of the client (recipient)
      io.redisCache.hget('OnlineUsers', data.recipient.toLowerCase(), async function (_err, obj) {
        if(!obj){
          return
        }
        let message = {
          event: 'addMessage',
          sender: data.sender,
          recipient: data.recipient,
          type: data.type,
          data: data.data,
          created_at: new Date()
        }
        let channelName = JSON.parse(obj).serverName

        // Check if recipient is connected to the current server
        if (channelName === serverName) {
          let tempSocket = localActiveUsersMap.get(data.recipient.toLowerCase())
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
  });

  // Receives messages published on redis for the client(recievers) connected to the current server
  io.messageListener.on('message', function (channel, message) {
    let socket = localActiveUsersMap.get(JSON.parse(message).recipient)
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
  var io = require('socket.io')(server, { origins: '*:*'})
  const redis = require('redis')
  const redisAdapter = require('socket.io-redis')

  const port = process.env.REDIS_PORT || 6379
  const host = process.env.REDIS_HOST || '192.168.1.40'
  const password = process.env.REDIS_PASSWORD || ''

  const pub = redis.createClient(port, host, { auth_pass: password })
  const sub = redis.createClient(port, host, { auth_pass: password })
  const redisCache = redis.createClient(port, host, { auth_pass: password })
  const messageListener = redis.createClient(port, host, { auth_pass: password })
  const redisPublishChannel = redis.createClient(port, host, { auth_pass: password })

  io.adapter(redisAdapter({ pubClient: pub, subClient: sub }))

  io.origins('*:*') 

  io.redisCache = redisCache
  io.messageListener = messageListener
  io.redisPublishChannel = redisPublishChannel

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
