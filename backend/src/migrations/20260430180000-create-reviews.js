'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    if (tables.includes('reviews')) return;

    await queryInterface.createTable('reviews', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      booking_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'bookings', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      reviewer_user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      reviewee_user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      reviewer_role: {
        type: Sequelize.ENUM('customer', 'driver'),
        allowNull: false
      },
      reviewee_role: {
        type: Sequelize.ENUM('customer', 'driver'),
        allowNull: false
      },
      rating: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_satisfied: {
        type: Sequelize.BOOLEAN,
        allowNull: true
      },
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

    await queryInterface.addIndex('reviews', ['booking_id']).catch(() => {});
    await queryInterface.addIndex('reviews', ['reviewee_user_id']).catch(() => {});
    await queryInterface.addIndex('reviews', ['reviewer_user_id']).catch(() => {});
    await queryInterface
      .addIndex('reviews', ['booking_id', 'reviewer_user_id', 'reviewee_user_id'], { unique: true, name: 'uniq_review_pair' })
      .catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reviews').catch(() => {});
  }
};

