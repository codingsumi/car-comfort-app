'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tutorial_video_items', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      audience: {
        type: Sequelize.ENUM('customer', 'driver'),
        allowNull: false,
        defaultValue: 'customer'
      },
      category: {
        type: Sequelize.STRING(120),
        allowNull: false,
        defaultValue: 'General'
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      video_url: {
        type: Sequelize.STRING(2048),
        allowNull: true
      },
      sort_order: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },
      is_published: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
        )
      }
    });

    await queryInterface.addIndex('tutorial_video_items', ['audience', 'is_published', 'sort_order'], {
      name: 'tutorial_video_items_audience_publish_sort'
    });
    await queryInterface.addIndex('tutorial_video_items', ['audience', 'category'], {
      name: 'tutorial_video_items_audience_category'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tutorial_video_items');
  }
};
