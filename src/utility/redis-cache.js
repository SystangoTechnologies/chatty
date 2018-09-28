/* Utility File for redis cache */

let redisClient

// Gets the server's name of client
export function getServerName (_app, _user) {  
    return new Promise((resolve, reject) => {
        redisClient.hget('OnlineUsers' + '_' + _app, _user.toLowerCase(), function (_err, obj) {
            if(_err){
                reject('')
            }
            if(obj){
                resolve(JSON.parse(obj).serverName)
            }
        })
    });
}

// Add client in the redis map
export function addClient (_app, _user, userData) {  
    redisClient.hmset('OnlineUsers' + '_' + _app, _user.toLowerCase(), JSON.stringify(userData))
}

// Removes client from the redis map
export function removeClient (_app, _user) {  
    redisClient.hdel('OnlineUsers' + '_' + _app, _user.toLowerCase())
}

export async function init(_redis) {
    console.log('Init')
    redisClient = _redis
}