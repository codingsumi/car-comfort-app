const {
  registerDevice,
  listNotifications,
  deleteNotification,
  deleteAllNotifications,
  sendWelcomeNotification
} = require('../services/notificationsApp.service');

async function postRegisterDevice(req, res, next) {
  try {
    const data = await registerDevice({
      userId: req.auth.userId,
      onesignal_id: req.body.onesignal_id,
      platform: req.body.platform
    });
    res.success('ok', data);
  } catch (e) {
    next(e);
  }
}

async function getList(req, res, next) {
  try {
    const data = await listNotifications({ userId: req.auth.userId, query: req.query });
    res.success('ok', data);
  } catch (e) {
    next(e);
  }
}

async function deleteOne(req, res, next) {
  try {
    const data = await deleteNotification({ userId: req.auth.userId, id: req.params.id });
    res.success('ok', data);
  } catch (e) {
    next(e);
  }
}

async function deleteAll(req, res, next) {
  try {
    const data = await deleteAllNotifications({ userId: req.auth.userId });
    res.success('ok', data);
  } catch (e) {
    next(e);
  }
}

async function postWelcome(req, res, next) {
  try {
    const data = await sendWelcomeNotification({
      userId: req.auth.userId,
      title: req.body.title,
      message: req.body.message
    });
    res.success('ok', data);
  } catch (e) {
    next(e);
  }
}

module.exports = {
  postRegisterDevice,
  getList,
  deleteOne,
  deleteAll,
  postWelcome
};
