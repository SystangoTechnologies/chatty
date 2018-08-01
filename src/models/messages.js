import Sequelize from 'sequelize'

/** * Request Schema */
module.exports = function(sequelize, DataTypes) {
    const messages = sequelize.define('Message', {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        message: {
            type: Sequelize.STRING
        },
        from: {
            type: Sequelize.STRING
        },
        url: {
            type: Sequelize.STRING
        },
        status: {
            type: Sequelize.INTEGER
        },
        peer_conversation_id: // name of the key we're adding
        {
            type: Sequelize.INTEGER
        }
    }, {
        timestamps: true
    });

    messages.associate = function(models) {
        //messages.belongsTo(models.Peer_conversation, { as: "Peer_conversation", foreignKey: 'peer_conversation_id', targetKey: 'id', onDelete: "CASCADE" });
        messages.hasMany(models.Pending, { as: 'Pending_Messages'});
        messages.hasMany(models.Delivered), { as: 'Delivered_Messages'};
    };
      
    messages.sync({ force: false }).then(() => {
        // Table created       
        return true;
    });
    return messages;
};