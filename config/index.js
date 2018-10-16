'use strict'

var init = function () {
  if (process.env.NODE_ENV === 'production') {
    console.log('Production ENVs')
    return {
      db: {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        name: process.env.DB_NAME,
        dialect: process.env.DB_DIALECT
      },
      redis: {
        port: process.env.REDIS_PORT,
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASSWORD
      },
      sessionSecret: process.env.SESSION_SECRET,
      echoSentMessage: process.env.ECHO_SENT_MESSAGE,
      noOfRecordsPerPage: process.env.NO_OF_RECORDS_PER_PAGE,
      socketHandshakeToken: process.env.SOCKET_HANDSHAKE_TOKEN,
      serverName: process.env.SERVER_NAME      
    }
  } else {
    return require('./config.json')
  }
}

module.exports = init()
