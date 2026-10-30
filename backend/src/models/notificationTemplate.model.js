const { DataTypes } = require('sequelize');

const TEMPLATE_TYPES = [
  'booking',
  'promotional',
  'payment',
  'refund',
  'provider',
  'support',
];

module.exports = (sequelize) => {
  const NotificationTemplate = sequelize.define(
    'NotificationTemplate',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      template_name: { type: DataTypes.STRING(120), allowNull: false },
      template_type: {
        type: DataTypes.STRING(32),
        allowNull: false,
        validate: { isIn: [TEMPLATE_TYPES] },
      },
      title_template: { type: DataTypes.STRING(255), allowNull: false },
      body_template: { type: DataTypes.TEXT, allowNull: false },
      variables: { type: DataTypes.JSON, allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    },
    {
      tableName: 'notification_templates',
      underscored: true,
    }
  );

  NotificationTemplate.TEMPLATE_TYPES = TEMPLATE_TYPES;
  return NotificationTemplate;
};
