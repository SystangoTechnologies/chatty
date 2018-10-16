import * as utility from './../../utility/index'

/**
 * Initialize User namespace
 *
 */
var init = function (io) {
    io.of('/users').on('connection', function (socket) {
   
        let app = (socket.handshake.query.application)? socket.handshake.query.application : 'default'
        
        // It will detect the Socket disconnection, change the user's status in database and remove users from active list
        socket.on('disconnect', async function () {
            if (socket.request.user) {
                let userName = (socket.request.user) ? socket.request.user : ''
        
                socket.leave(app);
        
                let userData = {
                'serverName': io.serverName,
                'heartBeat': Date.now(),
                'status': 'offline'
                }
        
                // Update user from active user list
                io.redisUtility.updateClientStatus(app, userName, userData)
        
                // Delete user from localActiveUsersMap
                io.localActiveUsersMap.delete(socket.request.user.toLowerCase() + '_' + app)
        
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
                'serverName': io.serverName,
                'heartBeat': Date.now(),
                'status': 'active'
            }
        
            // Adding username and its last active time on redis cache
            io.redisUtility.updateClientStatus(app, userName, userData)
            
            // Adding user name to activeUserMap
            io.localActiveUsersMap.set(userName.toLowerCase() + '_' + app, socket)
        
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
        socket.on('getActiveUserList', async function () {
            // Get all user list
            let activeUsersName = await getActiveUsersName(app)
            socket.emit('activeUsersList', activeUsersName)
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
    
        /*  Update pending message status
            data = {
                peer: 'xyz'
            }
        */
        socket.on('updatePendingMessages', async function (data) {
          
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }
            await utility.changePendingMessageStatus(app, this.request.user, data)     
        })
    
        /* Block User
            data = {
                peer: 'xyz'
            }
        */
        socket.on('blockUser', async function (data) {
    
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }
        
            let status = await  utility.blockUser(app, this.request.user, data)
        
            if(status){
                data.blockedBy = this.request.user
                data.event = 'userBlocked'
                data.recipient = data.user
        
                socket.emit('userBlocked', data)
        
                emitToPeer(app, data, 'userBlocked')
            }     
        })
    
        /* unblock User
            data = {
               user: 'xyz'
            }
        */
        socket.on('unblockUser', async function (data) {
          
          // If users is not logged in
          if(!this.request.user){
            socket.emit('loginRequired', '')
            return
          }
    
          let status = await  utility.unblockUser(app, this.request.user, data)
    
          if(status){
            data.unblockedBy = this.request.user
            data.event = 'userUnblocked'
            data.recipient = data.user
    
            socket.emit('userUnblocked', data)
    
            emitToPeer(app, data, 'userUnblocked')
          }
        })
    
        /* Get Chat History
             data = {
               peer: 'xyz',
               noOfRecordsPerPage: 50,
               page: 1
            }
        */  
        socket.on('getChatHistory', async function (data) {
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }
        
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
    
        /* Create Group
            data = {
                name: 'xyz'
            } 
        */
        socket.on('createGroup', async function (data) {
          
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }
            let status = await utility.createGroup(app, this.request.user, data)
            
            if(status){
                socket.emit('groupCreated', data)  
            }

            let groups = await utility.getAllGroups(app, this.request.user)
            if(groups){
                socket.emit('allGroups', groups)
            }
        })

        /* GetAllGroups */
        socket.on('getAllGroups', async function () {
             // If users is not logged in
             if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }

            let groups = await utility.getAllGroups(app, this.request.user)
            if(groups){
                socket.emit('allGroups', groups)
            }           
        })

        /* addMemberToGroup
            data = {
                groupName = '',
                role = '',
                memberName = ''
            }
        */
        socket.on('addMemberToGroup', async function (data) {
            // If users is not logged in
            if(!this.request.user){
               socket.emit('loginRequired', '')
               return
           }

           let member = await utility.addMemberToGroup(app, this.request.user, data)

           if(member){
               socket.emit('newMemberToGroup', data)
           }           
       })

        /* removeMemberFromGroup
            data = {
                groupName = '',
                role = '',
                memberName = ''
            }
        */
        socket.on('removeMemberFromGroup', async function (data) {
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }

            let member = await utility.removeMemberFromGroup(app, this.request.user, data)

            if(member){
                socket.emit('memberRemovedFromGroup', data)
            }           
        })

        /* changeMemberRole
            data = {
                groupName = '',
                role = '',
                memberName = ''
            }
        */
       socket.on('changeMemberRole', async function (data) {
        // If users is not logged in
        if(!this.request.user){
            socket.emit('loginRequired', '')
            return
        }

        let member = await utility.changeMemberRole(app, this.request.user, data)

        if(member){
            socket.emit('updatedMemberRole', data)
        }           
    })
        
        /* Delete Group
            data = {
                name: 'xyz'
            } 
        */
        socket.on('deleteGroup', async function (data) {
            
          // If users is not logged in
          if(!this.request.user){
            socket.emit('loginRequired', '')
            return
          }
    
          let status = await utility.deleteGroup(app, this.request.user, data)
    
          if(status){
            socket.emit('groupDeleted', data)  
          }    
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

        //Emits messages to user
        let emitToPeer = async function (app, data, event) {
                
            let connectedServerName = await io.redisUtility.getServerName(app, data.recipient)

            data.event = event
            
            // Check if recipient is connected to the current server
            if (connectedServerName === io.serverName) {
            let tempSocket = io.localActiveUsersMap.get(data.recipient.toLowerCase() + '_' + app)
            if (tempSocket) {
                // emit message directly to client
                tempSocket.emit(event, data)
            }
            } else {
            // publish message on the redis channel to specific server
            io.redisPublishChannel.publish(connectedServerName, JSON.stringify(data))
            }
        }
    })
}
   
module.exports = init