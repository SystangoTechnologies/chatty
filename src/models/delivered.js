import Sequelize from 'sequelize'

/** * Request Schema */
module.exports = function(sequelize, DataTypes) {
    const delivered = sequelize.define('Delivered', {
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
        message_id: // name of the key we're adding
        {
            type: Sequelize.INTEGER
        }
    }, {
        timestamps: true,
        freezeTableName: true
    });

    // delivered.associate = function(models) {
    //     delivered.belongsTo(models.Message, {  as: "Delivered_Messages", foreignKey: 'message_id', targetKey: 'id', onDelete: "CASCADE" });
    // };
      
    delivered.sync({ force: false }).then(() => {
        // Table created       
        return true;
    });
    return delivered;
};