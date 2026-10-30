'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reviews', 'admin_response', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'moderation_notes',
    });

    await queryInterface.addColumn('reviews', 'admin_responded_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'admin_response',
    });

    await queryInterface.addColumn('reviews', 'admin_responder_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      after: 'admin_responded_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('reviews', 'admin_responder_id');
    await queryInterface.removeColumn('reviews', 'admin_responded_at');
    await queryInterface.removeColumn('reviews', 'admin_response');
  },
};
