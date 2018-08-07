import Sequelize from 'sequelize'

/** * Request Schema */
module.exports = function(sequelize, DataTypes) {
    const messages = sequelize.define('Message', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false
        },
        message: {
            type: Sequelize.STRING
        },
        sender: {
            type: Sequelize.STRING
        },
        url: {
            type: Sequelize.STRING
        },
        status: {
            type: Sequelize.INTEGER
        },
        peer_conversation_id: {
            type: DataTypes.UUID
        }
    }, {
        timestamps: true,
        underscored: true
    });

    messages.sync({ force: false }).then(() => {
        // Table created       
        return true;
    });
    return messages;
};