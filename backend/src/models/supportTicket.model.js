const { DataTypes } = require('sequelize');

const USER_TYPES = ['customer', 'driver', 'garage', 'admin'];
const STATUSES = [
  'open',
  'pending',
  'in_progress',
  'waiting_for_user',
  'escalated',
  'resolved',
  'closed',
];
const PRIORITIES = ['low', 'medium', 'high', 'urgent', 'critical'];
const CATEGORIES = [
  'booking_issue',
  'payment_issue',
  'refund_issue',
  'provider_complaint',
  'customer_complaint',
  'app_issue',
  'technical_issue',
  'account_issue',
  'general',
];

module.exports = (sequelize) => {
  const SupportTicket = sequelize.define(
    'SupportTicket',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      ticket_number: { type: DataTypes.STRING(32), allowNull: false, unique: true },
      user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      user_type: { type: DataTypes.ENUM(...USER_TYPES), allowNull: false },
      subject: { type: DataTypes.STRING(255), allowNull: false },
      category: {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: 'general',
      },
      linked_booking_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      escalated_at: { type: DataTypes.DATE, allowNull: true },
      status: {
        type: DataTypes.ENUM(...STATUSES),
        allowNull: false,
        defaultValue: 'open',
      },
      priority: {
        type: DataTypes.ENUM(...PRIORITIES),
        allowNull: false,
        defaultValue: 'medium',
      },
      assigned_to: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      last_message_preview: { type: DataTypes.STRING(512), allowNull: true },
      last_message_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'support_tickets',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  SupportTicket.USER_TYPES = USER_TYPES;
  SupportTicket.STATUSES = STATUSES;
  SupportTicket.PRIORITIES = PRIORITIES;
  SupportTicket.CATEGORIES = CATEGORIES;

  return SupportTicket;
};
