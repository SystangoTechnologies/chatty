import Sequelize from 'sequelize'

/** * Request Schema */
module.exports = function(sequelize, DataTypes) {
    const peerConversation = sequelize.define('Peer_conversation', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false
        },
        user1: {
            type: Sequelize.STRING
        },
        user2: {
            type: Sequelize.STRING
        },
        encryption_key: {
            type: Sequelize.STRING
        },
        application: {
            type: Sequelize.STRING
        },
        blocked: {
            type: Sequelize.STRING
        },
    }, {
        indexes: [
          {
            unique: true,
            fields: ['user1', 'user2', 'application']
          }
        ]
      }, {
        timestamps: true
    });

    peerConversation.sync({ force: false }).then(() => {
        // Table created       
        return true;
    });
    return peerConversation;
};