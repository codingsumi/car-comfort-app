'use strict';

/**
 * One user → at most one user_devices row (current OneSignal subscription for that account).
 * Drops global unique on onesignal_id; adds unique on user_id.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('user_devices').catch(() => null);
    if (!desc) return;

    await queryInterface.removeConstraint('user_devices', 'uq_user_devices_onesignal_id').catch(() => {});

    await queryInterface.sequelize.query(`
      DELETE ud FROM user_devices ud
      INNER JOIN user_devices keep
        ON keep.user_id = ud.user_id AND keep.id > ud.id
    `);

    await queryInterface.addConstraint('user_devices', {
      fields: ['user_id'],
      type: 'unique',
      name: 'uq_user_devices_user_id'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('user_devices', 'uq_user_devices_user_id').catch(() => {});
    await queryInterface.addConstraint('user_devices', {
      fields: ['onesignal_id'],
      type: 'unique',
      name: 'uq_user_devices_onesignal_id'
    }).catch(() => {});
  }
};
