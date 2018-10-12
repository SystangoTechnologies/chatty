// 'use strict'
import * as utility from './../utility/index'
import config from "./../../config";

let serverName = process.env.SERVER_NAME || 'ChatServer_server1'
let localActiveUsersMap = new Map()
let gamesServerMap = new Map()

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

        let userData = {
          'serverName': serverName,
          'heartBeat': Date.now(),
          'status': 'offline'
        }

        // Update user from active user list
        io.redisUtility.updateClientStatus(app, userName, userData)

        // Delete user from localActiveUsersMap
        localActiveUsersMap.delete(socket.request.user.toLowerCase() + '_' + app)

        // Get all active users
        let activeUsersName = await getActiveUsersName(app)

        socket.emit('activeUsersList', activeUsersName)
        socket.broadcast.to(app).emit('activeUsersList', activeUsersName)
     }
    })

    // Login or SignUp user
    socket.on('login', async function (userName) {
     
      // Adding user object to socket session
      socket.request.user = userName

      let userData = {
        'serverName': serverName,
        'heartBeat': Date.now(),
        'status': 'active'
      }

      // Adding username and its last active time on redis cache
      io.redisUtility.updateClientStatus(app, userName, userData)
      
      // Adding user name to activeUserMap
      localActiveUsersMap.set(userName.toLowerCase() + '_' + app, socket)

      socket.join(app)

      socket.emit('loginsuccess')

      let activeUsersName = await getActiveUsersName(app)

      socket.emit('activeUsersList', activeUsersName)
      socket.broadcast.to(app).emit('activeUsersList', activeUsersName)
    })

     // Sends messages to clients
     socket.on('getAllUserList', async function () {
      // Get all user list
      let allUsersName = await getAllUsersName(app)
      socket.emit('allUsersList', allUsersName)
    })

    // Sends messages to clients
    socket.on('sendMessage', async function (data) {
      // Set username through with the message was sent (sender)
      data.sender = this.request.user
      data.event = 'addMessage'
      
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
      data.event = 'addMessage'

      let message

      message = utility.persistOneToOneMsg(app, data)

      // Persist one to one Message in async way 
      sendMessage(app, data, true, message.id)
    })

    // Update pending message status
    socket.on('updatePendingMessages', async function (data) {
      
      // If users is not logged in
      if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }

      // data = {
      //    peer: 'xyz'
      // }
      await utility.changePendingMessageStatus(app, this.request.user, data)     
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
        data.event = 'userBlocked'
        data.recipient = data.user

        socket.emit('userBlocked', data)

        emitToPeer(app, data, 'userBlocked')
      }     
    })

     // unblock User
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
        data.event = 'userUnblocked'
        data.recipient = data.user

        socket.emit('userUnblocked', data)

        emitToPeer(app, data, 'userUnblocked')
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

      await utility.changePendingMessageStatus(app, this.request.user, data)
    })

    // Gives list of user chats and latest message for the each chat record 
    socket.on('getInboxMessages', async function (page) {
      // If users is not logged in
      if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }
      
      let data = await utility.getinboxMessages(app, this.request.user, page)
      socket.emit('addInboxMessages', data)
    })

    // send media files
    socket.on('sendMedia', async function (data) {
      // If users is not logged in
      if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }

      let message = {
        event: 'addMessage',
        sender: data.sender,
        recipient: data.recipient,
        type: data.type,
        data: data.data,
        created_at: new Date(),
        application: app,
        clientGeneratedId: (data.clientGeneratedId)? data.clientGeneratedId : 'N/A'
      }

      emitToPeer(app, message, 'addMessage')

      utility.addMediaMessages(app, this.request.user, message)

    })

    socket.on('deleteMessage', async function (data) {
      let status = await utility.deleteMessages(this.request.user, data)
      
      if(!status){
        return
      }

      let deleteMessage = {
        clientGeneratedId: data.clientGeneratedId,
        sender: this.request.user,
        recipient: data.recipient,
        event: 'messageDeleted',
        application: app
      }

      socket.emit('messageDeleted', deleteMessage)

      emitToPeer(app, message, 'messageDeleted')
    })

    /*
      Group Chat
    */

    // Create Group
    /* data = {
        peer: 'xyz'
      } 
    */
    socket.on('createGroup', async function (data) {
      
      // If users is not logged in
       if(!this.request.user){
        socket.emit('loginRequired', '')
        return
      }
      await utility.createGroup(app, this.request.user, data)     
    })   
  
    // Utility methods for sockets events
    let getActiveUsersName = function (application) {
      return new Promise(function (resolve, reject) {
        // Get all active users
        io.redisCache.hgetall('OnlineUsers' + '_' + application, async function (_err, users) {
          let activeUsersName = []
          for (var element in users) {
            if(JSON.parse(users[element]).status === 'active'){
              activeUsersName.push(element)
            }           
          } // scope of for
          // Active users
          resolve(activeUsersName)
        })
      })
    }

    // Utility methods for sockets events
    let getAllUsersName = function (application) {
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

      let message = {
        id : ( messageId )? messageId : 'N/A',
        event: data.event,
        sender: data.sender,
        recipient: data.recipient,
        type: data.type,
        data: data.data,
        created_at: new Date(),
        application: application,
        clientGeneratedId: (data.clientGeneratedId)? data.clientGeneratedId : 'N/A'
      }

      emitToPeer(app, message, data.event)
    }
  })

  io.of('/').on('connection', function(socket) {
    
    let app = (socket.handshake.query.application)? socket.handshake.query.application : 'default'

    if (socket.handshake.query.token !== 'hgQaPKevgEkwV2wK' ){
      return
    }

    /* data = {
        receipent = 'xyz',
        peer = 'abc',
        data = 'msg',
        type = 'text',
        sender = 'server'
    } */
    socket.on('sendMessageToClients', async function (data) {     
      // Persist one to one Message in async way
      utility.sendAndPersistMsg(app, data.sender, data.peer, data.recipient, data.data)

      let message = {
        event: 'addMessage',
        sender: data.sender,
        recipient: data.recipient,
        type: data.type,
        data: data.data,
        created_at: new Date(),
        application: app
      }

      let connectedServerName = await io.redisUtility.getServerName(app, data.recipient)
      io.redisPublishChannel.publish(connectedServerName, JSON.stringify(message))
    })
  })

  //Emits messages to user
  let emitToPeer = async function (app, data, event) {
           
    let connectedServerName = await io.redisUtility.getServerName(app, data.recipient)

    data.event = event
    
    // Check if recipient is connected to the current server
    if (connectedServerName === serverName) {
      let tempSocket = localActiveUsersMap.get(data.recipient.toLowerCase() + '_' + app)
      if (tempSocket) {
        // emit message directly to client
        tempSocket.emit(event, data)
      }
    } else {
      // publish message on the redis channel to specific server
      io.redisPublishChannel.publish(connectedServerName, JSON.stringify(data))
    }
  }

  // Receives messages published on redis for the client(recievers) connected to the current server
  io.messageListener.on('message', function (channel, message) {
    let msg = JSON.parse(message)
    let socket = localActiveUsersMap.get(msg.recipient + '_' + msg.application)
    if (socket) {
      if(msg.event){
        socket.emit(msg.event, msg)
      } else{
        socket.emit('addMessage', msg)
      }
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
  var redisUtility

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


