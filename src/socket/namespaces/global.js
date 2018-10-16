import * as utility from './../../utility/index'
import config from "./../../../config";


/**
 * Initialize Global namespace
 *
 */
var init = function (io) {
    io.of('/').on('connection', function(socket) {
    
        let app = (socket.handshake.query.application)? socket.handshake.query.application : 'default'
    
        if (socket.handshake.query.token !== config.socketHandshakeToken ){
          return
        }
    
        /*  Send Message to clinets
            data = {
                receipent = 'xyz',
                peer = 'abc',
                data = 'msg',
                type = 'text',
                sender = 'server'
            }
        */
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
}
   
module.exports = init