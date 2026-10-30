'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('promotional_discounts', 'notify_customers', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'created_by',
    });
    await queryInterface.addColumn('promotional_discounts', 'notified_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'notify_customers',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('promotional_discounts', 'notify_customers');
    await queryInterface.removeColumn('promotional_discounts', 'notified_at');
  },
};
