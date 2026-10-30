'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('notification_delivery_logs');
    if (!table.onesignal_notification_id) {
      await queryInterface.addColumn('notification_delivery_logs', 'onesignal_notification_id', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
      await queryInterface.addIndex('notification_delivery_logs', ['onesignal_notification_id'], {
        name: 'idx_notification_delivery_logs_onesignal_notification',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'notification_delivery_logs',
      'idx_notification_delivery_logs_onesignal_notification'
    );
    await queryInterface.removeColumn('notification_delivery_logs', 'onesignal_notification_id');
  },
};
