import db from './../models/index'

// Persisting one to one messages
export async function persistOneToOneMsg (sender, recipient, message) {
    try{

        // Getting the conversation Id 
        let conversation = await getConversation(sender, recipient)
    
        let msg = await db.Message.create({
            message: message,
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

export async function getPendingMessages (user) {
    try{
       // check sender and recipient
       if(!user){
           return false;
       }
 
        // // Fetching messages for the current user
        let msgs = await db.Message.findAll({
            include: [{
                model: db.Pending,
                where: {
                    recipient: user,   
                },
            }],
            attributes: {
                include: [ 'message']
            },
            raw: true
        })

        return msgs
        
    } catch(err){
        console.log(err)
    }
}

export async function getChatHistory(data, currentUser) {
    try{
        // Arranging users lexicographically
        let user1 = (data.peer < currentUser) ? data.peer : currentUser,
        user2 = (data.peer > currentUser) ? data.peer : currentUser
 
        let peerConversation =  await db.Peer_conversation.findAll({
            where: {
                user1: user1,
                user2: user2
            },
             include: [{
                 model: db.Message
             }],
             attributes: {
                  include: [[db.Sequelize.col('Messages.message'), 'message'],
                   [db.Sequelize.col('Messages.sender'), 'sender'],
                   [db.Sequelize.col('Messages.created_at'), 'created_at']
                 ] 
            },
             order: db.Sequelize.col('Messages.created_at'),
            // limit: 1,
            raw: true
         })
 
         return peerConversation
         
     } catch(err){
         console.log(err)
     }
}

async function deleteAndChangeStatus (user) {
    try {
        let pendingMsg = await db.Pending.findAll({
            where: {
                recipient: user,   
            },
        })
    } catch (err) {
        // WIP
    }
}

// Get conversation ID
async function getConversation (sender, recipient) {
    try{
        // Arranging users lexicographically
        let user1 = (recipient < sender) ? recipient : sender,
            user2 = (recipient > sender) ? recipient : sender

        let peerConversation =  await db.Peer_conversation.findOrCreate({
            where: {
                user1: user1,
                user2: user2
            }, 
            defaults: {
                encryption_key: Math.random().toString(36).replace('0.', ''),
                user1: user1,
                user2: user2
            }
        })
        
        return peerConversation[0].dataValues;
    } catch(err){

    }
    
}