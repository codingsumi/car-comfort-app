'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('vehicles', 'is_default', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addIndex('vehicles', ['user_id', 'is_default'], {
      name: 'vehicles_user_default_idx'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('vehicles', 'vehicles_user_default_idx').catch(() => {});
    await queryInterface.removeColumn('vehicles', 'is_default');
  }
};
