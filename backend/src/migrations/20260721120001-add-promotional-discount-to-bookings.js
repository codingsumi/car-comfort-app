'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bookings', 'promotional_discount_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      after: 'referral_discount_type',
    });
    await queryInterface.addColumn('bookings', 'promotional_discount_name', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'promotional_discount_id',
    });
    await queryInterface.addColumn('bookings', 'promotional_discount_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      after: 'promotional_discount_name',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'promotional_discount_id');
    await queryInterface.removeColumn('bookings', 'promotional_discount_name');
    await queryInterface.removeColumn('bookings', 'promotional_discount_amount');
  },
};
