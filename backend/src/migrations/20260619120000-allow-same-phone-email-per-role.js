'use strict';

/** Allow the same phone/email on separate customer and driver accounts. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const indexNames = [
      'email',
      'email_2',
      'email_3',
      'phone',
      'phone_2',
      'phone_3',
      'users_email_unique',
      'users_phone_unique'
    ];
    for (const name of indexNames) {
      await queryInterface.removeIndex('users', name).catch(() => {});
    }

    await queryInterface.changeColumn('users', 'email', {
      type: Sequelize.STRING(255),
      allowNull: true,
      unique: false
    });

    await queryInterface.changeColumn('users', 'phone', {
      type: Sequelize.STRING(32),
      allowNull: true,
      unique: false
    });

    await queryInterface
      .addIndex('users', ['email', 'role'], {
        unique: true,
        name: 'users_email_role_unique'
      })
      .catch(() => {});

    await queryInterface
      .addIndex('users', ['phone', 'role'], {
        unique: true,
        name: 'users_phone_role_unique'
      })
      .catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('users', 'users_email_role_unique').catch(() => {});
    await queryInterface.removeIndex('users', 'users_phone_role_unique').catch(() => {});

    await queryInterface.changeColumn('users', 'email', {
      type: Sequelize.STRING(255),
      allowNull: true,
      unique: true
    });

    await queryInterface.changeColumn('users', 'phone', {
      type: Sequelize.STRING(32),
      allowNull: true,
      unique: true
    });
  }
};
