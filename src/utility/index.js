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
                    recipient: user  
                },
            }],
            attributes: {
                include: [ 'message']
            },
            order: db.Sequelize.col('Messages.created_at'),
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
            // limit: data.messageCount,
            raw: true
         })
 
         return peerConversation
         
     } catch(err){
         console.log(err)
     }
}

export async function deleteAndChangeStatus (user) {
    try {
        let pendingMsg = await db.Pending.findAll({
            where: {
                recipient: user
            },
        })
    } catch (err) {
        // WIP
    }
}

export async function getinboxMessages (user) {
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
                [db.Sequelize.Op.or]: [{user1: user}, {user2: user}]
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
            order: [[db.Sequelize.col('Messages.created_at'), 'DESC']],
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

// get only 
async function getFirstMsg(data) {
    let latestMsg = []
    for( let element in data){
        if( latestMsg.length === 0 ){
            latestMsg.push(data[element])
        } else {
            if(latestMsg[latestMsg.length -1].id !== data[element].id){
                latestMsg.push(data[element])
            }
        }
    }
    return latestMsg
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