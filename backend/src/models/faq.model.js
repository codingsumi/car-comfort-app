const { DataTypes } = require('sequelize');

const STATUSES = ['draft', 'published'];

module.exports = (sequelize) => {
  const Faq = sequelize.define(
    'Faq',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      category_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      question: { type: DataTypes.STRING(500), allowNull: false },
      answer: { type: DataTypes.TEXT, allowNull: false },
      status: {
        type: DataTypes.ENUM(...STATUSES),
        allowNull: false,
        defaultValue: 'draft',
      },
      sort_order: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'faqs',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  Faq.STATUSES = STATUSES;
  return Faq;
};
