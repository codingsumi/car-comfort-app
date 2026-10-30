const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProviderWallet = sequelize.define(
    'ProviderWallet',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      provider_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
      },
      pending_balance: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      available_for_payout: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'usd',
      },
    },
    {
      tableName: 'provider_wallets',
      underscored: true,
    }
  );

  return ProviderWallet;
};
