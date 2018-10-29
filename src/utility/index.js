import db from './../models/index'

// Persisting one to one messages
export async function persistOneToOneMsg (app, data) {
    let transaction
    try{
        // Check message is being sent to different user
        if(data.sender.toLowerCase() === data.recipient.toLowerCase()){
            return
        }

        // Creating transaction 
        transaction = await db.sequelize.transaction()

        // Getting the conversation Id 
        let conversation = await getConversation(app, data.sender, data.recipient)
    
        let msg = await db.Message.create({
            data: data.data,
            sender: data.sender.toLowerCase(),
            url: '',
            status: 0,
            clientGeneratedId: data.clientGeneratedId,
            peer_conversation_id: conversation.id
        }, { transaction: transaction })

        // Storing messages reference in Pending Table
        let pendingMsg = await db.Pending.create({
            recipient: data.recipient.toLowerCase(),
            message_id: msg.dataValues.id
        }, { transaction: transaction })

        // Commiting the transaction
        await transaction.commit()

        return msg

    } catch(err){
        // Rollback the transaction
        await transaction.rollback()
        console.log(err)
    }
}


// Persisting group messages
export async function persistGroupMsg (app, data) {
    let transaction
    try{
        // Check message is being sent to different user
        if(data.sender.toLowerCase() === data.recipient.toLowerCase()){
            return
        }

        // Creating transaction 
        transaction = await db.sequelize.transaction()

        // Getting the conversation Id 
        let members = await getAllMembersWithAuth(app, data.sender.toLowerCase(), data.recipient)

        if(members && members.length > 0) {
            let msg = await db.Message.create({
                data: data.data,
                sender: data.sender.toLowerCase(),
                url: '',
                status: 0,
                type: data.type,
                clientGeneratedId: data.clientGeneratedId,
                group_conversation_id: data.recipient
            }, { transaction: transaction })

            let pendingMsg = []
            for(let index in members){
                if(data.sender != members[index]){
                    pendingMsg.push({
                        recipient: members[index].toLowerCase(),
                        message_id: msg.dataValues.id
                    })
                }
            }

            db.Pending.bulkCreate(pendingMsg)
        }

        // Commiting the transaction
        await transaction.commit()

        return true

    } catch(err){
        // Rollback the transaction
        await transaction.rollback()
        console.log(err)
    }
}

// Message sent by servers
export async function sendAndPersistMsg(app, sender, peer, recipient, data) {
    let transaction
    try{

        // Creating transaction 
        transaction = await db.sequelize.transaction()

        // Getting the conversation Id 
        let conversation = await getConversation(app, peer, recipient)
    
        let msg = await db.Message.create({
            data: data,
            sender: sender.toLowerCase(),
            url: '',
            status: 0,
            peer_conversation_id: conversation.id
        }, { transaction: transaction })

        // Storing messages reference in Pending Table
        let pendingMsg = await db.Pending.create({
            recipient: recipient.toLowerCase(),
            message_id: msg.dataValues.id
        }, { transaction: transaction })

         // Commiting the transaction
         await transaction.commit()

    } catch(err){
        // Rollback the transaction
        await transaction.rollback()
        console.log(err)
    }
}

export async function getPendingMessages (app, user) {
    try{
       // check sender and recipient
       if(!user){
           return false;
       }

       // Get all the IDs wrt to user and application
       let conversationIds = await getConversationIds(app, user)
       let msgs
       
        if(conversationIds && conversationIds.length > 0){
            // Fetching messages for the current user
            msgs = await db.Message.findAll({
                where: {
                    peer_conversation_id: {
                        $in: conversationIds
                    }
                },
                include: [{
                    model: db.Pending,
                    where: {
                        recipient: user.toLowerCase()  
                    },
                }],
                order: [['created_at', 'DESC']],
                raw: true
            })
        }
        if (msgs.length){
            return msgs
        }        
        
    } catch(err){
        console.log(err)
    }
}

