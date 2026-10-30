'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vehicles', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      vehicle_type: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      make: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      model: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      year: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false
      },
      color: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      nickname: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      license_plate: {
        type: Sequelize.STRING(32),
        allowNull: false
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

    await queryInterface.addIndex('vehicles', ['user_id'], { name: 'vehicles_user_id_idx' });

    await queryInterface.createTable('vehicle_images', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      vehicle_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'vehicles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      image_path: {
        type: Sequelize.STRING(512),
        allowNull: false
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

    await queryInterface.addIndex('vehicle_images', ['vehicle_id'], { name: 'vehicle_images_vehicle_id_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('vehicle_images');
    await queryInterface.dropTable('vehicles');
  }
};
