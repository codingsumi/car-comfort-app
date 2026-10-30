'use strict';

const {
  BOOKING_CHARGE_CODES,
  BOOKING_CHARGE_LABELS,
  DEFAULT_CARCOMFORT_SERVICE_FEE_AMOUNT,
} = require('../constants/bookingChargeCodes');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('booking_charges', [
      {
        code: BOOKING_CHARGE_CODES.CARCOMFORT_SERVICE_FEE,
        label: BOOKING_CHARGE_LABELS[BOOKING_CHARGE_CODES.CARCOMFORT_SERVICE_FEE],
        amount: DEFAULT_CARCOMFORT_SERVICE_FEE_AMOUNT,
        is_active: true,
        sort_order: 6,
        service_applicability: 'car_wash',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('booking_charges', {
      code: BOOKING_CHARGE_CODES.CARCOMFORT_SERVICE_FEE,
    });
  },
};