export async function getChatHistory(app, data, currentUser) {
    try{
        currentUser = currentUser.toLowerCase()
        data.peer = data.peer.toLowerCase()

        // Arranging users lexicographically
        let user1 = (data.peer < currentUser) ? data.peer : currentUser,
        user2 = (data.peer > currentUser) ? data.peer : currentUser


        let limit = (data.noOfRecordsPerPage)? data.noOfRecordsPerPage : 50 // number of records per page
        let offset = 0
        let page = (data.page)? data.page : 1 // page number
        offset = limit * (page - 1)
 
        let peerConversation =  await db.Peer_conversation.findAll({
            
            where: {
                user1: user1,
                user2: user2,
                application: app
            },
            attributes: {
                include: [[db.Sequelize.col('Messages.data'), 'data'],
                   [db.Sequelize.col('Messages.sender'), 'sender'],
                   [db.Sequelize.col('Messages.created_at'), 'created_at'],
                   [db.Sequelize.col('Messages.clientGeneratedId'), 'clientGeneratedId']
                ]
            },
             include: [{
                 model: db.Message,
                 where: {
                    created_at: {
                        $ne: null 
                    }                    
                 },
                 // through: {attributes: []},
                 duplicating: false
             }],
            order: [[db.Sequelize.col('Messages.created_at'), 'DESC']],
            limit: limit,
            offset: offset,
            raw: true
         })

         let historyMessages

         if(peerConversation.length){
            historyMessages = {
                state: (peerConversation[0].user1_conversation_blocked || peerConversation[0].user2_conversation_blocked)? 'blocked' : 'active',
                user1_conversation_blocked: peerConversation[0].user1_conversation_blocked,
                user2_conversation_blocked: peerConversation[0].user2_conversation_blocked,
                currentPage: page,
                messages: peerConversation.reverse()
             }
         }
         
         return historyMessages
         
     } catch(err){
         console.log(err)
     }
}

export async function getBlockedUserList(app, user){
    try{
        user = user.toLowerCase()

        let blockedUsers =  await db.Peer_conversation.findAll({
            where: {
                [db.Sequelize.Op.or]: [{user1: user}, {user2: user}],
                application: app,
                [db.Sequelize.Op.or]: [{user1_conversation_blocked: true}, {user2_conversation_blocked: true}]
                // blocked:{
                //     [db.Sequelize.Op.notIn]: [user, ''],
                // } 
            }
        })

        let users = []
        if(blockedUsers && blockedUsers.length>0) {
            blockedUsers.map( conversation => users.push(conversation.dataValues.blocked))
        }
        return users;
    } catch(err){

    }
}

export async function deleteAndChangeStatus (app, user, data) {
    let transaction
    try {

       // Creating transaction 
       transaction = await db.sequelize.transaction()

        // Get all the IDs wrt to user and application
       let pendingMessages = await getPendingMessages(app, user)

        let msgIds = []
        let pendingMsgIds = []
     
        if(pendingMessages && pendingMessages.length>0) {
            pendingMessages.map( msg => msgIds.push(msg.id))
            pendingMessages.map( msg => pendingMsgIds.push(msg['Pendings.id']))

            let allMessages = await db.Message.update({
                status:1
              }, {
                where: {
                    id: {
                        $in: msgIds
                    }
                }
            }, { transaction: transaction })

            db.Pending.destroy({
                where: {
                    id: {
                        $in: pendingMsgIds
                    }
                }
            }, { transaction: transaction })
        }

        // Commiting the transaction
        await transaction.commit()
                    
    } catch (err) {
        // Rollback the transaction
        await transaction.rollback()
        
        // WIP
        console.log(err);
    }

}

