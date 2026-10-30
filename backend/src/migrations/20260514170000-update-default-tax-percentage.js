'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE app_settings SET value = '8' WHERE \`key\` = 'default_tax_percentage' AND value = '0'`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE app_settings SET value = '0' WHERE \`key\` = 'default_tax_percentage' AND value = '8'`
    );
  },
};
