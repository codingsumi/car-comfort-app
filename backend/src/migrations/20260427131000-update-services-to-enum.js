'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Convert existing human-readable service names to stable enum codes.
    await queryInterface.sequelize.query(`
      UPDATE services
      SET name = CASE
        WHEN name IN ('Car Wash', 'car_wash') THEN 'car_wash'
        WHEN name IN ('EV charging', 'EV Charging', 'ev_charging') THEN 'ev_charging'
        WHEN name IN ('Car wash & EV charging', 'Car Wash + EV Charging', 'combo') THEN 'combo'
        ELSE name
      END
    `);

    // Enforce enum constraint for production safety.
    await queryInterface.sequelize.query(`
      ALTER TABLE services
      MODIFY COLUMN name ENUM('car_wash','ev_charging','combo') NOT NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    // Roll back to a flexible string (cannot restore old display labels safely).
    await queryInterface.changeColumn('services', 'name', {
      type: Sequelize.STRING(120),
      allowNull: false,
      unique: true
    });
  }
};

