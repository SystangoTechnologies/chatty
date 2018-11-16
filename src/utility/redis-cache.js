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

// Update client in the redis map
export function updateClientStatus (_app, _user, userData) {  
    redisClient.hmset('OnlineUsers' + '_' + _app, _user.toLowerCase(), JSON.stringify(userData))
}

// Removes client from the redis map
export function removeClient (_app, _user) {  
    redisClient.hdel('OnlineUsers' + '_' + _app, _user.toLowerCase())
}

// Update group in the redis map
export function updateGroup (_app, _id, members) {  
    redisClient.hmset('Groups' + '_' + _app, _id, members)
}

// Delete group in the redis map
export function deleteGroup (_app, _id) {  
    redisClient.hdel('Groups' + '_' + _app, _id)
}

// Update group members from in the redis map
export function getGroupMembers (_app, _id) {  
    return new Promise((resolve, reject) => {
        redisClient.hget('Groups' + '_' + _app, _id.toLowerCase(), function (_err, obj) {
            if(_err){
                reject('')
            }
            if(obj){
                resolve(obj.split(','))
            }
        })
    });
}

// Gets the server's name of client
export async function getUsersDetails (_app, _users) {
    let users = []
    for(let element in _users){
        let userDetails =  await fetchUserDetails(_app, _users[element])
        users.push(userDetails)
    }
    return users
}

// Gets the server's name of client
export function fetchUserDetails (_app, _user) {  
    return new Promise((resolve, reject) => {
        redisClient.hget('OnlineUsers' + '_' + _app, _user.toLowerCase(), function (_err, obj) {
            if(_err){
                reject('')
            }
            resolve(JSON.parse(obj))
        })
    });
}


export async function init(_redis) {
    console.log('Init')
    redisClient = _redis
}