'use strict';

const INVOICE_ADDRESS = '166 Geary Street\nSan Francisco, California 94108';
const RECEIPT_NOTES =
  'This receipt was generated electronically and is valid without a signature. Prices are in USD. For questions, please contact Car Comfort support.';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('app_settings')) return;

    const now = new Date();
    await queryInterface.bulkUpdate(
      'app_settings',
      { value: INVOICE_ADDRESS, updated_at: now },
      { key: 'invoice_address' }
    );
    await queryInterface.bulkUpdate(
      'app_settings',
      { value: RECEIPT_NOTES, updated_at: now },
      { key: 'invoice_footer_notes' }
    );
    await queryInterface.bulkUpdate(
      'app_settings',
      {
        label: 'Tax ID / GST/VAT Number',
        description: 'Tax registration number shown on customer receipts',
        updated_at: now,
      },
      { key: 'invoice_gst_vat_number' }
    );

    // Do not display a known placeholder tax ID; the real value can be added
    // later from Admin Settings > Company & Invoice.
    await queryInterface.sequelize.query(
      "UPDATE `app_settings` SET `value` = '', `updated_at` = ? WHERE `key` = 'invoice_gst_vat_number' AND LOWER(`value`) REGEXP 'demo|test|placeholder'",
      { replacements: [now] }
    );

    const existing = await queryInterface.sequelize.query(
      "SELECT `key` FROM `app_settings` WHERE `key` = 'invoice_website'",
      { type: Sequelize.QueryTypes.SELECT }
    );
    if (!existing.length) {
      await queryInterface.bulkInsert('app_settings', [{
        key: 'invoice_website',
        value: '',
        type: 'url',
        group_name: 'invoice',
        label: 'Company Website',
        description: 'Website shown on customer receipts',
        is_sensitive: false,
        is_public: false,
        sort_order: 3,
        created_at: now,
        updated_at: now,
      }]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('app_settings', { key: 'invoice_website' });
  },
};
