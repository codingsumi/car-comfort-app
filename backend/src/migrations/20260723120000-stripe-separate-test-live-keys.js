'use strict';

/** Adds separate test/live key fields so switching modes never overwrites the other set. */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Insert the 4 new fields; ignore if they already exist
    const newSettings = [
      {
        key: 'stripe_publishable_key_test',
        value: '',
        type: 'text',
        group_name: 'stripe',
        label: 'Test Publishable Key',
        description: 'Stripe test publishable key (pk_test_…)',
        is_sensitive: false,
        is_public: true,
        sort_order: 11,
        created_at: now,
        updated_at: now,
      },
      {
        key: 'stripe_secret_key_test',
        value: '',
        type: 'password',
        group_name: 'stripe',
        label: 'Test Secret Key',
        description: 'Stripe test secret key (sk_test_…)',
        is_sensitive: true,
        is_public: false,
        sort_order: 12,
        created_at: now,
        updated_at: now,
      },
      {
        key: 'stripe_publishable_key_live',
        value: '',
        type: 'text',
        group_name: 'stripe',
        label: 'Live Publishable Key',
        description: 'Stripe live publishable key (pk_live_…)',
        is_sensitive: false,
        is_public: true,
        sort_order: 13,
        created_at: now,
        updated_at: now,
      },
      {
        key: 'stripe_secret_key_live',
        value: '',
        type: 'password',
        group_name: 'stripe',
        label: 'Live Secret Key',
        description: 'Stripe live secret key (sk_live_…)',
        is_sensitive: true,
        is_public: false,
        sort_order: 14,
        created_at: now,
        updated_at: now,
      },
    ];

    for (const setting of newSettings) {
      await queryInterface.sequelize.query(
        `INSERT IGNORE INTO app_settings
          (\`key\`, value, type, group_name, label, description, is_sensitive, is_public, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        {
          replacements: [
            setting.key, setting.value, setting.type, setting.group_name,
            setting.label, setting.description, setting.is_sensitive,
            setting.is_public, setting.sort_order, setting.created_at, setting.updated_at,
          ],
        }
      );
    }

    // Backfill: copy current stripe_publishable_key into the correct test/live bucket
    await queryInterface.sequelize.query(`
      UPDATE app_settings
      SET value = (SELECT value FROM (SELECT value FROM app_settings WHERE \`key\` = 'stripe_publishable_key') AS t)
      WHERE \`key\` = 'stripe_publishable_key_test'
        AND (SELECT value FROM (SELECT value FROM app_settings WHERE \`key\` = 'stripe_publishable_key') AS t) LIKE 'pk_test_%'
        AND (value IS NULL OR value = '')
    `);

    await queryInterface.sequelize.query(`
      UPDATE app_settings
      SET value = (SELECT value FROM (SELECT value FROM app_settings WHERE \`key\` = 'stripe_publishable_key') AS t)
      WHERE \`key\` = 'stripe_publishable_key_live'
        AND (SELECT value FROM (SELECT value FROM app_settings WHERE \`key\` = 'stripe_publishable_key') AS t) LIKE 'pk_live_%'
        AND (value IS NULL OR value = '')
    `);

    // Backfill secret key into correct bucket
    await queryInterface.sequelize.query(`
      UPDATE app_settings dest
      JOIN app_settings src ON src.\`key\` = 'stripe_secret_key'
      SET dest.value = src.value
      WHERE dest.\`key\` = 'stripe_secret_key_test'
        AND (dest.value IS NULL OR dest.value = '')
        AND (SELECT stripe_payment_mode_val.value FROM (SELECT value FROM app_settings WHERE \`key\` = 'stripe_payment_mode') AS stripe_payment_mode_val) = 'test'
    `);

    await queryInterface.sequelize.query(`
      UPDATE app_settings dest
      JOIN app_settings src ON src.\`key\` = 'stripe_secret_key'
      SET dest.value = src.value
      WHERE dest.\`key\` = 'stripe_secret_key_live'
        AND (dest.value IS NULL OR dest.value = '')
        AND (SELECT stripe_payment_mode_val.value FROM (SELECT value FROM app_settings WHERE \`key\` = 'stripe_payment_mode') AS stripe_payment_mode_val) = 'live'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM app_settings WHERE \`key\` IN (
        'stripe_publishable_key_test', 'stripe_secret_key_test',
        'stripe_publishable_key_live', 'stripe_secret_key_live'
      )`
    );
  },
};