export async function changePendingMessageStatus (app, user, data) {
    let transaction
    let msgIds = []
    let pendingMsgIds = []
    let pendingMessages

    try {

        user = user.toLowerCase()
        data.peer = data.peer.toLowerCase()

        // Arranging users lexicographically
        let user1 = (user < data.peer) ? user : data.peer,
              user2 = (user > data.peer) ? user : data.peer

       let peerConversation =  await db.Peer_conversation.findAll({
            where: {
                user1: user1,
                user2: user2,
                application: app
            }
       })

       if(peerConversation.length){
            // Get All pending messages wrt conversation id  
            pendingMessages = await db.Message.findAll({
                where: {
                    peer_conversation_id: peerConversation[0].dataValues.id
                },
                include: [{
                    model: db.Pending,
                    where: {
                        recipient: user  
                    },
                }],
                order: [['created_at', 'DESC']],
                raw: true
            })

            if(pendingMessages && pendingMessages.length>0) {
                pendingMessages.map( msg => msgIds.push(msg.id))
                pendingMessages.map( msg => pendingMsgIds.push(msg['Pendings.id']))

                // Update message status
                let allMessages = await db.Message.update({
                    status:1
                }, {
                    where: {
                        id: {
                            $in: msgIds
                        }
                    }
                })

                // Remove message from the pending table
                db.Pending.destroy({
                    where: {
                        id: {
                            $in: pendingMsgIds
                        }
                    }
                })
            }
       }
       
                    
    } catch (err) {        
        // WIP
        console.log(err);
    }

}

export async function getinboxMessages (app, user, data) {
    try {
        let limit = (data && data.noOfRecordsPerPage)? data.noOfRecordsPerPage : 100 // number of records per page
        let offset = 0
        let page = (data && data.page)? data.page : 1 // page number
        offset = limit * (page - 1)

        user = user.toLowerCase()

        let peerConversation =  await db.Peer_conversation.findAll({
            where: {
                [db.Sequelize.Op.or]: [{user1: user}, {user2: user}],
                application: app
            },
            raw: true
        })
       
        let conversationIds = [];

        let peerConversationMap = new Map()

        if(peerConversation && peerConversation.length>0) {
            peerConversation.map( conversation => conversationIds.push(conversation.id))
            peerConversation.map( conversation => peerConversationMap.set(conversation.id, conversation))
        }

        let groupConversationMap = await getAllGroupDetails(app, user)

        conversationIds = conversationIds.concat([... groupConversationMap.keys()])

        if(conversationIds && conversationIds.length > 0){
            let pendingMessageCount = await getPendingMessageCount (app, user, conversationIds)

            let latestMessagesPeerCoversation = await getlatestMessagesForPeerConversation(conversationIds)

            let latestMessagesGroupCoversation = await getlatestMessagesForGroupConversation(conversationIds)
    
            let result = await groupAndSortResults(user, conversationIds, peerConversationMap, groupConversationMap, latestMessagesPeerCoversation, latestMessagesGroupCoversation, pendingMessageCount)
    
            result.sort(function(a, b){
                if(a['Messages.created_at']  > b['Messages.created_at']){
                    return -1
                } else {
                    return 1
                }
            })
    
            return result.slice(offset, limit * page)
        }

        return []

    } catch(err){
        console.log('err', err)
    }
   
}

export async function deleteMessages(user, message){
    let status
    user = user.toLowerCase()

    try{
        let status = await db.Message.destroy({
            where: {
                sender: user,
                clientGeneratedId: {
                    $in: message.clientGeneratedId
                }
            }
        })
        return true
    } catch(err){
        return false
        console.log(err)
    }
}

export async function blockUser (app, user, data) {
    try{
        user = user.toLowerCase()
        data.user = data.user.toLowerCase()

         // Arranging users lexicographically
         let user1 = (user < data.user) ? user : data.user,
         user2 = (user > data.user) ? user : data.user

        let updateFields = {}

        if(user === user1){
            updateFields = {
                user1_conversation_blocked: true
            }
        } else {
            updateFields = {
                user2_conversation_blocked: true
            }
        }

        let peerConversation =  await db.Peer_conversation.update(updateFields,{
            where: {
                user1: user1,
                user2: user2,
                application: app
            }
        })

        return true

    } catch(err){
        return false
    }
}

