'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) =>
      String(t).toLowerCase()
    );
    if (!tables.includes('tutorial_contents')) return;

    const table = await queryInterface.describeTable('tutorial_contents');
    if (!table.audience) {
      await queryInterface.addColumn('tutorial_contents', 'audience', {
        type: Sequelize.ENUM('customer', 'driver'),
        allowNull: false,
        defaultValue: 'customer',
        after: 'id'
      });
    }

    await queryInterface.sequelize.query(
      "UPDATE tutorial_contents SET audience = 'customer' WHERE audience IS NULL OR audience = ''"
    );

    await queryInterface.sequelize.query(`
      DELETE t1 FROM tutorial_contents t1
      INNER JOIN tutorial_contents t2
      ON t1.audience = t2.audience AND t1.id < t2.id
    `);

    try {
      await queryInterface.addIndex('tutorial_contents', ['audience'], {
        unique: true,
        name: 'tutorial_contents_audience_unique'
      });
    } catch (_e) {
      // Already applied.
    }
  },

  async down(queryInterface) {
    const tables = (await queryInterface.showAllTables()).map((t) =>
      String(t).toLowerCase()
    );
    if (!tables.includes('tutorial_contents')) return;

    try {
      await queryInterface.removeIndex(
        'tutorial_contents',
        'tutorial_contents_audience_unique'
      );
    } catch (_e) {
      // ignore
    }

    const table = await queryInterface.describeTable('tutorial_contents');
    if (table.audience) {
      await queryInterface.removeColumn('tutorial_contents', 'audience');
    }
  }
};
