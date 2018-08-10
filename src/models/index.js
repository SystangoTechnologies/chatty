const fs = require('fs')
const path = require('path')
const Sequelize = require('sequelize')
const config = require('./../config')

var sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: config.db.dialect,
  // logging: false,
  define: {
    underscored: true
  },
  pool: {
    max: 5,
    min: 0,
    idle: 10000
  }
})


sequelize
    .authenticate()
    .then(() => {
      console.log('Connection has been established successfully.')
    })
    .catch(err => {
      console.error('Unable to connect to the database:', err)
    })

var db = {}


db.Sequelize = Sequelize;
db.sequelize = sequelize;

//Models/tables
db.Peer_conversation = require('./peer_conversations.js')(sequelize, Sequelize);
db.Message = require('./messages.js')(sequelize, Sequelize);
db.Pending = require('./pending.js')(sequelize, Sequelize);
db.Delivered = require('./delivered.js')(sequelize, Sequelize);


//Relations
db.Peer_conversation.hasMany(db.Message);
db.Message.belongsTo(db.Peer_conversation);

db.Message.hasMany(db.Pending);
db.Pending.belongsTo(db.Message);

db.Message.hasMany(db.Delivered);
db.Delivered.belongsTo(db.Message);


module.exports = db
