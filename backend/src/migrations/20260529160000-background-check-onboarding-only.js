'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE legal_pages
       SET requires_agreement = 0,
           updated_at = NOW()
       WHERE audience = 'provider' AND slug = 'background-check-authorization'`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE legal_pages
       SET requires_agreement = 1,
           updated_at = NOW()
       WHERE audience = 'provider' AND slug = 'background-check-authorization'`
    );
  }
};
