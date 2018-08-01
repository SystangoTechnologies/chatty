import Sequelize from 'sequelize'

/** * Request Schema */
module.exports = function(sequelize, DataTypes) {
    const pending = sequelize.define('Pending', {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        message: {
            type: Sequelize.STRING
        },
        to: {
            type: Sequelize.STRING
        },
        message_id: // name of the key we're adding
        {
            type: Sequelize.INTEGER
        }
    }, {
        timestamps: true,
        freezeTableName: true
    });

    // pending.associate = function(models) {
    //     pending.belongsTo(models.Message, {  as: "Pending_Messages", foreignKey: 'message_id', targetKey: 'id', onDelete: "CASCADE" });
    // };
      
    pending.sync({ force: false }).then(() => {
        // Table created       
        return true;
    });
    return pending;
};