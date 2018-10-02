import Sequelize from 'sequelize'

/** * Request Schema */
module.exports = function(sequelize, DataTypes) {
    const groupConversation = sequelize.define('Group_conversation', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false
        },
        name: {
            type: Sequelize.STRING
        },
        encryption_key: {
            type: Sequelize.STRING
        },
        application: {
            type: Sequelize.STRING
        },
        owner: {
            type: Sequelize.STRING 
        }
    }, {
        indexes: [
          {
            unique: true,
            fields: ['name', 'application', 'owner']
          }
        ]
      }, {
        timestamps: true
    });

    groupConversation.sync({ force: false }).then(() => {
        // Table created       
        return true;
    });
    return groupConversation;
};