'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vehicle_types', {
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
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active'
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

    await queryInterface.bulkInsert('vehicle_types', [
      { name: 'Coupe', status: 'active' },
      { name: 'Minivan', status: 'active' },
      { name: 'Pickup Truck', status: 'active' },
      { name: 'Sedan', status: 'active' },
      { name: 'SUV', status: 'active' }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('vehicle_types');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_vehicle_types_status;').catch(() => {});
  }
};

