const { DataTypes } = require('sequelize');

const SENDER_ROLES = ['customer', 'driver', 'garage', 'admin'];

module.exports = (sequelize) => {
  const SupportMessage = sequelize.define(
    'SupportMessage',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      ticket_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      sender_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      sender_role: { type: DataTypes.ENUM(...SENDER_ROLES), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      attachments: { type: DataTypes.JSON, allowNull: true },
      internal_note: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName: 'support_messages',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  SupportMessage.SENDER_ROLES = SENDER_ROLES;
  return SupportMessage;
};
