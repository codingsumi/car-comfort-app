'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `INSERT INTO vehicle_types (name, status) VALUES ('Other', 'active')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('vehicle_types', { name: 'Other' });
  },
};
