const SERVICE_TYPES = ['car_wash', 'ev_charging', 'combo'];

const SERVICE_TYPE_LABELS = {
  car_wash: 'Car Wash',
  ev_charging: 'EV Charging',
  combo: 'EV charging & Car wash',
};

function isValidServiceType(value) {
  return SERVICE_TYPES.includes(String(value || '').trim());
}

function serviceTypeLabel(serviceType) {
  return SERVICE_TYPE_LABELS[serviceType] || serviceType;
}

module.exports = {
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  isValidServiceType,
  serviceTypeLabel,
};
