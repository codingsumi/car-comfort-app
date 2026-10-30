'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Ensure services exist (safe for existing DBs).
    await queryInterface.sequelize.query(`
      INSERT INTO services (name, icon)
      VALUES ('car_wash', NULL), ('ev_charging', NULL), ('combo', NULL)
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `);

    const [[carWash]] = await queryInterface.sequelize.query(`SELECT id FROM services WHERE name='car_wash' LIMIT 1`);
    const [[evCharging]] = await queryInterface.sequelize.query(`SELECT id FROM services WHERE name='ev_charging' LIMIT 1`);
    const [[combo]] = await queryInterface.sequelize.query(`SELECT id FROM services WHERE name='combo' LIMIT 1`);

    // Seed packages (idempotent-ish via UNIQUE(service_id, name) using INSERT IGNORE + select).
    await queryInterface.addConstraint('packages', {
      type: 'unique',
      fields: ['service_id', 'name'],
      name: 'uq_packages_service_name'
    });

    await queryInterface.sequelize.query(`
      INSERT IGNORE INTO packages (service_id, name, description, base_price, duration_minutes, is_active)
      VALUES
        (${carWash.id}, 'Basic Wash', 'Exterior wash and quick dry', 199.00, 30, TRUE),
        (${carWash.id}, 'Standard Wash', 'Exterior wash + wheel cleaning', 399.00, 45, TRUE),
        (${carWash.id}, 'Premium Wash', 'Exterior + interior cleaning', 699.00, 60, TRUE),

        (${evCharging.id}, 'Pay Per Use', 'Standard EV charging billed per use', 0.00, 30, TRUE),
        (${evCharging.id}, 'Fast Charge', 'High-speed EV charging', 0.00, 45, TRUE),

        (${combo.id}, 'Quick Combo', 'Basic wash + standard EV charging', 499.00, 45, TRUE),
        (${combo.id}, 'Premium Combo', 'Premium wash + fast charge', 999.00, 90, TRUE)
    `);

    const [packages] = await queryInterface.sequelize.query(`
      SELECT id, service_id, name FROM packages
      WHERE (service_id IN (${carWash.id}, ${evCharging.id}, ${combo.id}))
    `);

    function pkgId(serviceId, name) {
      const p = packages.find((x) => Number(x.service_id) === Number(serviceId) && x.name === name);
      return p?.id;
    }

    const basicWashId = pkgId(carWash.id, 'Basic Wash');
    const standardWashId = pkgId(carWash.id, 'Standard Wash');
    const premiumWashId = pkgId(carWash.id, 'Premium Wash');
    const ppuId = pkgId(evCharging.id, 'Pay Per Use');
    const fastChargeId = pkgId(evCharging.id, 'Fast Charge');
    const quickComboId = pkgId(combo.id, 'Quick Combo');
    const premiumComboId = pkgId(combo.id, 'Premium Combo');

    const features = [
      [basicWashId, ['Foam wash', 'Rinse', 'Quick dry']],
      [standardWashId, ['Foam wash', 'Wheel cleaning', 'Wax rinse', 'Dry']],
      [premiumWashId, ['Foam wash', 'Wheel cleaning', 'Interior vacuum', 'Dashboard wipe', 'Dry']],

      [ppuId, ['Standard charging', 'Pay per use']],
      [fastChargeId, ['Fast charging', 'Priority bay (if available)']],

      [quickComboId, ['Basic wash', 'Standard charging']],
      [premiumComboId, ['Premium wash', 'Fast charging', 'Interior vacuum']]
    ];

    for (const [packageId, items] of features) {
      if (!packageId) continue;
      const valuesSql = items.map((f) => `(${packageId}, ${queryInterface.sequelize.escape(f)})`).join(', ');
      await queryInterface.sequelize.query(`
        INSERT IGNORE INTO package_features (package_id, feature_name)
        VALUES ${valuesSql}
      `);
    }

    // Seed a few generic add-ons (needed for booking addons validation & price calculation).
    await queryInterface.sequelize.query(`
      INSERT INTO add_ons (name, price)
      VALUES
        ('Interior Vacuum', 99.00),
        ('Tire Polish', 49.00),
        ('Sanitization', 149.00),
        ('Fast-charge Priority', 199.00)
      ON DUPLICATE KEY UPDATE
        price = VALUES(price)
    `);

    const [addons] = await queryInterface.sequelize.query(`SELECT id, name FROM add_ons`);
    const addonId = (name) => addons.find((a) => a.name === name)?.id;

    // Map relevant add-ons to packages (optional but helps restrict invalid addon IDs per package).
    const mappings = [
      [premiumWashId, addonId('Interior Vacuum')],
      [standardWashId, addonId('Tire Polish')],
      [premiumWashId, addonId('Sanitization')],
      [fastChargeId, addonId('Fast-charge Priority')],
      [premiumComboId, addonId('Interior Vacuum')],
      [premiumComboId, addonId('Fast-charge Priority')]
    ].filter((x) => x[0] && x[1]);

    for (const [packageId, addOnId] of mappings) {
      await queryInterface.sequelize.query(`
        INSERT IGNORE INTO package_addons_map (package_id, addon_id)
        VALUES (${packageId}, ${addOnId})
      `);
    }
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('packages', 'uq_packages_service_name').catch(() => {});
    await queryInterface.bulkDelete('package_addons_map', {});
    await queryInterface.bulkDelete('package_features', {});
    await queryInterface.bulkDelete('packages', {});
    await queryInterface.bulkDelete('add_ons', {});
    // keep services as they may be used elsewhere
  }
};

