'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');

    if (!table.referral_code) {
      await queryInterface.addColumn('users', 'referral_code', {
        type: Sequelize.STRING(8),
        allowNull: true
      });
    }

    if (!table.referred_by_user_id) {
      await queryInterface.addColumn('users', 'referred_by_user_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true
      });
    }

    if (!table.referral_share_count) {
      await queryInterface.addColumn('users', 'referral_share_count', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      });
    }

    // Backfill referral codes for existing users.
    // Use a small candidate space (1e6) + uniqueness checks; OK for typical user counts.
    const [rows] = await queryInterface.sequelize.query('SELECT id, referral_code FROM users');
    const existing = new Set(
      (Array.isArray(rows) ? rows : [])
        .map((r) => (r && r.referral_code ? String(r.referral_code).trim() : ''))
        .filter(Boolean)
    );

    function candidate() {
      const n = Math.floor(Math.random() * 1000000);
      return `CC${String(n).padStart(6, '0')}`;
    }

    for (const r of Array.isArray(rows) ? rows : []) {
      if (!r || r.referral_code) continue;

      let code = null;
      for (let i = 0; i < 20; i += 1) {
        const c = candidate();
        if (existing.has(c)) continue;
        existing.add(c);
        code = c;
        break;
      }
      if (!code) throw new Error('Failed to backfill unique referral_code');

      // eslint-disable-next-line no-await-in-loop
      await queryInterface.sequelize.query('UPDATE users SET referral_code = :code WHERE id = :id', {
        replacements: { code, id: r.id }
      });
    }

    // Enforce NOT NULL going forward (after backfill).
    await queryInterface.changeColumn('users', 'referral_code', {
      type: Sequelize.STRING(8),
      allowNull: false
    });

    // Uniqueness & lookup speed.
    try {
      await queryInterface.addIndex('users', ['referral_code'], {
        unique: true,
        name: 'users_referral_code_unique'
      });
    } catch (_e) {
      // ignore if already exists
    }

    try {
      await queryInterface.addIndex('users', ['referred_by_user_id'], {
        name: 'users_referred_by_user_id_idx'
      });
    } catch (_e) {
      // ignore if already exists
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeIndex('users', 'users_referred_by_user_id_idx');
    } catch (_e) {
      // ignore
    }
    try {
      await queryInterface.removeIndex('users', 'users_referral_code_unique');
    } catch (_e) {
      // ignore
    }

    const table = await queryInterface.describeTable('users');

    if (table.referral_share_count) {
      await queryInterface.removeColumn('users', 'referral_share_count');
    }
    if (table.referred_by_user_id) {
      await queryInterface.removeColumn('users', 'referred_by_user_id');
    }
    if (table.referral_code) {
      await queryInterface.removeColumn('users', 'referral_code');
    }
  }
};

