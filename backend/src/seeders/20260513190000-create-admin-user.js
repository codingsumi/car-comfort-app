'use strict';

const bcrypt = require('bcrypt');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const email = 'admin@carcomfort.com';
    const password = 'sR123456';

    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = :email LIMIT 1`,
      { replacements: { email } }
    );

    if (existing.length > 0) {
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      await queryInterface.sequelize.query(
        `UPDATE users SET password = :password, role = 'admin', is_verified = 1, updated_at = NOW() WHERE email = :email`,
        { replacements: { password: passwordHash, email } }
      );
      console.log(`Admin user ${email} already exists (id: ${existing[0].id}), password & role reset.`);
      return;
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const referralCode = `CC${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;

    await queryInterface.bulkInsert('users', [
      {
        name: 'Admin',
        first_name: 'Admin',
        last_name: '',
        email,
        password: passwordHash,
        role: 'admin',
        auth_type: 'normal',
        is_verified: true,
        agreed_to_terms: true,
        token_version: 0,
        referral_code: referralCode,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    console.log(`Admin user created: ${email}`);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { email: 'admin@carcomfort.com' });
  },
};
