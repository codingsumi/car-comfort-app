'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());

    if (!tables.includes('user_devices')) {
      await queryInterface.createTable('user_devices', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        onesignal_id: { type: Sequelize.STRING(128), allowNull: false },
        platform: { type: Sequelize.STRING(16), allowNull: false },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      });
      await queryInterface.addConstraint('user_devices', {
        fields: ['onesignal_id'],
        type: 'unique',
        name: 'uq_user_devices_onesignal_id'
      });
      await queryInterface.addIndex('user_devices', ['user_id'], { name: 'idx_user_devices_user_id' });
      await queryInterface.addIndex('user_devices', ['user_id', 'is_active'], { name: 'idx_user_devices_user_active' });
    }

    if (!tables.includes('notifications')) {
      await queryInterface.createTable('notifications', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        booking_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'bookings', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        type: { type: Sequelize.STRING(64), allowNull: false },
        title: { type: Sequelize.STRING(255), allowNull: false },
        message: { type: Sequelize.TEXT, allowNull: false },
        data: { type: Sequelize.JSON, allowNull: true },
        is_read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        delivery_key: { type: Sequelize.STRING(190), allowNull: false },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      });
      await queryInterface.addConstraint('notifications', {
        fields: ['delivery_key'],
        type: 'unique',
        name: 'uq_notifications_delivery_key'
      });
      await queryInterface.addIndex('notifications', ['user_id', 'created_at'], { name: 'idx_notifications_user_created' });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications').catch(() => {});
    await queryInterface.dropTable('user_devices').catch(() => {});
  }
};
