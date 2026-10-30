'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('packages', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      service_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'services', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      name: {
        type: Sequelize.STRING(160),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      base_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      duration_minutes: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false
      },
      is_active: {
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

    await queryInterface.addIndex('packages', ['service_id']);
    await queryInterface.addIndex('packages', ['service_id', 'is_active']);

    await queryInterface.createTable('package_features', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      package_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'packages', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      feature_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      }
    });

    await queryInterface.addIndex('package_features', ['package_id']);

    await queryInterface.createTable('add_ons', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(160),
        allowNull: false,
        unique: true
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
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

    await queryInterface.createTable('package_addons_map', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      package_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'packages', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      addon_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'add_ons', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      }
    });

    await queryInterface.addIndex('package_addons_map', ['package_id']);
    await queryInterface.addIndex('package_addons_map', ['addon_id']);
    await queryInterface.addConstraint('package_addons_map', {
      type: 'unique',
      fields: ['package_id', 'addon_id'],
      name: 'uq_package_addon'
    });

    await queryInterface.createTable('bookings', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      service_type: {
        type: Sequelize.ENUM('car_wash', 'ev_charging', 'combo'),
        allowNull: false
      },
      package_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'packages', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      custom_package_name: {
        type: Sequelize.STRING(160),
        allowNull: true
      },
      custom_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      schedule_type: {
        type: Sequelize.ENUM('asap', 'scheduled'),
        allowNull: false
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
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

    await queryInterface.addIndex('bookings', ['user_id']);
    await queryInterface.addIndex('bookings', ['package_id']);
    await queryInterface.addIndex('bookings', ['service_type']);
    await queryInterface.addIndex('bookings', ['status']);
    await queryInterface.addIndex('bookings', ['created_at']);

    // Normalized storage for selected addons per booking.
    await queryInterface.createTable('booking_addons_map', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      booking_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'bookings', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      addon_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'add_ons', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('booking_addons_map', ['booking_id']);
    await queryInterface.addIndex('booking_addons_map', ['addon_id']);
    await queryInterface.addConstraint('booking_addons_map', {
      type: 'unique',
      fields: ['booking_id', 'addon_id'],
      name: 'uq_booking_addon'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('booking_addons_map');
    await queryInterface.dropTable('bookings');
    await queryInterface.dropTable('package_addons_map');
    await queryInterface.dropTable('add_ons');
    await queryInterface.dropTable('package_features');
    await queryInterface.dropTable('packages');
  }
};

