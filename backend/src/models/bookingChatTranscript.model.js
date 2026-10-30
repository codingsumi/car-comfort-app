'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BookingChatTranscript = sequelize.define(
    'BookingChatTranscript',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      booking_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
      },
      message_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      transcript_json: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      source: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: 'firebase_rtdb',
      },
      captured_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'booking_chat_transcripts',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return BookingChatTranscript;
};
