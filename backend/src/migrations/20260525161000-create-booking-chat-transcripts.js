'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('booking_chat_transcripts')) return;

    await queryInterface.createTable('booking_chat_transcripts', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      booking_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
      },
      message_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      transcript_json: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      source: {
        type: Sequelize.STRING(64),
        allowNull: false,
        defaultValue: 'firebase_rtdb',
      },
      captured_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('booking_chat_transcripts', ['booking_id'], {
      name: 'idx_booking_chat_transcripts_booking',
      unique: true,
    });
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('booking_chat_transcripts')) {
      await queryInterface.dropTable('booking_chat_transcripts');
    }
  },
};
