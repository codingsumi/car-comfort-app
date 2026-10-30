'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('bookings');
    const add = async (name, type = Sequelize.STRING(64)) => {
      if (!table[name]) {
        await queryInterface.addColumn('bookings', name, { type, allowNull: true });
      }
    };
    await add('vehicle_parked_location');
    await add('provider_park_location');
    await add('vehicle_key_location');
    await add('key_return_location');
    await add('vehicle_parked_location_other', Sequelize.TEXT);
    await add('provider_park_location_other', Sequelize.TEXT);
    await add('vehicle_key_location_other', Sequelize.TEXT);
    await add('key_return_location_other', Sequelize.TEXT);
  },

  async down(queryInterface) {
    for (const col of [
      'vehicle_parked_location',
      'provider_park_location',
      'vehicle_key_location',
      'key_return_location',
      'vehicle_parked_location_other',
      'provider_park_location_other',
      'vehicle_key_location_other',
      'key_return_location_other'
    ]) {
      await queryInterface.removeColumn('bookings', col).catch(() => {});
    }
  }
};