export async function unblockUser (app, user, data) {
    try{
        user = user.toLowerCase()
        data.user = data.user.toLowerCase()

        if(user == data.user){
            return false
        }
        // Arranging users lexicographically
        let user1 = (user < data.user) ? user : data.user,
         user2 = (user > data.user) ? user : data.user

        let updateFields = {}

        if(user === user1){
            updateFields = {
            user1_conversation_blocked: false
            }
        } else {
            updateFields = {
            user2_conversation_blocked: false
            }
        }

        let peerConversation =  await db.Peer_conversation.update(updateFields, {
            where: {
                user1: user1,
                user2: user2,
                application: app
            }
        })

        return true

    } catch(err){

    }
}

export async function archiveMessage (app, user, data) {
    try{
        user = user.toLowerCase()
        data.peer = data.user.toLowerCase()

        // Arranging users lexicographically
        let user1 = (user < data.peer) ? user : data.peer,
         user2 = (user > data.peer) ? user : data.peer


        let updateFields = {}

        if(user === user1){
            updateFields = {
                user1_conversation_archived: true
            }
        } else {
            updateFields = {
                user2_conversation_archived: true
            }
        }

        let peerConversation =  await db.Peer_conversation.update(updateFields,{
                where: {
                    user1: user1,
                    user2: user2,
                    application: app
                }
        })

        return true

    } catch(err){

    }
}

export async function addMediaMessages(app, sender, message){
    let transaction
    try{

        // Creating transaction 
        transaction = await db.sequelize.transaction()

        // Getting the conversation Id 
        let conversation = await getConversation(app, sender, message.recipient)
    
        let msg = await db.Message.create({
            data: message.data,
            sender: sender.toLowerCase(),
            url: message.url,
            type: message.type,
            status: 0,
            clientGeneratedId: (message.clientGeneratedId)? message.clientGeneratedId : 'N/A',
            peer_conversation_id: conversation.id,
            clientGeneratedId: message.clientGeneratedId
        }, { transaction: transaction })

        // Storing messages reference in Pending Table
        let pendingMsg = await db.Pending.create({
            recipient: message.recipient.toLowerCase(),
            message_id: msg.dataValues.id
        }, { transaction: transaction })

         // Commiting the transaction
         await transaction.commit()

    } catch(err){
        // Rollback the transaction
        await transaction.rollback()
        console.log(err)
    }
}

export async function createGroup(app, user, data){
    try{
        let group = await db.Group_conversation.create({
            name: data.name.toLowerCase(),
            encryption_key: Math.random().toString(36).replace('0.', ''),
            application: app,
            display_picture: (data.display_picture)? data.display_picture : '',
            owner: user
        })

        if(data.users && data.users.length > 0){
            let usersArray = []
            for(let index in data.users){
                usersArray.push({
                    name: data.users[index].toLowerCase(),
                    role: 'normal',
                    group_conversation_id: group.dataValues.id
                })
            }

            db.Group_Member.bulkCreate(usersArray)
        }

        return group

    } catch(err){
        if(err.name == 'SequelizeUniqueConstraintError'){
           return false
        }
        // Wip
        console.log(err)
    }
}

export async function getGroupChatHistory(app, data, currentUser) {
    try{

        let limit = (data.noOfRecordsPerPage)? data.noOfRecordsPerPage : 50 // number of records per page
        let offset = 0
        let page = (data.page)? data.page : 1 // page number
        offset = limit * (page - 1)
 
        let groupConversation =  await db.Group_conversation.findAll({
            
            where: {
                id: data.id,
                application: app
            },
            attributes: {
                include: [[db.Sequelize.col('Messages.data'), 'data'],
                   [db.Sequelize.col('Messages.sender'), 'sender'],
                   [db.Sequelize.col('Messages.created_at'), 'created_at'],
                   [db.Sequelize.col('Messages.clientGeneratedId'), 'clientGeneratedId']
                ]
            },
             include: [{
                 model: db.Message,
                 where: {
                    created_at: {
                        $ne: null 
                    }                    
                 },
                 // through: {attributes: []},
                 duplicating: false
             }],
            order: [[db.Sequelize.col('Messages.created_at'), 'DESC']],
            limit: limit,
            offset: offset,
            raw: true
         })

         let historyMessages

         if(groupConversation.length){
            historyMessages = {
                id: groupConversation[0].id,
                name: groupConversation[0].name,
                display_picture: groupConversation[0].display_picture,
                currentPage: page,
                messages: groupConversation.reverse()
             }
         }
         
         return historyMessages
         
     } catch(err){
         console.log(err)
     }
}

