'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Comprehensive set of commonly used US vehicle body styles.
    // Use an upsert so running this migration is safe on existing DBs.
    const names = [
      'Cargo Van',
      'Convertible',
      'Coupe',
      'Crossover',
      'Hatchback',
      'Minivan',
      'Pickup Truck',
      'Sedan',
      'SUV',
      'Van',
      'Wagon'
    ];

    // MySQL upsert on UNIQUE(name)
    const valuesSql = names
      .map((n) => `(${queryInterface.sequelize.escape(n)}, 'active')`)
      .join(', ');

    await queryInterface.sequelize.query(
      `INSERT INTO vehicle_types (name, status) VALUES ${valuesSql}
       ON DUPLICATE KEY UPDATE
         name = VALUES(name)`
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('vehicle_types', {
      name: [
        'Cargo Van',
        'Convertible',
        'Coupe',
        'Crossover',
        'Hatchback',
        'Minivan',
        'Pickup Truck',
        'Sedan',
        'SUV',
        'Van',
        'Wagon'
      ]
    });
  }
};

