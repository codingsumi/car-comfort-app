'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reviews', 'moderation_status', {
      type: Sequelize.ENUM('pending', 'approved', 'hidden', 'removed', 'flagged'),
      allowNull: false,
      defaultValue: 'pending',
      after: 'is_satisfied',
    });

    await queryInterface.addColumn('reviews', 'moderated_by', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      after: 'moderation_status',
    });

    await queryInterface.addColumn('reviews', 'moderation_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'moderated_by',
    });

    await queryInterface.addColumn('reviews', 'moderated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'moderation_reason',
    });

    await queryInterface.addColumn('reviews', 'original_message', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'moderated_at',
    });

    await queryInterface.addIndex('reviews', ['moderation_status']);
    await queryInterface.addIndex('reviews', ['moderated_by']);
    await queryInterface.addIndex('reviews', ['reviewee_user_id', 'rating']);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('reviews', 'original_message');
    await queryInterface.removeColumn('reviews', 'moderated_at');
    await queryInterface.removeColumn('reviews', 'moderation_reason');
    await queryInterface.removeColumn('reviews', 'moderated_by');
    await queryInterface.removeColumn('reviews', 'moderation_status');
  },
};