export async function changGroupMessageStatus (app, user, groupId) {
    let transaction
    let msgIds = []
    let pendingMsgIds = []
    let pendingMessages

    try {

        user = user.toLowerCase()
       
        // Get All pending messages wrt conversation id  
        pendingMessages = await db.Message.findAll({
            where: {
                group_conversation_id: groupId
            },
            include: [{
                model: db.Pending,
                where: {
                    recipient: user  
                },
            }],
            order: [['created_at', 'DESC']],
            raw: true
        })

        if(pendingMessages && pendingMessages.length>0) {
            pendingMessages.map( msg => msgIds.push(msg.id))
            pendingMessages.map( msg => pendingMsgIds.push(msg['Pendings.id']))

            // Update message status
            let allMessages = await db.Message.update({
                status:1
            }, {
                where: {
                    id: {
                        $in: msgIds
                    }
                }
            })

            // Remove message from the pending table
            db.Pending.destroy({
                where: {
                    id: {
                        $in: pendingMsgIds
                    }
                }
            })
        }      
                    
    } catch (err) {        
        // WIP
        console.log(err);
    }

}

export async function getAllGroups(app, user){
    try{
        let ownedGroup = await db.Group_conversation.findAll({
            where: {
                application: app,
                owner: user
            }            
        })

        let groups = []        

        if(ownedGroup && ownedGroup.length>0) {
            ownedGroup.map( conversation => groups.push({ id: conversation.dataValues.id, name: conversation.dataValues.name, role: 'owner'}))
        }

        let memeberGroup = await db.Group_conversation.findAll({
            where: {
                application: app
            }, 
            include: {
                model: db.Group_Member,
                where: {
                    name: user
                },
            },
            attributes: {
                include: [[db.Sequelize.col('Group_Members.role'), 'role']]
            },
        })

        if(memeberGroup && memeberGroup.length>0) {
            memeberGroup.map( conversation => groups.push({ id: conversation.dataValues.id, name: conversation.dataValues.name, role: conversation.dataValues.Group_Members[0].role}))
        }

        return groups

    } catch(err){
        // Wip
        console.log(err)
    }
}

export async function getAllMembersWithAuth(app, user, groupId){
    try{
        let groupMembers = await db.Group_conversation.findAll({
            where: {
                application: app,
                id: groupId
            },
            include: {
                model: db.Group_Member
            }           
        })

        

        let members = []        

        if(groupMembers && groupMembers.length>0) {
            members.push(groupMembers[0].owner)
            groupMembers[0].Group_Members.map( conversation => members.push(conversation.name))
        }

        if(members.indexOf('anurag') >= 0){
            return members
        }

        return false

    } catch(err){
        // Wip
        console.log(err)
    }
}

export async function getAllMembersWithRoles(app, user, groupId){
    try{
        let groupMembers = await db.Group_conversation.findAll({
            where: {
                application: app,
                id: groupId
            },
            include: {
                model: db.Group_Member
            }           
        })

        

        let members = []        

        if(groupMembers && groupMembers.length>0) {
            members.push({ name: groupMembers[0].owner, role: 'owner'})
            groupMembers[0].Group_Members.map( conversation => members.push({name: conversation.name, role: conversation.role}))

            let response = {
                groupId: groupId,
                name: groupMembers[0].dataValues.name,
                owner: groupMembers[0].dataValues.owner,
                created_at: groupMembers[0].dataValues.created_at,
                display_picture: groupMembers[0].dataValues.display_picture,
                members: members
            }
    
            return response
        }

        return false

    } catch(err){
        // Wip
        console.log(err)
    }
}

