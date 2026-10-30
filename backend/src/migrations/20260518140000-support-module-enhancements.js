'use strict';

const TICKET_STATUSES = [
  'open',
  'pending',
  'in_progress',
  'waiting_for_user',
  'escalated',
  'resolved',
  'closed',
];

/** @param {import('sequelize').QueryInterface} queryInterface */
module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface;
    const { sequelize } = qi;

    const tables = (await sequelize.query('SHOW TABLES', { type: Sequelize.QueryTypes.SELECT })).map(
      (row) => Object.values(row)[0]
    );

    if (!tables.includes('support_tickets')) return;

    const desc = await qi.describeTable('support_tickets');

    if (!desc.category) {
      await qi.addColumn('support_tickets', 'category', {
        type: Sequelize.STRING(64),
        allowNull: true,
        defaultValue: 'general',
      });
    }

    if (!desc.linked_booking_id) {
      await qi.addColumn('support_tickets', 'linked_booking_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      });
    }

    if (!desc.escalated_at) {
      await qi.addColumn('support_tickets', 'escalated_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    await qi.changeColumn('support_tickets', 'status', {
      type: Sequelize.ENUM(...TICKET_STATUSES),
      allowNull: false,
      defaultValue: 'open',
    });

    await qi.changeColumn('support_tickets', 'priority', {
      type: Sequelize.ENUM('low', 'medium', 'high', 'urgent', 'critical'),
      allowNull: false,
      defaultValue: 'medium',
    });

    await qi.addIndex('support_tickets', ['category'], { name: 'idx_support_tickets_category' }).catch(() => {});
    await qi.addIndex('support_tickets', ['assigned_to'], { name: 'idx_support_tickets_assigned' }).catch(() => {});
    await qi
      .addIndex('support_tickets', ['linked_booking_id'], { name: 'idx_support_tickets_booking' })
      .catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    const qi = queryInterface;
    const { sequelize } = qi;

    const tables = (await sequelize.query('SHOW TABLES', { type: Sequelize.QueryTypes.SELECT })).map(
      (row) => Object.values(row)[0]
    );

    if (!tables.includes('support_tickets')) return;

    const desc = await qi.describeTable('support_tickets');

    await qi.removeIndex('support_tickets', 'idx_support_tickets_category').catch(() => {});
    await qi.removeIndex('support_tickets', 'idx_support_tickets_assigned').catch(() => {});
    await qi.removeIndex('support_tickets', 'idx_support_tickets_booking').catch(() => {});

    if (desc.category) await qi.removeColumn('support_tickets', 'category');
    if (desc.linked_booking_id) await qi.removeColumn('support_tickets', 'linked_booking_id');
    if (desc.escalated_at) await qi.removeColumn('support_tickets', 'escalated_at');

    await qi.changeColumn('support_tickets', 'status', {
      type: Sequelize.ENUM('open', 'pending', 'waiting_for_user', 'resolved', 'closed'),
      allowNull: false,
      defaultValue: 'open',
    });

    await qi.changeColumn('support_tickets', 'priority', {
      type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: false,
      defaultValue: 'medium',
    });
  },
};
