const { HttpError } = require('../utils/httpError');
const { ensureAbsoluteUrl } = require('../utils/fileUpload');
const {
  createVehicleWithImages,
  listVehiclesByUserId,
  getVehicleForUser,
  updateVehicleForUser,
  updateVehicleWithOptionalImages,
  deleteVehicleForUser,
  setDefaultVehicleForUser
} = require('../services/vehicle.service');

function getAuthUserIdOrThrow(req) {
  const userId = req.auth?.userId;
  if (!userId) throw new HttpError(401, 'Unauthorized');
  return userId;
}

function pickImageFiles(req) {
  if (!req.files) return [];
  if (Array.isArray(req.files)) return req.files;
  const a = req.files.images || req.files['images[]'];
  if (!a) return [];
  return Array.isArray(a) ? a : [a];
}

function toVehicleJson(req, vehicle) {
  if (!vehicle) return null;
  const v = vehicle.get ? vehicle.get({ plain: true }) : vehicle;
  const { images: rawImages, ...rest } = v;
  const images = (rawImages || []).map((img) => {
    const p = img.image_path;
    return {
      id: img.id,
      image_path: p,
      url: ensureAbsoluteUrl(req, p)
    };
  });
  return { ...rest, images };
}

async function create(req, res, next) {
  try {
    const userId = getAuthUserIdOrThrow(req);
    const files = pickImageFiles(req);
    const vehicle = await createVehicleWithImages(req, { userId, body: req.body, files });
    return res.success('Vehicle created', toVehicleJson(req, vehicle));
  } catch (err) {
    return next(err);
  }
}

async function list(req, res, next) {
  try {
    const userId = getAuthUserIdOrThrow(req);
    const rows = await listVehiclesByUserId(userId);
    return res.success('Vehicles fetched', rows.map((v) => toVehicleJson(req, v)));
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const userId = getAuthUserIdOrThrow(req);
    const vehicleId = Number.parseInt(req.params.id, 10);
    const vehicle = await getVehicleForUser({ userId, vehicleId });
    return res.success('Vehicle fetched', toVehicleJson(req, vehicle));
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const userId = getAuthUserIdOrThrow(req);
    const vehicleId = Number.parseInt(req.params.id, 10);
    const files = pickImageFiles(req);
    const vehicle =
      files.length > 0
        ? await updateVehicleWithOptionalImages(req, { userId, vehicleId, body: req.body, files })
        : await updateVehicleForUser({ userId, vehicleId, body: req.body });
    return res.success('Vehicle updated', toVehicleJson(req, vehicle));
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const userId = getAuthUserIdOrThrow(req);
    const vehicleId = Number.parseInt(req.params.id, 10);
    await deleteVehicleForUser({ userId, vehicleId });
    return res.success('Vehicle deleted', {});
  } catch (err) {
    return next(err);
  }
}

async function setDefault(req, res, next) {
  try {
    const userId = getAuthUserIdOrThrow(req);
    const vehicleId = Number.parseInt(req.params.id, 10);
    const vehicle = await setDefaultVehicleForUser({ userId, vehicleId });
    return res.success('Default vehicle updated', toVehicleJson(req, vehicle));
  } catch (err) {
    return next(err);
  }
}

async function catalog(_req, res, next) {
  try {
    const { getVehicleCatalog } = require('../constants/vehicleCatalog');
    return res.success('Vehicle catalog fetched', getVehicleCatalog());
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  create,
  list,
  catalog,
  getById,
  update,
  remove,
  setDefault
};
