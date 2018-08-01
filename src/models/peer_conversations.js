import Sequelize from 'sequelize'

/** * Request Schema */
module.exports = function(sequelize, DataTypes) {
    const peerConversation = sequelize.define('Peer_conversation', {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        user1: {
            type: Sequelize.STRING
        },
        user2: {
            type: Sequelize.STRING
        },
        encryption_key: {
            type: Sequelize.STRING
        }
    }, {
        timestamps: true
    });

    peerConversation.associate = function(models) {
        peerConversation.hasMany(models.Message, {as: 'Messages'});  
    };

    peerConversation.sync({ force: false }).then(() => {
        // Table created       
        return true;
    });
    return peerConversation;
};