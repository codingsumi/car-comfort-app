const { DataTypes } = require('sequelize');

const ROLES = ['customer', 'driver', 'garage', 'admin'];
const AUTH_TYPES = ['normal', 'social'];
const SOCIAL_TYPES = ['google', 'apple', 'facebook'];

function generateReferralCodeCandidate() {
  // "CC" + 6 digits => 8 chars total (e.g. CC123456)
  const n = Math.floor(Math.random() * 1000000);
  return `CC${String(n).padStart(6, '0')}`;
}

module.exports = (sequelize) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false
      },
      first_name: {
        type: DataTypes.STRING(60),
        allowNull: true
      },
      last_name: {
        type: DataTypes.STRING(60),
        allowNull: true
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: { isEmail: true }
      },
      phone: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      country_code: {
        type: DataTypes.STRING(8),
        allowNull: true
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      auth_type: {
        type: DataTypes.ENUM(...AUTH_TYPES),
        allowNull: false,
        defaultValue: 'normal'
      },
      social_type: {
        type: DataTypes.ENUM(...SOCIAL_TYPES),
        allowNull: true
      },
      social_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      social_token: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      token_version: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      },
      role: {
        type: DataTypes.ENUM(...ROLES),
        allowNull: false,
        defaultValue: 'customer'
      },
      status: {
        type: DataTypes.ENUM('active', 'suspended', 'deactivated'),
        allowNull: false,
        defaultValue: 'active'
      },
      suspended_reason: {
        type: DataTypes.STRING(1024),
        allowNull: true
      },
      suspended_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      deactivated_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      is_verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      agreed_to_terms: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      otp_code: {
        type: DataTypes.STRING(10),
        allowNull: true
      },
      otp_expiry: {
        type: DataTypes.DATE,
        allowNull: true
      },
      stripe_customer_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      stripe_customer_id_live: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      stripe_customer_id_test: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      stripe_connect_account_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      stripe_test_publishable_key: {
        type: DataTypes.STRING(512),
        allowNull: true
      },
      stripe_test_secret_key: {
        type: DataTypes.STRING(512),
        allowNull: true
      },
      default_payment_method_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      referral_code: {
        type: DataTypes.STRING(8),
        allowNull: false,
        unique: true
      },
      referred_by_user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      referral_share_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      },
      referral_reward_pending: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      referral_first_booking_discount_pending: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      profile: {
        type: DataTypes.JSON,
        allowNull: true
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
      },
      location_updated_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      daily_service_limit: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        defaultValue: null,
      },
      service_limit_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      }
    },
    {
      tableName: 'users',
      underscored: true
    }
  );

  User.addHook('beforeValidate', async (user) => {
    if (user.referral_code) return;

    // Try a few times; collisions are extremely unlikely with 1e6 space + unique index.
    for (let i = 0; i < 12; i += 1) {
      const candidate = generateReferralCodeCandidate();
      // eslint-disable-next-line no-await-in-loop
      const exists = await User.findOne({ where: { referral_code: candidate }, attributes: ['id'] });
      if (!exists) {
        user.referral_code = candidate;
        return;
      }
    }

    throw new Error('Failed to generate unique referral_code');
  });

  return User;
};