export async function getAllGroupDetails(app, user){
    try{
        let ownedGroup = await db.Group_conversation.findAll({
            where: {
                application: app,
                owner: user
            }            
        })

        let groupMap = new Map()    

        if(ownedGroup && ownedGroup.length>0) {
            ownedGroup.map( conversation => groupMap.set(conversation.dataValues.id, conversation))
        }

        let memeberGroup = await db.Group_conversation.findAll({
            where: {
                application: app
            }, 
            include: {
                model: db.Group_Member,
                where: {
                    name: user
                },
            }
        })

        if(memeberGroup && memeberGroup.length>0) {
            memeberGroup.map( conversation =>  groupMap.set(conversation.dataValues.id, conversation))
        }

        return groupMap

    } catch(err){
        // Wip
        console.log(err)
    }
}

// Delete group
export async function deleteGroup(app, user, data){
    try{

        let group = await db.Group_conversation.destroy({
            where: {
                id: data.id,
                application: app,
                owner: user
            }
        })

        if(group){
            await db.Group_Member.destroy({
                where: {
                    group_conversation_id: data.id
                }
            })
        }
           
        return group

    } catch(err){
        // Wip
        console.log(err)
    }
}

// Add Member to group
export async function addMemberToGroup(app, user, data){
    try{
        let group = await getGroupByOwnerOrAdmin(app, user, data.id)

        let members = []

        if(group.length){
            for(let index in data.members){
                members.push({
                    role: 'normal',
                    name: data.members[index].toLowerCase(),
                    group_conversation_id: data.id
                })
            }

            db.Group_Member.bulkCreate(members)

            return true
        }

        return false        

    } catch(err){
        if(err.name == 'SequelizeUniqueConstraintError'){
            return false
        }
        // Wip
        console.log(err)
    }
}

export async function editGroup(app, user, data){
    try{
        let group = await getGroupByOwnerOrAdmin(app, user, data.id)

        let member = ''

        if(group.length){
            member = await db.Group_conversation.update({
                name: data.name,
                display_picture: data.display_picture
              }, {
                where: {
                    group_conversation_id:  data.id
                }
            })

            return true
        }

        return false       

    } catch(err){
        if(err.name == 'SequelizeUniqueConstraintError'){
            return false
        }
        // Wip
        console.log(err)
    }
}

// Remove Member to group
export async function removeMemberFromGroup(app, user, data){
    try{
        let group = await getGroupByOwnerOrAdmin(app, user, data.id)

        let member = ''

        if(group){
            member = await db.Group_Member.destroy({
                where: {
                    name: data.memberName.toLowerCase(),
                    group_conversation_id: group[0].dataValues.id
                }
            })
        }

        return member

    } catch(err){
        // Wip
        console.log(err)
    }
}

// leaveGroup
export async function leaveGroup(app, user, data){
    try{
        
        let member = await db.Group_Member.destroy({
                where: {
                    name: user.toLowerCase(),
                    group_conversation_id: data.id
                }
            })

        return member

    } catch(err){
        // Wip
        console.log(err)
    }
}

// Remove Member to group
export async function changeMemberRole(app, user, data){
    try{
        let group = await getGroupByOwnerOrAdmin(app, user, data.id)

        let member = ''

        if(group){
                        
            member = await db.Group_Member.update({
                role: (data.role.toLowerCase() == 'admin')? 'admin' : 'normal'
              }, {
                where: {
                    name: data.memberName.toLowerCase(),
                    group_conversation_id: group[0].dataValues.id
                }
            })
        }

        return member

    } catch(err){
        // Wip
        console.log(err)
    }
}

async function getGroupByOwner(app, user, groupName){
    try{
        let group = await db.Group_conversation.findAll({
            where: {
                name: groupName,
                application: app,
                owner: user
            }
        })

        return group

    } catch(err){
        // Wip
        console.log(err)
    }
}

async function getGroupByOwnerOrAdmin(app, user, id){
    try{
        let group = await db.Group_conversation.findAll({
            where: {
                id: id,
                application: app,
                owner: user
            }
        })

        if(!group.length) {
            group = await db.Group_conversation.findAll({
                where: {
                    id: id,
                    application: app
                }, 
                include: {
                    model: db.Group_Member,
                    where: {
                        name: user,
                        role: 'admin'
                    },
                }
            })
        }

        return group

    } catch(err){
        // Wip
        console.log(err)
    }
}

