import db from './../models/index'

// Persisting one to one messages
export async function persistOneToOneMsg (message) {
    try{
        // check sender and recipient
        if(!message.recipient || !message.sender){
            return true;
        } 

        // Getting the conversation Id 
        let conversation = await getConversation(message)
    
        let msg = await db.Message.create({
            message: message.message,
            sender: message.sender,
            url: '',
            status: 0,
            peer_conversation_id: conversation.id
        })

        // Storing messages reference in Pending Table
        let pendingMsg = await db.Pending.create({
            recipient: message.recipient,
            message_id: msg.dataValues.id
        })

    } catch(err){
        console.log(err)
    }
}

export async function getMessages (user) {
    try{
       // check sender and recipient
       if(!user){
           return false;
       } 

        // Fetching messages for the current user
        let msgs = await db.Message.findAll({
            include: [{
                model: db.Pending,
                where: {
                    recipient: user
                }
            }],
            attributes: {
                include: [ 'message'],
                exclude: ['peer__conversation_id']
            },
            raw: true
        })

        return msgs
        
    } catch(err){
        console.log(err)
    }
}

// Get conversation ID
async function getConversation (message) {
    try{
        let user1 = (message.recipient < message.sender) ? message.recipient : message.sender,
            user2 = (message.recipient > message.sender) ? message.recipient : message.sender

        let peerConversation =  await db.Peer_Conversation.findOrCreate({
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