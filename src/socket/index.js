// 'use strict'
import * as utility from './../utility/index'
import config from "./../../config";

let serverName = process.env.SERVER_NAME || 'ChatServer_server1'

let localActiveUsersMap = new Map()

/**
 * Encapsulates all code for emitting and listening to socket events
 *
 */
var ioEvents = function (io) {
  // Users namespace
  io.of('/users').on('connection', function (socket) {

    let app = (socket.handshake.query.application)? socket.handshake.query.application : 'default'
    
    // It will detect the Socket disconnection, change the user's status in database and remove users from active list
    socket.on('disconnect', async function () {
      if (socket.request.user) {
        let userName = (socket.request.user) ? socket.request.user : ''

        socket.leave(app);

        // Delete user from active user list
        io.redisCache.hdel('OnlineUsers' + '_' + app, userName.toLowerCase())

        // Delete user from localActiveUsersMap
        localActiveUsersMap.delete(socket.request.user.toLowerCase() + '_' + app)

        // Get all active users
        let activeUsersName = await getActiveUsersName(app)

        socket.emit('activeUsersList', activeUsersName)
        socket.broadcast.to(app).emit('activeUsersList', activeUsersName);
        // socket.broadcast.emit('activeUsersList', activeUsersName)
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
      io.redisCache.hmset('OnlineUsers' + '_' + app, userName.toLowerCase(), JSON.stringify(userData))

      // Adding user name to activeUserMap
      localActiveUsersMap.set(userName.toLowerCase() + '_' + app, socket)

      socket.join(app)

      socket.emit('loginsuccess')

      let activeUsersName = await getActiveUsersName(app)

      socket.emit('activeUsersList', activeUsersName)
      socket.broadcast.to(app).emit('activeUsersList', activeUsersName);
      //socket.broadcast.emit('activeUsersList', activeUsersName)

      // Get Pending messages
      let msg = await  utility.getPendingMessages(app, this.request.user)   
      socket.emit('addPendingMessages', msg)

      // Delete message from pending tables and change message status
      await utility.deleteAndChangeStatus(app, this.request.user)
    })

    // Sends messages to clients
    socket.on('sendMessage', async function (data) {
      // Set username through with the message was sent (sender)
      data.sender = this.request.user
      sendMessage(app, data, false)
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

      let echoAndDeleteFunctionality = config.echoSentMessage

      let message

      if(echoAndDeleteFunctionality){
        message = await utility.persistOneToOneMsg(app, data.sender, data.recipient, data.data)
      } else {
        message = utility.persistOneToOneMsg(app, data.sender, data.recipient, data.data)
      }

      // Persist one to one Message in async way 
      sendMessage(app, data, true, message.id)
    })

    // Get all the pending message of current user
    socket.on('getPendingMessages', async function () {
      
      // If users is not logged in
       if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }

      let msg = await  utility.getPendingMessages(app, this.request.user)   
      socket.emit('addPendingMessages', msg)
    })

    // Block User
    socket.on('blockUser', async function (data) {
      
      // If users is not logged in
       if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }

      // data = {
      //    user: 'xyz'
      // }
      let status = await  utility.blockUser(app, this.request.user, data)

      if(status){
        data.blockedBy = this.request.user
        socket.emit('userBlocked', data)
      }
     
    })

     // Block User
     socket.on('unblockUser', async function (data) {
      
      // If users is not logged in
       if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }

      // data = {
      //    user: 'xyz'
      // }
      let status = await  utility.unblockUser(app, this.request.user, data)

      if(status){
        data.unblockedBy = this.request.user
        socket.emit('userUnblocked', data)
      }
    })

    // Get Chat History
    socket.on('getChatHistory', async function (data) {
       // If users is not logged in
       if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }

      // data = {
      //   peer: 'xyz',
      //   noOfRecordsPerPage: 50,
      //   page: 1
      // }
      let msg = await  utility.getChatHistory(app, data, this.request.user)   
      socket.emit('addChatHistoryMessages', msg)
    })


    socket.on('ackReceivedPendingMessages', async function () {
       // If users is not logged in
       if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }

      let status = await utility.deleteAndChangeStatus(app, this.request.user)
    })

    // Gives list of user chats and latest message for the each chat record 
    socket.on('getInboxMessages', async function () {
       // If users is not logged in
       if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }
      
      let data = await utility.getinboxMessages(app, this.request.user)
      socket.emit('addInboxMessages', data)
    })

    socket.on('deleteMessage', async function (data) {
      await utility.deleteMessages(this.request.user, data)
      
      let deleteMessage = {
        messageId: data.messageId,
        sender: this.request.user,
        recipient: data.recipient,
        application: app
      }
      socket.emit('messageDeleted', deleteMessage)

      io.redisCache.hget('OnlineUsers' + '_' + app, data.recipient.toLowerCase(), async function (_err, obj) {
        if(!obj){
          return
        }

        let channelName = JSON.parse(obj).serverName

        // Emit messageDeleted to peer
        if (channelName === serverName) {
          let tempSocket = localActiveUsersMap.get(data.recipient.toLowerCase() + '_' + app)
          if (tempSocket) {
            // emit message directly to client
            tempSocket.emit('messageDeleted', deleteMessage)
          }
        } else {
          // publish message on the redis channel to specific server
          io.redisPublishChannel.publish(channelName, JSON.stringify(message))
        }
      })
    })
    
  
    // Utility methods for sockets events
    let getActiveUsersName = function (application) {
      return new Promise(function (resolve, reject) {
        // Get all active users
        io.redisCache.hgetall('OnlineUsers' + '_' + application, async function (_err, users) {
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
    let sendMessage = function (application, data, persist, messageId) {
      // Get the server name of the client (recipient)
      io.redisCache.hget('OnlineUsers' + '_' + application, data.recipient.toLowerCase(), async function (_err, obj) {
        if(!obj){
          return
        }
        
        let message = {
          id : ( messageId )? messageId : 'N/A',
          event: 'addMessage',
          sender: data.sender,
          recipient: data.recipient,
          type: data.type,
          data: data.data,
          created_at: new Date(),
          application: application
        }

        if( config.echoSentMessage && persist ){
          socket.emit('addMessage', message)
        }

        let channelName = JSON.parse(obj).serverName

        // Check if recipient is connected to the current server
        if (channelName === serverName) {
          let tempSocket = localActiveUsersMap.get(data.recipient.toLowerCase() + '_' + application)
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
    
    let app = (socket.handshake.query.application)? socket.handshake.query.application : 'default'

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
      utility.sendAndPersistMsg(app, data.sender, data.peer, data.recipient, data.data)

      // Get the server name of the client (recipient)
      io.redisCache.hget('OnlineUsers' + '_' + app, data.recipient.toLowerCase(), async function (_err, obj) {
        if(!obj){
          return
        }
        let message = {
          event: 'addMessage',
          sender: data.sender,
          recipient: data.recipient,
          type: data.type,
          data: data.data,
          created_at: new Date(),
          application: app
        }
        let channelName = JSON.parse(obj).serverName

        io.redisPublishChannel.publish(channelName, JSON.stringify(message))
      })
    })
  });

  // Receives messages published on redis for the client(recievers) connected to the current server
  io.messageListener.on('message', function (channel, message) {
    let msg = JSON.parse(message)
    let socket = localActiveUsersMap.get(msg.recipient + '_' + msg.application)
    if (socket) {
      socket.emit('addMessage', msg)
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


