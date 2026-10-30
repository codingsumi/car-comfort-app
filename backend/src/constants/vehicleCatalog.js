'use strict';

const VEHICLE_CATALOG_OTHER = 'Other';

const VEHICLE_MAKE_CATALOG = [
  { value: 'acura', label: 'Acura', models: ['ILX', 'Integra', 'MDX', 'RDX', 'TLX'] },
  { value: 'audi', label: 'Audi', models: ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron'] },
  { value: 'bmw', label: 'BMW', models: ['2 Series', '3 Series', '4 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X7', 'i4', 'iX'] },
  { value: 'buick', label: 'Buick', models: ['Enclave', 'Encore', 'Envision', 'LaCrosse', 'Regal'] },
  { value: 'cadillac', label: 'Cadillac', models: ['CT4', 'CT5', 'Escalade', 'XT4', 'XT5', 'XT6', 'Lyriq'] },
  { value: 'chevrolet', label: 'Chevrolet', models: ['Blazer', 'Bolt EV', 'Camaro', 'Colorado', 'Corvette', 'Equinox', 'Malibu', 'Silverado', 'Suburban', 'Tahoe', 'Traverse'] },
  { value: 'chrysler', label: 'Chrysler', models: ['300', 'Pacifica', 'Voyager'] },
  { value: 'dodge', label: 'Dodge', models: ['Challenger', 'Charger', 'Durango', 'Hornet'] },
  { value: 'ford', label: 'Ford', models: ['Bronco', 'Edge', 'Escape', 'Expedition', 'Explorer', 'F-150', 'Fusion', 'Maverick', 'Mustang', 'Ranger'] },
  { value: 'genesis', label: 'Genesis', models: ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80'] },
  { value: 'gmc', label: 'GMC', models: ['Acadia', 'Canyon', 'Sierra', 'Terrain', 'Yukon', 'Hummer EV'] },
  { value: 'honda', label: 'Honda', models: ['Accord', 'Civic', 'CR-V', 'HR-V', 'Odyssey', 'Passport', 'Pilot', 'Ridgeline'] },
  { value: 'hyundai', label: 'Hyundai', models: ['Elantra', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Palisade', 'Santa Fe', 'Sonata', 'Tucson'] },
  { value: 'infiniti', label: 'Infiniti', models: ['Q50', 'Q60', 'QX50', 'QX55', 'QX60', 'QX80'] },
  { value: 'jeep', label: 'Jeep', models: ['Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Renegade', 'Wrangler', 'Wagoneer'] },
  { value: 'kia', label: 'Kia', models: ['EV6', 'EV9', 'Forte', 'K5', 'Niro', 'Seltos', 'Sorento', 'Soul', 'Sportage', 'Telluride'] },
  { value: 'lexus', label: 'Lexus', models: ['ES', 'GX', 'IS', 'LC', 'LS', 'LX', 'NX', 'RC', 'RX', 'RZ', 'TX', 'UX'] },
  { value: 'lincoln', label: 'Lincoln', models: ['Aviator', 'Corsair', 'Nautilus', 'Navigator'] },
  { value: 'mazda', label: 'Mazda', models: ['CX-30', 'CX-5', 'CX-50', 'CX-70', 'CX-90', 'Mazda3', 'MX-5 Miata'] },
  { value: 'mercedes_benz', label: 'Mercedes-Benz', models: ['A-Class', 'C-Class', 'E-Class', 'S-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'EQB', 'EQE', 'EQS'] },
  { value: 'mini', label: 'MINI', models: ['Cooper', 'Countryman'] },
  { value: 'mitsubishi', label: 'Mitsubishi', models: ['Eclipse Cross', 'Mirage', 'Outlander', 'Outlander Sport'] },
  { value: 'nissan', label: 'Nissan', models: ['Altima', 'Armada', 'Frontier', 'Kicks', 'Leaf', 'Maxima', 'Murano', 'Pathfinder', 'Rogue', 'Sentra', 'Titan', 'Versa', 'Z'] },
  { value: 'porsche', label: 'Porsche', models: ['718', '911', 'Cayenne', 'Macan', 'Panamera', 'Taycan'] },
  { value: 'ram', label: 'Ram', models: ['1500', '2500', '3500', 'ProMaster'] },
  { value: 'rivian', label: 'Rivian', models: ['R1S', 'R1T'] },
  { value: 'subaru', label: 'Subaru', models: ['Ascent', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'Solterra', 'WRX'] },
  { value: 'tesla', label: 'Tesla', models: ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck'] },
  { value: 'toyota', label: 'Toyota', models: ['4Runner', 'Camry', 'Corolla', 'Crown', 'GR86', 'Highlander', 'Prius', 'RAV4', 'Sequoia', 'Sienna', 'Tacoma', 'Tundra', 'Venza', 'bZ4X'] },
  { value: 'volkswagen', label: 'Volkswagen', models: ['Atlas', 'Golf', 'ID.4', 'Jetta', 'Passat', 'Taos', 'Tiguan'] },
  { value: 'volvo', label: 'Volvo', models: ['C40', 'EX30', 'EX90', 'S60', 'S90', 'V60', 'V90', 'XC40', 'XC60', 'XC90'] },
];

const VEHICLE_COLOR_PRESETS = [
  'Black',
  'White',
  'Silver',
  'Gray',
  'Charcoal',
  'Pearl White',
  'Red',
  'Burgundy',
  'Maroon',
  'Blue',
  'Navy',
  'Light Blue',
  'Teal',
  'Green',
  'Yellow',
  'Gold',
  'Orange',
  'Brown',
  'Beige',
  'Tan',
  'Champagne',
  'Purple',
  'Pink',
  'Bronze',
  'Copper',
  'Cream',
  'Ivory',
  'Gunmetal',
  'Lime Green',
  'Midnight Blue',
];

function getVehicleCatalog() {
  return {
    other_option: VEHICLE_CATALOG_OTHER,
    makes: VEHICLE_MAKE_CATALOG.map((make) => ({
      value: make.value,
      label: make.label,
      models: [...make.models],
    })),
    colors: [...VEHICLE_COLOR_PRESETS, VEHICLE_CATALOG_OTHER],
  };
}

function findMakeByLabel(label) {
  const key = String(label || '').trim();
  if (!key) return null;
  return VEHICLE_MAKE_CATALOG.find((item) => item.label.toLowerCase() === key.toLowerCase()) || null;
}

module.exports = {
  VEHICLE_CATALOG_OTHER,
  VEHICLE_MAKE_CATALOG,
  VEHICLE_COLOR_PRESETS,
  getVehicleCatalog,
  findMakeByLabel,
};
