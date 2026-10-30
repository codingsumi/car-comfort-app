const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Review = sequelize.define(
    'Review',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      booking_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      reviewer_user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      reviewee_user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      reviewer_role: {
        type: DataTypes.ENUM('customer', 'driver'),
        allowNull: false
      },
      reviewee_role: {
        type: DataTypes.ENUM('customer', 'driver'),
        allowNull: false
      },
      rating: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      is_satisfied: {
        type: DataTypes.BOOLEAN,
        allowNull: true
      },
      moderation_status: {
        type: DataTypes.ENUM('pending', 'approved', 'hidden', 'removed', 'flagged'),
        allowNull: false,
        defaultValue: 'pending',
      },
      moderated_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      moderation_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      moderated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      original_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      moderation_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      flags_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      auto_flag_reasons: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      last_auto_scan_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      admin_response: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      admin_responded_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      admin_responder_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
    },
    {
      tableName: 'reviews',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );

  return Review;
};

