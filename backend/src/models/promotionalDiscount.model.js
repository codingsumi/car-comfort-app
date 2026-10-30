'use strict';

const { DataTypes } = require('sequelize');

const STATUSES = ['active', 'inactive', 'scheduled', 'expired'];
const DISCOUNT_TYPES = ['percentage', 'flat'];
const AUDIENCE_TYPES = ['all', 'new_customers'];
const RECURRENCE_TYPES = ['one_time', 'weekly', 'monthly'];

module.exports = (sequelize) => {
  const PromotionalDiscount = sequelize.define(
    'PromotionalDiscount',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      discount_type: {
        type: DataTypes.ENUM(...DISCOUNT_TYPES),
        allowNull: false,
        defaultValue: 'percentage',
      },
      discount_value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      applicable_services: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      audience: {
        type: DataTypes.ENUM(...AUDIENCE_TYPES),
        allowNull: false,
        defaultValue: 'all',
      },
      recurrence: {
        type: DataTypes.ENUM(...RECURRENCE_TYPES),
        allowNull: false,
        defaultValue: 'one_time',
      },
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(...STATUSES),
        allowNull: false,
        defaultValue: 'inactive',
      },
      max_uses: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      uses_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      created_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      notify_customers: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      notified_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'promotional_discounts',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return PromotionalDiscount;
};
