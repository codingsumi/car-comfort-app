'use strict';

/** MySQL kept legacy single-column unique indexes (email_2, phone_2) after role-based uniques were added. */
module.exports = {
  async up(queryInterface) {
    const legacyIndexes = [
      'email',
      'email_2',
      'email_3',
      'phone',
      'phone_2',
      'phone_3',
      'users_email_unique',
      'users_phone_unique'
    ];

    for (const name of legacyIndexes) {
      await queryInterface.removeIndex('users', name).catch(() => {});
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface
      .addIndex('users', ['email'], {
        unique: true,
        name: 'email_2'
      })
      .catch(() => {});

    await queryInterface
      .addIndex('users', ['phone'], {
        unique: true,
        name: 'phone_2'
      })
      .catch(() => {});
  }
};
