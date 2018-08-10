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

export async function getMessages (user) {
    try{
       // check sender and recipient
       if(!user){
           return false;
       }

       let peerConversation =  await db.Peer_conversation.findAll({
            where: {
                [db.Sequelize.Op.or]: [{user1: user}, {user2: user}]
            },
            include: [{
                model: db.Message
            }],
            raw: true
        })

   
        // // Fetching messages for the current user
        // let msgs = await db.Message.findAll({
        //     include: [{
        //         model: db.Pending,
        //         where: {
        //             recipient: user,   
        //         },
        //     }],
        //     attributes: {
        //         include: [ 'message']
        //     },
        //     raw: true
        // })

        return peerConversation
        
    } catch(err){
        console.log(err)
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

        console.log("peerConversation[0].dataValues ------> ", peerConversation[0].dataValues)
        
        return peerConversation[0].dataValues;
    } catch(err){

    }
    
}