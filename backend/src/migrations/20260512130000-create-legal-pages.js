'use strict';

const { getLegalPagesCarComfortBulkInsertRows } = require('../seeders/data/legalPagesCarComfort');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    if (!tables.includes('legal_pages')) {
      await queryInterface.createTable('legal_pages', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true
        },
        title: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        slug: {
          type: Sequelize.STRING(191),
          allowNull: false,
          unique: true
        },
        description_json: {
          type: Sequelize.JSON,
          allowNull: false,
          defaultValue: { html: '' }
        },
        meta_title: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        meta_description: {
          type: Sequelize.STRING(512),
          allowNull: true
        },
        status: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      });
    }

    const countRows = await queryInterface.sequelize.query('SELECT COUNT(*) AS c FROM legal_pages', {
      type: Sequelize.QueryTypes.SELECT
    });
    const c = countRows?.[0]?.c ?? 0;
    if (Number(c) > 0) return;

    await queryInterface.bulkInsert('legal_pages', getLegalPagesCarComfortBulkInsertRows());
  },

  async down(queryInterface) {
    await queryInterface.dropTable('legal_pages');
  }
};
