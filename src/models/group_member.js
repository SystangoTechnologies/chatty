import Sequelize from 'sequelize'

/** * Request Schema */
module.exports = function(sequelize, DataTypes) {
    const groupMember = sequelize.define('Group_Member', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false
        },
        name: {
            type: Sequelize.STRING
        },
        role: {
            type: Sequelize.STRING 
        },
        group_conversation_id: {
            type: DataTypes.UUID
        }
    }, {
        indexes: [
          {
            unique: true,
            fields: ['name', 'group_conversation_id']
          }
        ]
      }, {
        timestamps: true
    });

    groupMember.sync({ force: false }).then(() => {
        // Table created       
        return true;
    });
    return groupMember;
};