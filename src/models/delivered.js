import Sequelize from 'sequelize'

/** * Request Schema */
module.exports = function(sequelize, DataTypes) {
    const delivered = sequelize.define('Delivered', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false
        },
        recipient: {
            type: Sequelize.STRING
        },
        sender: {
            type: Sequelize.STRING
        },
        message_id: {
            type: DataTypes.UUID
        }
    }, {
        timestamps: true,
        freezeTableName: true
    });
      
    delivered.sync({ force: false }).then(() => {
        // Table created       
        return true;
    });
    return delivered;
};