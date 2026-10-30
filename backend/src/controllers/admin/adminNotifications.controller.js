const { Op } = require("sequelize");
const db = require("../../models");
const { HttpError } = require("../../utils/httpError");
const {
  getActiveAdminUserIds,
  adminRecipientUserInclude,
  assertAdminRecipientNotification,
} = require("../../utils/adminNotificationScope");

async function listNotifications(req, res, next) {
  try {
    const { page = 1, limit = 10, search, sort = "createdAt", order = "desc", status, type } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const adminIds = await getActiveAdminUserIds();
    if (!adminIds.length) {
      return res.success("Notifications fetched", {
        rows: [],
        count: 0,
        totalPages: 0,
        currentPage: pageNum,
      });
    }

    const where = {
      user_id: { [Op.in]: adminIds },
    };

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { message: { [Op.like]: `%${search}%` } },
      ];
    }

    if (status === "read") where.is_read = true;
    else if (status === "unread") where.is_read = false;

    if (type) where.notification_type = type;

    const { count, rows } = await db.AppNotification.findAndCountAll({
      where,
      include: [adminRecipientUserInclude()],
      order: [["created_at", order === "asc" ? "ASC" : "DESC"]],
      limit: limitNum,
      offset,
      distinct: true,
    });

    return res.success("Notifications fetched", {
      rows,
      count,
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum,
    });
  } catch (err) {
    return next(err);
  }
}

async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;
    const notification = await db.AppNotification.findByPk(id);
    if (!notification) throw new HttpError(404, "Notification not found");
    if (!(await assertAdminRecipientNotification(notification))) {
      throw new HttpError(404, "Notification not found");
    }

    await notification.update({ is_read: true });
    return res.success("Notification marked as read");
  } catch (err) {
    return next(err);
  }
}

async function markAllAsRead(req, res, next) {
  try {
    const adminIds = await getActiveAdminUserIds();
    if (!adminIds.length) {
      return res.success("All notifications marked as read");
    }

    await db.AppNotification.update(
      { is_read: true },
      { where: { is_read: false, user_id: { [Op.in]: adminIds } } }
    );
    return res.success("All notifications marked as read");
  } catch (err) {
    return next(err);
  }
}

async function deleteNotification(req, res, next) {
  try {
    const { id } = req.params;
    const notification = await db.AppNotification.findByPk(id);
    if (!notification) throw new HttpError(404, "Notification not found");
    if (!(await assertAdminRecipientNotification(notification))) {
      throw new HttpError(404, "Notification not found");
    }

    await notification.destroy();
    return res.success("Notification deleted");
  } catch (err) {
    return next(err);
  }
}

module.exports = { listNotifications, markAsRead, markAllAsRead, deleteNotification };
