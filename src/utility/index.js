import db from './../models/index'
import config from "./../config";

// Persisting one to one messages
export async function persistOneToOneMsg (app, sender, recipient, data) {
    try{

        // Getting the conversation Id 
        let conversation = await getConversation(app, sender, recipient)
    
        let msg = await db.Message.create({
            data: data,
            sender: sender,
            url: '',
            status: 0,
            peer_conversation_id: conversation.id
        })

        // Storing messages reference in Pending Table
        let pendingMsg = await db.Pending.create({
            recipient: recipient,
            message_id: msg.dataValues.id
        })

        return msg

    } catch(err){
        console.log(err)
    }
}

// Message sent by servers
export async function sendAndPersistMsg(sender, peer, recipient, data) {
    try{

        // Getting the conversation Id 
        let conversation = await getConversation(peer, recipient)
    
        let msg = await db.Message.create({
            data: data,
            sender: sender,
            url: '',
            status: 0,
            peer_conversation_id: conversation.id
        })

        // Storing messages reference in Pending Table
        let pendingMsg = await db.Pending.create({
            recipient: recipient,
            message_id: msg.dataValues.id
        })

    } catch(err){
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
                        recipient: user  
                    },
                }],
                order: [['created_at', 'DESC']],
                raw: true
            })
        }
        return msgs
        
    } catch(err){
        console.log(err)
    }
}

export async function getChatHistory(app, data, currentUser) {
    try{
        // Arranging users lexicographically
        let user1 = (data.peer < currentUser) ? data.peer : currentUser,
        user2 = (data.peer > currentUser) ? data.peer : currentUser


        let limit = (data.noOfRecordsPerPage)? data.noOfRecordsPerPage : 100 // number of records per page
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
                 duplicating: false
             }],
             attributes: {
                include: [[db.Sequelize.col('Messages.data'), 'data'],
                   [db.Sequelize.col('Messages.sender'), 'sender'],
                   [db.Sequelize.col('Messages.created_at'), 'created_at']
                ]
            },
            order: [[db.Sequelize.col('Messages.created_at'), 'DESC']],
            limit: limit,
            offset: offset,
            raw: true
         })
         
         peerConversation = peerConversation.reverse();
 
         return peerConversation
         
     } catch(err){
         console.log(err)
     }
}

export async function deleteAndChangeStatus (app, user) {
    try {
        // Get all the IDs wrt to user and application
       let pendingMessages = await getPendingMessages(app, user)



        // let pendingMessages = await db.Pending.findAll({
        //     where: {
        //         recipient: user
        //     },
        //     attributes: ['message_id']
        // })

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
            })

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

export async function getinboxMessages (app, user) {
    try {
        // let peerConversation =  await db.Peer_conversation.findAll({
        //     where: {
        //         [db.Sequelize.Op.or]: [{user1: user}, {user2: user}]
        //     },
        //     include: [{
        //         model: db.Message,
        //         // order: db.Sequelize.col('Messages.created_at desc')
        //         order: [[{model: db.Message}, 'created_at']]
        //     }],
           
        //     group: db.Sequelize.col('Peer_conversation.id'),
        //     raw: true
        // })
        attributes: []

        let peerConversation =  await db.Peer_conversation.findAll({
            where: {
                [db.Sequelize.Op.or]: [{user1: user}, {user2: user}],
                application: app
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
        let result = await getFirstMsg(peerConversation)
        return result
    } catch(err){
        console.log('err', err)
    }
   
}

export async function deleteMessages(user, message){
    db.Message.destroy({
        where:{ 
            sender: user,
            id: message.messageId
        }
    })
}

// get only 
async function getFirstMsg(data) {
    let msg = []
    let latestMsg = new Map();
    for( let element in data){
        latestMsg.set(data[element].id, data[element])
    }
    msg = Array.from(latestMsg.values());
    return msg
}

// Get conversation ID
async function getConversation (app, sender, recipient) {
    try{
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
                application: app
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