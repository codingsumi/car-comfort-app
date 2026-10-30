'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('services', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
        unique: true
      },
      icon: {
        type: Sequelize.STRING(2048),
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

    await queryInterface.bulkInsert('services', [
      { name: 'Car Wash', icon: null },
      { name: 'EV charging', icon: null },
      { name: 'Car wash & EV charging', icon: null }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('services');
  }
};

