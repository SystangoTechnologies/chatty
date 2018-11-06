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
            socket.request.user = userName.toLowerCase()
        
            let userData = {
                'serverName': io.serverName,
                'heartBeat': Date.now(),
                'status': 'active',
                'profile_pic': 'https://www.google.co.in/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png'
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
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }

            // Get all user list
            let allUsersName = await getAllUsersList(app)
            socket.emit('allUsersList', allUsersName)
        })

        // Sends messages to clients
        socket.on('getActiveUserList', async function () {
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }

            // Get all active users
            let activeUsersName = await getActiveUsersName(app)
            socket.emit('activeUsersList', activeUsersName)
        })

        // Sends messages to clients
        socket.on('getBlockedUserList', async function () {
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }

            // Get all blocked users
            let blockedUsersName = await utility.getBlockedUserList(app, this.request.user)
            socket.emit('blockedUsersList', blockedUsersName)
        })

        // BroadCast messages to all users
        socket.on('broadCastToAllUser', async function (data) {
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }

            socket.broadcast.to(app).emit('broadCastToAllUsers', data)
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
                name: 'xyz',
                display_picture: ''
                users: ['user1', 'user2']
            } 
        */
        socket.on('createGroup', async function (data) {
          
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }

            data.owner = this.request.user.toLowerCase()

            let group = await utility.createGroup(app, this.request.user, data)
            
            if(group){
                data.id = group.id
                data.status = 'success'
                data.users.push(data.owner)
                io.redisUtility.updateGroup(app, group.id, (data.users && data.users.length > 0)? data.users.join(',') : '' )
                socket.emit('groupCreated', data)

                // Emit group created to all the users
                if(data.users && data.users.length > 0){
                    emitMessgaeToUsers(data.users, data, 'groupCreated')
                }
            } else {
                data.id = 'N/A'
                data.status = 'Duplicate entry'
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

        /* Update Group Details 
            data: {
                id: 'groupId'
            }
        */
        socket.on('getGroupDetails', async function (data) {
            // If users is not logged in
            if(!this.request.user){
               socket.emit('loginRequired', '')
               return
           }

           let response = await utility.getGroupDetails(app, this.request.user, data.id)

            if(response){
                socket.emit('groupDetails', response)
            }           
        })

        /* editGroup
            data = {
                id = 'groupId',
                name = 'groupName',
                display_picture = 'url'
            }
        */
        socket.on('editGroup', async function (data) {
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }

            data.activity = 'editGroup'

            let groupUpdated = await utility.editGroup(app, this.request.user, data)

            if(groupUpdated) {
                let groupMembers = await io.redisUtility.getGroupMembers(app, data.id)
                // groupMembers.splice( groupMembers.indexOf(this.request.user), 1 )

                data.status = 'success'

                data.updatedBy = this.request.user

                // Emit group created to all the users
                if(groupMembers && groupMembers.length > 0){

                    let response = await utility.getGroupDetails(app, this.request.user, data.id)

                    if(response){

                        emitMessgaeToUsers(groupMembers, response, 'groupUpdated')
                    }

                    // emitMessgaeToUsers(groupMembers, data, 'groupUpdated')
                }

                // socket.emit('groupUpdated', data)
            } else {
                data.status = 'failed'

                data.error = 'Not authorized'
            }
            
            socket.emit('groupUpdateStatus', data)
        })

        /* addMemberToGroup
            data = {
                id = 'groupId',
                members = ['xyz']
            }
        */
        socket.on('addMemberToGroup', async function (data) {
            // If users is not logged in
            if(!this.request.user){
               socket.emit('loginRequired', '')
               return
            }

            data.status = 'success'

            data.activity = 'addMemberToGroup'

           let member = await utility.addMemberToGroup(app, this.request.user, data)

           if(member) {
                let groupMembers = await io.redisUtility.getGroupMembers(app, data.id)

                for(let index in data.members){
                    groupMembers.push(data.members[index].toLowerCase())
                }

                // Emit group created to all the users
                if(groupMembers && groupMembers.length > 0){
                    
                    io.redisUtility.updateGroup(app, data.id, groupMembers.join(','))

                    //emitMessgaeToUsers(groupMembers, data, 'newMemberToGroup')
                    let response = await utility.getGroupDetails(app, this.request.user, data.id)

                    if(response){
                        response.status = 'success'

                        emitMessgaeToUsers(groupMembers, response, 'groupUpdated')
                    }
                }

                // socket.emit('newMemberToGroup', data)
           } else {
                data.status = 'failed'

                data.error = 'User Already Present'
           }

           socket.emit('groupUpdateStatus', data)       
       })

        /* removeMemberFromGroup
            data = {
                id = 'groupId',
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

            data.status = 'success'

            data.activity = 'addMemberToGroup'

            let member = await utility.removeMemberFromGroup(app, this.request.user, data)

            if(member){
                let groupMembers = await io.redisUtility.getGroupMembers(app, data.id)

                // Emit group created to all the users
                if(groupMembers && groupMembers.length > 0){
                    // emitMessgaeToUsers(groupMembers, data, 'memberRemovedFromGroup')

                    let response = await utility.getGroupDetails(app, this.request.user, data.id)

                    if(response){
                        response.status = 'success'
                        emitMessgaeToUsers(groupMembers, response, 'groupUpdated')
                    }

                    socket.emit('groupUpdated', response)

                    groupMembers.splice( groupMembers.indexOf(data.memberName.toLowerCase()), 1 )

                    io.redisUtility.updateGroup(app, data.id, groupMembers.join(','))
                }

            } else {
                data.status = 'failed'

                data.error = 'User Not Found'
            }
            
            socket.emit('groupUpdateStatus', data)
        })

        /* leaveGroup
            data = {
                id = 'groupId'
            }
        */
        socket.on('leaveGroup', async function (data) {
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }

            data.status = 'success'

            data.activity = 'leaveGroup'

            let member = await utility.leaveGroup(app, this.request.user, data)

            if(member){
                let groupMembers = await io.redisUtility.getGroupMembers(app, data.id)

                groupMembers.splice( groupMembers.indexOf(this.request.user), 1 );

                data.status = 'success'
                data.user = this.request.user

                // Emit group created to all the users
                if(groupMembers && groupMembers.length > 0){
                // emitMessgaeToUsers(groupMembers, data, 'leftGroup')
                let response = await utility.getGroupDetails(app, this.request.user, data.id)

                    if(response){
                        response.status = 'success'
                        emitMessgaeToUsers(groupMembers, response, 'groupUpdated')
                    }

                    // socket.emit('groupUpdated', response)

                    io.redisUtility.updateGroup(app, data.id, groupMembers.join(','))
                }

            } else {

                data.status = 'failed'
                
                data.error = 'Group not found'
            }
            
            socket.emit('groupUpdateStatus', data)
        })

        /* changeMemberRole
            data = {
                id = 'groupId',
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

        data.status = 'success'

        data.activity = 'changeMemberRole'

        let member = await utility.changeMemberRole(app, this.request.user, data)

        if(member){
            data.status = 'success'
            let groupMembers = await io.redisUtility.getGroupMembers(app, data.id)

            // Emit group created to all the users
            if(groupMembers && groupMembers.length > 0){

                // emitMessgaeToUsers(groupMembers, data, 'updatedMemberRole')
                let response = await utility.getGroupDetails(app, this.request.user, data.id)

                if(response){

                    response.status = 'success'

                    emitMessgaeToUsers(groupMembers, response, 'groupUpdated')
                }
            }
        } else {
            data.status = 'failed'

            data.error = 'Member not found/Unauthorized'
        }
        
        socket.emit('groupUpdateStatus', data)  
    })
        
        /* Delete Group
            data = {
                id: 'groupId'
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
            data.status = 'success'
            let groupMembers = await io.redisUtility.getGroupMembers(app, data.id)
            io.redisUtility.deleteGroup(app, data.id)
             socket.emit('groupDeleted', data)

            // Emit group created to all the users
            if(groupMembers && groupMembers.length > 0){
                
                groupMembers.splice( groupMembers.indexOf(this.request.user), 1 )

                emitMessgaeToUsers(groupMembers, data, 'groupDeleted')
            }
          } else {
            data.status = 'failed'

            data.error = 'Not authorized'

            socket.emit('groupDeleted', data)  
          }
        })

        /* Persist Group message and sends messages to clients
            let data = {
                recipient: groupId,
                type: 'text',
                data: text,
                clientGeneratedId: 
            }
        */
        socket.on('sendGroupMessage', async function (data) {
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }
            // Set username through with the message was sent (sender)
            data.sender = this.request.user
            data.event = 'addGroupMessage'
        
            let message

            let groupMembers = await io.redisUtility.getGroupMembers(app, data.recipient)

            if(groupMembers && groupMembers.length > 0) {

                groupMembers.splice( groupMembers.indexOf(this.request.user), 1 )

                emitMessgaeToUsers(groupMembers, data, 'addGroupMessage')
            }
        })

        /* Persist Group message and sends messages to clients
            let data = {
                recipient: groupId,
                type: 'text',
                data: text,
                clientGeneratedId: 
            }
        */
        socket.on('sendGroupMessageAndPersist', async function (data) {
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }
            // Set username through with the message was sent (sender)
            data.sender = this.request.user
            data.event = 'addGroupMessage'
        
            let message

            let groupMembers = await io.redisUtility.getGroupMembers(app, data.recipient)

            if(groupMembers && groupMembers.length > 0) {

                groupMembers.splice( groupMembers.indexOf(this.request.user), 1 )

                emitMessgaeToUsers(groupMembers, data, 'addGroupMessage')
            }
        
             // Persist one to one Message in async way 
            message = utility.persistGroupMsg(app, data)
        })

         /* Get Group Chat History
             data = {
               id: 'groupId',
               noOfRecordsPerPage: 50,
               page: 1
            }
        */  
        socket.on('getGroupChatHistory', async function (data) {
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }
        
            let msg = await  utility.getGroupChatHistory(app, data, this.request.user)   
            socket.emit('addGroupChatHistoryMessages', msg)
        
            utility.changGroupMessageStatus(app, this.request.user, data.id)
        })

        /*  Update pending message status
            data = {
                id: 'groupId'
            }
        */
        socket.on('updateGroupPendingMessages', async function (data) {
            
            // If users is not logged in
            if(!this.request.user){
                socket.emit('loginRequired', '')
                return
            }

            await utility.changGroupMessageStatus(app, this.request.user, data.id)
        })

        /* Delete Message
            data = {
                groupId: 'groupId',
                clientGeneratedId: ['generatedId', 'generatedId']
            }
        */

        socket.on('deleteGroupMessage', async function (data) {
            let status = await utility.deleteGroupMessages(this.request.user, data)
            
            if(!status){
                data.status = 'Not Authorized'
                socket.emit('groupMessageDeleted', data)
                return
            }
        
            let deleteMessage = {
                clientGeneratedId: data.clientGeneratedId,
                sender: this.request.user,
                group: data.id,
                event: 'groupMessageDeleted',
                application: app,
                status: 'success'
            }

            let groupMembers = await io.redisUtility.getGroupMembers(app, data.id)

            if(groupMembers && groupMembers.length > 0) {

                emitMessgaeToUsers(groupMembers, deleteMessage, 'groupMessageDeleted')
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
        let getAllUsersList = function (application) {
          return new Promise(function (resolve, reject) {
            // Get all active users
            io.redisCache.hgetall('OnlineUsers' + '_' + application, async function (_err, users) {
              let activeUsersName = []
              for (var element in users) {
                  let user = {
                      name: element,
                      profile_pic: (JSON.parse(users[element]).profile_pic)? JSON.parse(users[element]).profile_pic : ''
                  }
                activeUsersName.push(user)
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
                data.application = app
                io.redisPublishChannel.publish(connectedServerName, JSON.stringify(data))
            }
        }

        let emitEventToGroupofUsersLocally = async function(users, data, event, application){
            for (let user in users) {
                let tempSocket = io.localActiveUsersMap.get(users[user].toLowerCase() + '_' + application)
                if (tempSocket) {
                    // emit message directly to client
                    tempSocket.emit(event, data)
                }
            }
        }

        //Emits messages to group of users
        let emitMessgaeToUsers = async function (users, data, event) {

            // Grouping messges for the servers
            let serverGroups = new Map()
            data.application = app
            data.event = event
            data.group = true
            data.users = users


            // Group users by the servers 
            for (let user in data.users) {
                let tempUsers = []
                let connectedServerName = await io.redisUtility.getServerName(app, data.users[user])
                let members = serverGroups.get(connectedServerName)

                if(members && members.length > 0) {
                    members.push(data.users[user])  
                    serverGroups.set(connectedServerName, members)
                } else {
                    tempUsers.push(data.users[user])  
                    serverGroups.set(connectedServerName, tempUsers)
                }
            }

            // Send messages to the servers for group of users
            serverGroups.forEach(function(value, key, map) {
                if(key === io.serverName){
                    emitEventToGroupofUsersLocally(value, data, event, app)
                } else{
                    io.redisPublishChannel.publish(key, JSON.stringify(data))
                }
            })
        }
    })
}
   
module.exports = init