async function getGroupMembers(app, groupName){
}

// get Group and Sort results
async function groupAndSortResults(user, conversationIds, peerConversationMap, groupConversationMap, latestMessagesPeerCoversation, latestMessagesGroupCoversation, pendingMessageCount) {
    let msgArray = []
    let latestMsg = new Map();
    let msg
    let messages = []

    conversationIds.forEach(element => {
        let tempConversation = (peerConversationMap.get(element)) ? peerConversationMap.get(element) : groupConversationMap.get(element)
        let latestMsg = (latestMessagesPeerCoversation.get(element)) ? latestMessagesPeerCoversation.get(element) : latestMessagesGroupCoversation.get(element)
        let pending  = pendingMessageCount.get(element)
        msg = {
            conversation_id: element,
            group: (tempConversation.user1)? false : true,
            groupName: (tempConversation.name)? tempConversation.name : 'N/A',
            user1: (tempConversation.user1)? tempConversation.user1 : 'N/A',
            user2: (tempConversation.user2)? tempConversation.user2 : 'N/A',
            sender: (latestMsg)? latestMsg.sender : '',
            data: (latestMsg)? latestMsg.data : '',
            type: (latestMsg)? latestMsg.type: '',
            peer_conversation_id: tempConversation.id,
            group_conversation_id: tempConversation.id,
            user1_conversation_archived: (tempConversation.user1_conversation_archived)? tempConversation.user1_conversation_archived : '',
            user2_conversation_archived: (tempConversation.user2_conversation_archived)? tempConversation.user2_conversation_archived : '',
            pendingCount: (pending) ? pending.pendingCount: 0,
            display_picture: (tempConversation.display_picture)? tempConversation.display_picture : '',
            created_at: (latestMsg)? latestMsg.created_at : (tempConversation.name)? tempConversation.created_at : '',
            updated_at: (latestMsg)? latestMsg.updated_at : (tempConversation.name)? tempConversation.updated_at : '',
            'Messages.created_at': (latestMsg)? latestMsg.created_at : (tempConversation.name)? tempConversation.created_at : '',
            'Messages.updated_at': (latestMsg)? latestMsg.updated_at : (tempConversation.name)? tempConversation.updated_at : '',
        }
        msgArray.push(msg)
    })

    // Get First message
    // for( let element in data){
    //     msg = data[element]
    //     msg.pendingCount = 0
    //     msg.sender = (msg.created_at)? msg.sender : (data[0].user1 == user)? msg.user2 : msg.user1 
    //     latestMsg.set(msg.id, msg)
    // }

    // // Add Pending count
    // let tempMsg
    // for( let element in pendingMessage){
    //     tempMsg =  latestMsg.get(pendingMessage[element].conversation_id)
    //     tempMsg.pendingCount = pendingMessage[element].pendingCount
    //     latestMsg.set(tempMsg.id, tempMsg)
    // }

    // msgArray = Array.from(latestMsg.values());
    return msgArray
}

async function getlatestMessagesForPeerConversation(ids){
    return new Promise((resolve, reject) => {
        db.sequelize.query("SELECT t1.* \
                FROM chatty.Messages t1 WHERE \
                    t1.id = (SELECT t2.id FROM chatty.Messages t2 \
                    WHERE t2.peer_conversation_id = t1.peer_conversation_id ORDER BY t2.updated_at DESC LIMIT 1) and \
                    t1.peer_conversation_id in (:conversation_ids)",
            { replacements: { conversation_ids: ids }, type: db.sequelize.QueryTypes.SELECT }
        ).then(messages => {
            let messagesMap = new Map()
            for(let element in messages){
                messagesMap.set(messages[element].peer_conversation_id, messages[element])
            }
            resolve(messagesMap)
        })
    });
}

