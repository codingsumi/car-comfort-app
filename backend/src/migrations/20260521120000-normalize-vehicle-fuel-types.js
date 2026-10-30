'use strict';

/** Map legacy OTHER → GAS; default new rows to GAS. */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE vehicles SET fuel_type = 'GAS' WHERE fuel_type = 'OTHER' OR fuel_type IS NULL OR fuel_type = ''`
    );
    await queryInterface.changeColumn('vehicles', 'fuel_type', {
      type: require('sequelize').STRING(10),
      allowNull: false,
      defaultValue: 'GAS',
    });
  },

  async down(queryInterface) {
    await queryInterface.changeColumn('vehicles', 'fuel_type', {
      type: require('sequelize').STRING(10),
      allowNull: false,
      defaultValue: 'OTHER',
    });
  },
};
