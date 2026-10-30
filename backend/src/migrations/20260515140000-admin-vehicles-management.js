'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const v = await queryInterface.describeTable('vehicles');

    if (!v.vin_number) {
      await queryInterface.addColumn('vehicles', 'vin_number', {
        type: Sequelize.STRING(17),
        allowNull: true
      });
    }
    if (!v.notes) {
      await queryInterface.addColumn('vehicles', 'notes', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
    if (!v.license_plate_normalized) {
      await queryInterface.addColumn('vehicles', 'license_plate_normalized', {
        type: Sequelize.STRING(32),
        allowNull: true
      });
    }
    if (!v.status) {
      await queryInterface.addColumn('vehicles', 'status', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active'
      });
    }
    if (!v.removed_at) {
      await queryInterface.addColumn('vehicles', 'removed_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!v.removal_reason) {
      await queryInterface.addColumn('vehicles', 'removal_reason', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    await queryInterface.addIndex('vehicles', ['status'], { name: 'vehicles_status_idx' }).catch(() => {});
    await queryInterface.addIndex('vehicles', ['vin_number'], { name: 'vehicles_vin_idx' }).catch(() => {});
    await queryInterface.addIndex('vehicles', ['license_plate_normalized'], {
      name: 'vehicles_plate_norm_idx'
    }).catch(() => {});

    const vi = await queryInterface.describeTable('vehicle_images');
    if (!vi.image_type) {
      await queryInterface.addColumn('vehicle_images', 'image_type', {
        type: Sequelize.STRING(24),
        allowNull: false,
        defaultValue: 'other'
      });
    }
    if (!vi.is_flagged) {
      await queryInterface.addColumn('vehicle_images', 'is_flagged', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
    if (!vi.flagged_by) {
      await queryInterface.addColumn('vehicle_images', 'flagged_by', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
    if (!vi.flagged_at) {
      await queryInterface.addColumn('vehicle_images', 'flagged_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    await queryInterface.addIndex('vehicle_images', ['vehicle_id', 'is_flagged'], {
      name: 'vehicle_images_flagged_idx'
    }).catch(() => {});

    const tables = await queryInterface.showAllTables();
    const hasFlags = tables.includes('vehicle_flags');
    if (!hasFlags) {
      await queryInterface.createTable('vehicle_flags', {
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
        flag_type: {
          type: Sequelize.STRING(64),
          allowNull: false
        },
        reason: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        review_status: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'open'
        },
        resolution_notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        flagged_by: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        resolved_by: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        resolved_at: {
          type: Sequelize.DATE,
          allowNull: true
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
      await queryInterface.addIndex('vehicle_flags', ['vehicle_id'], { name: 'vehicle_flags_vehicle_id_idx' });
      await queryInterface.addIndex('vehicle_flags', ['review_status'], { name: 'vehicle_flags_review_status_idx' });
      await queryInterface.addIndex('vehicle_flags', ['flag_type'], { name: 'vehicle_flags_type_idx' });
    }

    const hasActivity = tables.includes('vehicle_activity_logs');
    if (!hasActivity) {
      await queryInterface.createTable('vehicle_activity_logs', {
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
        activity_type: {
          type: Sequelize.STRING(64),
          allowNull: false
        },
        actor_type: {
          type: Sequelize.STRING(24),
          allowNull: false
        },
        actor_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true
        },
        metadata: {
          type: Sequelize.JSON,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
      await queryInterface.addIndex('vehicle_activity_logs', ['vehicle_id', 'created_at'], {
        name: 'vehicle_activity_vehicle_created_idx'
      });
      await queryInterface.addIndex('vehicle_activity_logs', ['activity_type'], {
        name: 'vehicle_activity_type_idx'
      });
    }

    await queryInterface.sequelize.query(
      `UPDATE vehicles SET license_plate_normalized = UPPER(TRIM(license_plate)) WHERE license_plate IS NOT NULL`
    );
    await queryInterface.sequelize.query(
      `UPDATE vehicles SET status = 'active' WHERE status IS NULL OR status = ''`
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('vehicle_activity_logs').catch(() => {});
    await queryInterface.dropTable('vehicle_flags').catch(() => {});

    await queryInterface.removeIndex('vehicle_images', 'vehicle_images_flagged_idx').catch(() => {});

    await queryInterface.removeColumn('vehicle_images', 'flagged_at').catch(() => {});
    await queryInterface.removeColumn('vehicle_images', 'flagged_by').catch(() => {});
    await queryInterface.removeColumn('vehicle_images', 'is_flagged').catch(() => {});
    await queryInterface.removeColumn('vehicle_images', 'image_type').catch(() => {});

    await queryInterface.removeIndex('vehicles', 'vehicles_plate_norm_idx').catch(() => {});
    await queryInterface.removeIndex('vehicles', 'vehicles_vin_idx').catch(() => {});
    await queryInterface.removeIndex('vehicles', 'vehicles_status_idx').catch(() => {});

    await queryInterface.removeColumn('vehicles', 'removal_reason').catch(() => {});
    await queryInterface.removeColumn('vehicles', 'removed_at').catch(() => {});
    await queryInterface.removeColumn('vehicles', 'status').catch(() => {});
    await queryInterface.removeColumn('vehicles', 'license_plate_normalized').catch(() => {});
    await queryInterface.removeColumn('vehicles', 'notes').catch(() => {});
    await queryInterface.removeColumn('vehicles', 'vin_number').catch(() => {});
  }
};
