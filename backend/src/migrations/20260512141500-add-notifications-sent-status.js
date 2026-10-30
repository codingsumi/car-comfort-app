'use strict';

/** Track outbound push outcome on inbox rows (notifications table). */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    if (!tables.includes('notifications')) return;

    const desc = await queryInterface.describeTable('notifications');
    if (!desc.sent_status) {
      await queryInterface.addColumn('notifications', 'sent_status', {
        type: Sequelize.STRING(32),
        allowNull: true
      });
    }
    if (!desc.push_result) {
      await queryInterface.addColumn('notifications', 'push_result', {
        type: Sequelize.JSON,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    if (!tables.includes('notifications')) return;

    const desc = await queryInterface.describeTable('notifications').catch(() => ({}));
    if (desc.push_result) await queryInterface.removeColumn('notifications', 'push_result').catch(() => {});
    if (desc.sent_status) await queryInterface.removeColumn('notifications', 'sent_status').catch(() => {});
  }
};