async function getlatestMessagesForGroupConversation(ids){
    return new Promise((resolve, reject) => {
        db.sequelize.query("SELECT t1.* \
        FROM chatty.Messages t1 WHERE \
            t1.id = (SELECT t2.id FROM chatty.Messages t2 \
            WHERE t2.group_conversation_id = t1.group_conversation_id ORDER BY t2.updated_at DESC LIMIT 1) and \
            t1.group_conversation_id in (:conversation_ids)",
            { replacements: { conversation_ids: ids }, type: db.sequelize.QueryTypes.SELECT }
        ).then(messages => {
            let messagesMap = new Map()
            for(let element in messages){
                messagesMap.set(messages[element].group_conversation_id, messages[element])
            }
            resolve(messagesMap)
        })
    });
}

// Get conversation ID
async function getConversation (app, sender, recipient) {
    try{
        sender = sender.toLowerCase()
        recipient = recipient.toLowerCase()

        // Arranging users lexicographically
        let user1 = (recipient < sender) ? recipient : sender,
            user2 = (recipient > sender) ? recipient : sender

        let peerConversation =  await db.Peer_conversation.findOrCreate({
            where: {
                user1: user1,
                user2: user2,
                application: app
            }, 
            defaults: {
                encryption_key: Math.random().toString(36).replace('0.', ''),
                user1: user1,
                user2: user2,
                application: app,
                user1_conversation_blocked: false,
                user2_conversation_blocked: false,
                user1_conversation_archived: false,
                user2_conversation_archived: false
            }
        })

        if(peerConversation[0].dataValues.user1_conversation_archived || peerConversation[0].dataValues.user2_conversation_archived){
            let updateConversation =  await db.Peer_conversation.update({
                user1_conversation_archived: false,
                user2_conversation_archived: false
            },{
                    where: {
                        user1: user1,
                        user2: user2,
                        application: app
                    }
            })
        }
        
        return peerConversation[0].dataValues;
    } catch(err){
        console.log(err)
    }
    
}

// Get conversation ID
async function getConversationIds (app, user) {

    try{
        user = user.toLowerCase()

        let peerConversationIds =  await db.Peer_conversation.findAll({
            where: {
                [db.Sequelize.Op.or]: [{user1: user}, {user2: user}],
                application: app
            }
        })

        let ids = []
        if(peerConversationIds && peerConversationIds.length>0) {
            peerConversationIds.map( conversation => ids.push(conversation.dataValues.id))
        }

        return ids;
    } catch(err){

    }
    
}

async function getPendingMessageCount (app, user, conversationIds) {
    try{
       // check sender and recipient
       if(!user){
           return false;
       }

       let peerPendingMessages, groupPendingMessages
       user = user.toLowerCase()
       
        if(conversationIds && conversationIds.length > 0){
            // Fetching messages for the current user
            peerPendingMessages = await db.Message.findAll({
                where: {
                    peer_conversation_id: {
                        $in: conversationIds
                    }
                },
                include: [{
                    model: db.Pending,
                    where: {
                        recipient: user  
                    },
                }],
                attributes: { 
                    include: [[db.sequelize.fn("COUNT", db.sequelize.col("Pendings.id")), "pendingCount"]]
                },
                group: db.Sequelize.col('Message.peer_conversation_id'),
                raw: true
            })

            groupPendingMessages = await db.Message.findAll({
                where: {
                    group_conversation_id: {
                        $in: conversationIds
                    }
                },
                include: [{
                    model: db.Pending,
                    where: {
                        recipient: user  
                    },
                }],
                attributes: { 
                    include: [[db.sequelize.fn("COUNT", db.sequelize.col("Pendings.id")), "pendingCount"]]
                },
                group: db.Sequelize.col('Message.group_conversation_id'),
                raw: true
            })
        }
        let pendingMessagesMap = new Map()

        for(let element in peerPendingMessages){
            pendingMessagesMap.set(peerPendingMessages[element].peer_conversation_id, peerPendingMessages[element])
        }

        for(let element in groupPendingMessages){
            pendingMessagesMap.set(groupPendingMessages[element].group_conversation_id, groupPendingMessages[element])
        }

        return pendingMessagesMap
        
    } catch(err){
        console.log(err)
    }
}
