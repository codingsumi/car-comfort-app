'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE bookings
      MODIFY COLUMN status ENUM(
        'draft','pending_payment','confirmed','assigned','in_progress',
        'completed','cancelled','failed','disputed','refunded'
      ) NOT NULL DEFAULT 'draft'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE bookings
      ADD COLUMN dispute_status ENUM('open','investigating','resolved','closed') DEFAULT NULL AFTER cancellation_fee,
      ADD COLUMN admin_cancellation_reason TEXT DEFAULT NULL AFTER dispute_status
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE refund_requests
      ADD COLUMN amount DECIMAL(10, 2) DEFAULT NULL AFTER user_id,
      ADD COLUMN booking_id BIGINT UNSIGNED DEFAULT NULL AFTER booking_transaction_id,
      ADD COLUMN processed_by BIGINT UNSIGNED DEFAULT NULL AFTER stripe_payload,
      ADD COLUMN processed_at DATETIME DEFAULT NULL AFTER processed_by
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE refund_requests
      DROP COLUMN processed_at,
      DROP COLUMN processed_by,
      DROP COLUMN booking_id,
      DROP COLUMN amount
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE bookings
      DROP COLUMN admin_cancellation_reason,
      DROP COLUMN dispute_status
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE bookings
      MODIFY COLUMN status ENUM(
        'draft','pending_payment','confirmed','assigned','in_progress',
        'completed','cancelled'
      ) NOT NULL DEFAULT 'draft'
    `);
  }
};
