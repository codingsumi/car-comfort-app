const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LegalPage = sequelize.define(
    'LegalPage',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      slug: {
        type: DataTypes.STRING(191),
        allowNull: false
      },
      audience: {
        type: DataTypes.ENUM('customer', 'provider', 'common'),
        allowNull: false,
        defaultValue: 'customer'
      },
      description_json: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: { html: '' }
      },
      meta_title: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      meta_description: {
        type: DataTypes.STRING(512),
        allowNull: true
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      sort_order: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },
      requires_agreement: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      show_in_menu: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      tableName: 'legal_pages',
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['slug', 'audience'],
          name: 'legal_pages_slug_audience_unique'
        }
      ]
    }
  );

  return LegalPage;
};
