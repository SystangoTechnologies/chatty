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
             include: [{
                 model: db.Message,
                 where: {
                    created_at: {
                        $ne: null 
                    }                    
                 },
                 duplicating: false
             }],
             attributes: {
                include: [[db.Sequelize.col('Messages.data'), 'data'],
                   [db.Sequelize.col('Messages.sender'), 'sender'],
                   [db.Sequelize.col('Messages.created_at'), 'created_at'],
                   [db.Sequelize.col('Messages.clientGeneratedId'), 'clientGeneratedId']
                ]
            },
            order: [[db.Sequelize.col('Messages.created_at'), 'DESC']],
            limit: limit,
            offset: offset,
            raw: true
         })

         let historyMessages

         if(peerConversation.length){
            historyMessages = {
                state: (!peerConversation[0].blocked)? 'active' : 'blocked',
                blockedBy: (user1 == peerConversation[0].blocked)? user2 : user1,
                currentPage: page,
                messages: peerConversation.reverse()
             }
         }
         
         return historyMessages
         
     } catch(err){
         console.log(err)
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

        // let peerConversation =  await db.Peer_conversation.findAll({
        //     where: {
        //         [db.Sequelize.Op.or]: [{user1: user}, {user2: user}],
        //         application: app
        //     },
        //     include: [{
        //         model: db.Message,
        //         duplicating: false,
        //         order: [[db.Sequelize.col('Messages.created_at'), 'DESC']],
        //     }],
        //     attributes: {
        //         include: [[db.Sequelize.col('Messages.data'), 'data'],
        //         [db.Sequelize.col('Messages.sender'), 'sender'],
        //         [db.Sequelize.col('Messages.created_at'), 'created_at']
        //     ]},
        //     limit: limit,
        //     offset: offset,
        //     group: db.Sequelize.col('Peer_conversation.id'),
        //     raw: true
        // })
        
       
        let peerConversation =  await db.Peer_conversation.findAll({
            where: {
                [db.Sequelize.Op.or]: [{user1: user}, {user2: user}],
                application: app,
                archivedBy: {
                    [Op.ne]: user
                }
            },
            include: [{
                model: db.Message
            }],
            attributes: {
                include: [[db.Sequelize.col('Messages.data'), 'data'],
                 [db.Sequelize.col('Messages.sender'), 'sender'],
                 [db.Sequelize.col('Messages.created_at'), 'created_at']
               ] 
            },
            order: [[db.Sequelize.col('Messages.created_at')]],
            // WIP
            // group by working but giving the oldest msg rather than the newest message
            // group: db.Sequelize.col('Peer_conversation.id'),
            raw: true
        })

       
        var conversationIds = new Set();

        if(peerConversation && peerConversation.length>0) {
            peerConversation.map( conversation => conversationIds.add(conversation.id))
        }

        let pendingMessage = await getPendingMessageCount (app, user, [... conversationIds])

        let result = await getFirstMsg(user, peerConversation, pendingMessage)

        result.sort(function(a, b){
            if(a['Messages.created_at']  > b['Messages.created_at']){
                return -1
            } else {
                return 1
            }
        })

        return result.slice(offset, limit * page)

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

        let peerConversation =  await db.Peer_conversation.update({
                blocked: data.user
            },{
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

        let unblockAllowed =  await db.Peer_conversation.findAll({
            where: {
                user1: user1,
                user2: user2,
                application: app,
                blocked: data.user
            }
        })

        // Not allowed
        if(!unblockAllowed.length){
            return false
        }

        let peerConversation =  await db.Peer_conversation.update({
                blocked: ''
            },{
                where: {
                    user1: user1,
                    user2: user2,
                    application: app,
                    blocked: data.user
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

        let peerConversation =  await db.Peer_conversation.update({
                archivedBy: user
            },{
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
            peer_conversation_id: conversation.id
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
        let pendingMsg = await db.Group_conversation.create({
            name: data.name.toLowerCase(),
            encryption_key: Math.random().toString(36).replace('0.', ''),
            application: app,
            owner: user
        })
    } catch(err){
        // Wip
        console.log(err)
    }
}

// get only latest message
async function getFirstMsg(user, data, pendingMessage) {
    let msgArray = []
    let latestMsg = new Map();
    let msg

    // Get First message
    for( let element in data){
        msg = data[element]
        msg.pendingCount = 0
        msg.sender = (msg.created_at)? msg.sender : (data[0].user1 == user)? msg.user2 : msg.user1 
        latestMsg.set(msg.id, msg)
    }

    // Add Pending count
    let tempMsg
    for( let element in pendingMessage){
        tempMsg =  latestMsg.get(pendingMessage[element].peer_conversation_id)
        tempMsg.pendingCount = pendingMessage[element].pendingCount
        latestMsg.set(tempMsg.id, tempMsg)
    }

    msgArray = Array.from(latestMsg.values());
    return msgArray
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
                archivedBy: ''
            }
        })
        
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

       let msgs
       user = user.toLowerCase()
       
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
                        recipient: user  
                    },
                }],
                attributes: { 
                    include: [[db.sequelize.fn("COUNT", db.sequelize.col("Pendings.id")), "pendingCount"]] 
                },
                group: db.Sequelize.col('Message.peer_conversation_id'),
                raw: true
            })
        }
        return msgs
        
    } catch(err){
        console.log(err)
    }
}
