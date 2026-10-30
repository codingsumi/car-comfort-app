'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('booking_images');
    if (!cols.image_type) {
      await queryInterface.addColumn('booking_images', 'image_type', {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'customer',
        after: 'image_url'
      });
    }

    await queryInterface.addIndex('booking_images', ['booking_id', 'image_type'], {
      name: 'booking_images_booking_id_image_type_idx'
    }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('booking_images', 'booking_images_booking_id_image_type_idx').catch(() => {});
    await queryInterface.removeColumn('booking_images', 'image_type').catch(() => {});
  }
};
