const { Op, fn, col, literal, where } = require("sequelize");
const db = require("../../models");
const { HttpError } = require("../../utils/httpError");
const { formatBookingImagesForResponse } = require("../../utils/bookingImages");
const { ensureAbsoluteUrl } = require("../../utils/fileUpload");
const { handleBookingStatusWalletTransition } = require("../../services/providerWallet.service");
const { cancelBookingAsAdmin } = require("../../services/bookingCancellation.service");
const { getStripe } = require("../../config/stripe");
const { logger } = require("../../config/logger");
const { emitAdminEvent } = require("../../modules/realtime/adminSocketEmitter");
const { captureBookingChatOnCompletion } = require("../../services/bookingChat.service");
const {
  buildServiceNotesResponse,
  resolveEvAccountCardOnFile,
  stripLegacyEvAccountCardMarker,
} = require("../../constants/bookingServiceNotes");
const { generateBookingRecordPdf } = require("../../services/invoice.service");
const {
  notifyBookingEdited,
  notifyRefundProcessed,
  notifyDisputeOpened,
  notifyDisputeResolved,
  notifyBookingStatusChanged,
} = require("../../services/adminBookingNotify.service");
const { emitToCustomer } = require("../../modules/realtime/customerSocketEmitter");
const { emitToDriver } = require("../../modules/realtime/newBookingSocketEmitter");

// A booking is created before Stripe confirms payment. If checkout fails or is
// abandoned, it remains pending_payment; keep that temporary record out of the
// admin booking list after 24 hours without hiding real booking history.
const PENDING_PAYMENT_RETENTION_MS = 24 * 60 * 60 * 1000;

function addRecentPendingPaymentFilter(andConditions) {
  const cutoff = new Date(Date.now() - PENDING_PAYMENT_RETENTION_MS);
  andConditions.push({
    [Op.or]: [
      { status: { [Op.ne]: "pending_payment" } },
      { status: "pending_payment", updated_at: { [Op.gte]: cutoff } },
    ],
  });
}

function buildMergedBookingTimeline(timelineRows = [], trackingLogRows = []) {
  const adminEvents = (timelineRows || []).map((row) => ({
    id: row.id,
    source: "admin",
    event_type: row.event_type,
    message: row.message,
    actor_type: row.actor_type,
    actor_id: row.actor_id,
    metadata: row.metadata,
    created_at: row.created_at,
  }));

  const trackingEvents = (trackingLogRows || []).map((row) => ({
    id: row.id,
    source: "tracking",
    event_type: row.tracking_status,
    message: row.message || row.tracking_status?.replace(/_/g, " "),
    actor_type: "provider",
    actor_id: row.metadata?.driver_user_id ?? null,
    metadata: row.metadata,
    created_at: row.created_at,
  }));

  return [...adminEvents, ...trackingEvents].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

const BOOKING_MODEL = "Booking";

function bookingCol(column) {
  return col(`${BOOKING_MODEL}.${column}`);
}

/** Service date for filters — qualify with Sequelize model alias (not table name). */
function bookingServiceDateExpr() {
  return fn(
    "COALESCE",
    bookingCol("service_datetime"),
    bookingCol("scheduled_at"),
    bookingCol("created_at")
  );
}

function buildBookingDateFilter(fromDate, toDate) {
  const dateField = bookingServiceDateExpr();
  const conditions = [];

  if (fromDate) {
    conditions.push(where(dateField, { [Op.gte]: new Date(fromDate) }));
  }
  if (toDate) {
    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);
    conditions.push(where(dateField, { [Op.lte]: endDate }));
  }

  return conditions;
}

function buildBookingListOrder(sortField, sortOrder) {
  const direction = sortOrder === "asc" ? "ASC" : "DESC";

  if (sortField === "scheduled_at" || sortField === "service_datetime") {
    // Subquery + joins: Booking.created_at cannot be used in ORDER; tie-break with unqualified created_at.
    return [
      [fn("COALESCE", bookingCol("service_datetime"), bookingCol("scheduled_at")), direction],
      ["created_at", direction],
    ];
  }

  if (sortField === "booking_code") {
    return [[bookingCol("id"), direction]];
  }

  if (sortField === "created_at") {
    return [["created_at", direction]];
  }

  return [[bookingCol(sortField), direction]];
}

async function logTimeline(bookingId, eventType, message, actorType, actorId, metadata) {
  try {
    await db.BookingTimeline.create({
      booking_id: bookingId,
      event_type: eventType,
      message,
      actor_type: actorType,
      actor_id: actorId,
      metadata: metadata || null,
    });
  } catch (err) {
    logger.warn("Failed to log timeline event", { bookingId, eventType, error: err?.message });
  }
}

async function logAudit(adminId, actionType, entityType, entityId, details, ip) {
  try {
    await db.AdminAuditLog.create({
      admin_id: adminId,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      details,
      ip_address: ip,
    });
  } catch (err) {
    logger.warn("Failed to log audit", { adminId, actionType, error: err?.message });
  }
}

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────

async function getDashboardStats(req, res, next) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const baseWhere = { status: { [Op.ne]: "draft" }, test_archived_at: null };
    const recentPendingPayment = {
      [Op.or]: [
        { status: { [Op.ne]: "pending_payment" } },
        { status: "pending_payment", updated_at: { [Op.gte]: new Date(Date.now() - PENDING_PAYMENT_RETENTION_MS) } },
      ],
    };
    const todayWhere = {
      ...baseWhere,
      created_at: { [Op.gte]: today, [Op.lt]: tomorrow },
      [Op.and]: [recentPendingPayment],
    };

    const [
      totalToday,
      pendingCount,
      activeCount,
      // All-time counts (what the cards display)
      completedAll,
      cancelledAll,
      disputedCount,
      revenueAll,
      // Today-only counts (kept for backward compat / future use)
      completedToday,
      cancelledToday,
      revenueToday,
    ] = await Promise.all([
      db.Booking.count({ where: todayWhere }),
      db.Booking.count({
        where: {
          ...baseWhere,
          status: { [Op.in]: ["pending_payment", "confirmed"] },
          [Op.and]: [recentPendingPayment],
        },
      }),
      db.Booking.count({ where: { ...baseWhere, status: { [Op.in]: ["assigned", "in_progress"] } } }),
      // All-time
      db.Booking.count({ where: { status: "completed", test_archived_at: null } }),
      db.Booking.count({ where: { status: { [Op.in]: ["cancelled", "refunded", "failed"] }, test_archived_at: null } }),
      db.Booking.count({ where: { ...baseWhere, status: "disputed" } }),
      db.Booking.sum("total_price", { where: { status: "completed", test_archived_at: null } }),
      // Today-only
      db.Booking.count({ where: { ...todayWhere, status: "completed" } }),
      db.Booking.count({ where: { ...todayWhere, status: { [Op.in]: ["cancelled", "refunded", "failed"] } } }),
      db.Booking.sum("total_price", { where: { ...todayWhere, status: "completed" } }),
    ]);

    return res.success("Dashboard stats fetched", {
      total_today: totalToday,
      pending: pendingCount,
      active: activeCount,
      // All-time (used by stat cards)
      completed: completedAll,
      cancelled: cancelledAll,
      disputed: disputedCount,
      total_revenue: parseFloat(revenueAll || 0),
      // Today-only (kept for reference)
      completed_today: completedToday,
      cancelled_today: cancelledToday,
      revenue_today: parseFloat(revenueToday || 0),
    });
  } catch (err) {
    return next(err);
  }
}

// ─── LIST BOOKINGS ────────────────────────────────────────────────────────────

async function listBookings(req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      payment_status,
      service_type,
      from_date,
      to_date,
      customer_id,
      provider_id,
      city,
      amount_min,
      amount_max,
      include_abandoned,
      include_archived,
      sort = "created_at",
      order = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = { status: { [Op.ne]: "draft" } };
    where.test_archived_at = String(include_archived || "").toLowerCase() === "true"
      ? { [Op.ne]: null }
      : null;
    const andConditions = [];
    if (String(include_abandoned || "").toLowerCase() !== "true") {
      addRecentPendingPaymentFilter(andConditions);
    }

    if (status) {
      const statusList = String(status).split(',').map((s) => s.trim()).filter(Boolean);
      if (statusList.length === 1) {
        where.status = statusList[0];
      } else if (statusList.length > 1) {
        where.status = { [Op.in]: statusList };
      }
    }

    if (service_type) {
      where.service_type = service_type;
    }

    if (from_date || to_date) {
      andConditions.push(...buildBookingDateFilter(from_date, to_date));
    }

    if (customer_id) {
      where.user_id = customer_id;
    }
    if (provider_id) {
      where.assigned_driver_user_id = provider_id;
    }

    if (amount_min) {
      where.total_price = { ...(where.total_price || {}), [Op.gte]: parseFloat(amount_min) };
    }
    if (amount_max) {
      where.total_price = { ...(where.total_price || {}), [Op.lte]: parseFloat(amount_max) };
    }

    if (city) {
      andConditions.push({
        [Op.or]: [
          { address: { [Op.like]: `%${city}%` } },
          { service_address: { [Op.like]: `%${city}%` } },
        ],
      });
    }

    const includeConfig = [
      { model: db.User, as: "user", attributes: ["id", "name", "email", "phone"] },
      { model: db.User, as: "assigned_driver", attributes: ["id", "name", "email", "phone"] },
      { model: db.Vehicle, as: "vehicle", attributes: ["id", "make", "model", "year", "color", "license_plate"] },
      { model: db.Package, as: "package", attributes: ["id", "name"] },
      {
        model: db.BookingTransaction,
        as: "transactions",
        attributes: ["id", "status", "amount"],
        required: false,
      },
    ];

    if (search) {
      const term = String(search).trim();
      if (term) {
        const codeTerm = term.replace(/^#/, "");
        const like = `%${term}%`;
        const codeLike = `%${codeTerm}%`;
        andConditions.push({
          [Op.or]: [
            { booking_code: { [Op.like]: codeLike } },
            { address: { [Op.like]: like } },
            { service_address: { [Op.like]: like } },
            { "$user.name$": { [Op.like]: like } },
            { "$user.email$": { [Op.like]: like } },
            { "$user.phone$": { [Op.like]: like } },
            { "$assigned_driver.name$": { [Op.like]: like } },
            { "$assigned_driver.email$": { [Op.like]: like } },
            { "$assigned_driver.phone$": { [Op.like]: like } },
            { "$vehicle.make$": { [Op.like]: like } },
            { "$vehicle.model$": { [Op.like]: like } },
            { "$vehicle.license_plate$": { [Op.like]: like } },
          ],
        });
      }
    }

    if (andConditions.length) {
      where[Op.and] = andConditions;
    }

    if (payment_status) {
      includeConfig[4].where = { status: payment_status };
      includeConfig[4].required = true;
    }

    const validSortFields = ["created_at", "total_price", "status", "booking_code", "scheduled_at", "service_datetime", "id"];
    const sortField = validSortFields.includes(sort) ? sort : "created_at";
    const sortOrder = order === "asc" ? "asc" : "desc";

    const result = await db.Booking.findAndCountAll({
      where,
      include: includeConfig,
      order: buildBookingListOrder(sortField, sortOrder),
      limit: limitNum,
      offset,
      distinct: true,
      subQuery: Boolean(search) ? false : undefined,
    });

    return res.success("Bookings fetched", {
      rows: result.rows,
      count: result.count,
      totalPages: Math.ceil(result.count / limitNum),
      currentPage: pageNum,
    });
  } catch (err) {
    return next(err);
  }
}

// ─── TEST BOOKING CLEANUP ────────────────────────────────────────────────────

const TEST_BOOKING_DELETE_STATUSES = new Set(["draft", "pending_payment", "failed", "cancelled"]);

async function deleteTestBooking(req, res, next) {
  const bookingId = Number.parseInt(String(req.params.bookingId), 10);
  if (!bookingId) return next(new HttpError(400, "Invalid booking id"));

  const adminId = req.auth.userId;
  const ip = req.ip || req.headers["x-forwarded-for"];
  const transaction = await db.sequelize.transaction();

  try {
    const booking = await db.Booking.findByPk(bookingId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!booking) throw new HttpError(404, "Booking not found");
    if (!TEST_BOOKING_DELETE_STATUSES.has(booking.status)) {
      throw new HttpError(409, "Only cancelled, failed, or unpaid test bookings can be deleted");
    }

    const [protectedPaymentCount, protectedFinanceTransactionCount, refundCount, tipCount, walletEntryCount, disputeCount, reviewCount] =
      await Promise.all([
        db.BookingTransaction.count({
          where: {
            booking_id: bookingId,
            status: { [Op.in]: ["succeeded", "processing", "requires_action"] },
          },
          transaction,
        }),
        db.Transaction.count({
          where: {
            booking_id: bookingId,
            [Op.or]: [
              { status: { [Op.in]: ["succeeded", "processing", "refunded", "partially_refunded"] } },
              { transaction_type: { [Op.in]: ["provider_payout", "manual_payout", "commission_deduction"] } },
            ],
          },
          transaction,
        }),
        db.RefundRequest.count({ where: { booking_id: bookingId }, transaction }),
        db.BookingTip.count({ where: { booking_id: bookingId }, transaction }),
        db.ProviderWalletTransaction.count({ where: { booking_id: bookingId }, transaction }),
        db.BookingDispute.count({ where: { booking_id: bookingId }, transaction }),
        db.Review.count({ where: { booking_id: bookingId }, transaction }),
      ]);

    if (
      protectedPaymentCount || protectedFinanceTransactionCount || refundCount || tipCount ||
      walletEntryCount || disputeCount || reviewCount
    ) {
      throw new HttpError(
        409,
        "This booking has completed payment, payout, refund, dispute, or review history and cannot be deleted"
      );
    }

    // Some older tables did not enforce foreign-key cascades, so remove their
    // test-only rows explicitly before deleting the parent booking.
    await Promise.all([
      db.BookingChatTranscript.destroy({ where: { booking_id: bookingId }, transaction }),
      db.BookingTrackingLog.destroy({ where: { booking_id: bookingId }, transaction }),
      db.DriverLocation.destroy({ where: { booking_id: bookingId }, transaction }),
      db.NotificationState.destroy({ where: { booking_id: bookingId }, transaction }),
      db.NotificationLog.destroy({ where: { booking_id: bookingId }, transaction }),
      db.AppNotification.destroy({ where: { booking_id: bookingId }, transaction }),
      db.BookingTimeline.destroy({ where: { booking_id: bookingId }, transaction }),
      db.BookingImage.destroy({ where: { booking_id: bookingId }, transaction }),
      db.BookingAddonMap.destroy({ where: { booking_id: bookingId }, transaction }),
    ]);
    // Remove non-settled financial test rows in dependency order.
    await db.Transaction.destroy({ where: { booking_id: bookingId }, transaction });
    await db.BookingTransaction.destroy({ where: { booking_id: bookingId }, transaction });
    await booking.destroy({ transaction });
    await transaction.commit();

    await logAudit(adminId, "booking_test_delete", "booking", bookingId, {
      booking_code: booking.booking_code,
      status: booking.status,
    }, ip);
    emitAdminEvent("booking_deleted", { booking_id: bookingId });

    return res.success("Test booking deleted", { booking_id: bookingId });
  } catch (err) {
    await transaction.rollback();
    return next(err);
  }
}

async function archiveTestBooking(req, res, next) {
  const bookingId = Number.parseInt(String(req.params.bookingId), 10);
  if (!bookingId) return next(new HttpError(400, "Invalid booking id"));

  const archived = req.body?.archived !== false;
  const adminId = req.auth.userId;
  const ip = req.ip || req.headers["x-forwarded-for"];
  const transaction = await db.sequelize.transaction();

  try {
    const booking = await db.Booking.findByPk(bookingId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!booking) throw new HttpError(404, "Booking not found");

    await booking.update({
      test_archived_at: archived ? new Date() : null,
      test_archived_by: archived ? adminId : null,
    }, { transaction });
    await transaction.commit();

    await logAudit(adminId, archived ? "booking_archive" : "booking_restore", "booking", bookingId, {
      booking_code: booking.booking_code,
      status: booking.status,
    }, ip);
    emitAdminEvent(archived ? "booking_archived" : "booking_restored", { booking_id: bookingId });

    return res.success(archived ? "Booking archived" : "Booking restored", {
      booking_id: bookingId,
      archived,
    });
  } catch (err) {
    await transaction.rollback();
    return next(err);
  }
}

// ─── GET BOOKING DETAIL ───────────────────────────────────────────────────────

async function loadAdminBookingDetail(bookingId, req = null) {
  const booking = await db.Booking.findByPk(bookingId, {
    include: [
      {
        model: db.User,
        as: "user",
        attributes: ["id", "name", "first_name", "last_name", "email", "phone", "country_code", "profile"],
      },
      {
        model: db.User,
        as: "assigned_driver",
        attributes: ["id", "name", "first_name", "last_name", "email", "phone", "country_code"],
        include: [{ model: db.DriverProfile, as: "driver_profile", attributes: ["id", "profile_picture", "approval_status"] }],
      },
      { model: db.Vehicle, as: "vehicle", include: [{ model: db.VehicleImage, as: "images", required: false }] },
      { model: db.Package, as: "package", include: [{ model: db.Service, as: "service" }] },
      { model: db.BookingTransaction, as: "transactions" },
      { model: db.BookingImage, as: "images" },
      { model: db.Review, as: "reviews", include: [{ model: db.ReviewImage, as: "images" }] },
      { model: db.AddOn, as: "addons" },
      { model: db.BookingDispute, as: "disputes", include: [{ model: db.User, as: "resolver", attributes: ["id", "name"] }] },
      { model: db.BookingTimeline, as: "timeline", separate: true, order: [["created_at", "DESC"]] },
      {
        model: db.BookingTrackingLog,
        as: "tracking_logs",
        separate: true,
        order: [["created_at", "DESC"]],
      },
      { model: db.RefundRequest, as: "refund_requests" },
      { model: db.DriverLocation, as: "driver_locations", limit: 50, order: [["created_at", "DESC"]] },
    ],
  });

  if (!booking) return null;

  const plain = booking.get({ plain: true });
  const { images: _images, tracking_logs: trackingLogs, timeline: timelineRows, ...bookingData } = plain;
  const { service_images } = formatBookingImagesForResponse(req, plain.images);
  const mergedTimeline = buildMergedBookingTimeline(timelineRows, trackingLogs);

  // Older EV bookings stored this status in notes. Keep it available as a
  // dedicated field and do not expose the implementation marker to admins.
  bookingData.ev_account_card_on_file = resolveEvAccountCardOnFile(plain);
  bookingData.notes = stripLegacyEvAccountCardMarker(plain.notes);
  const service_notes = buildServiceNotesResponse({ ...plain, notes: bookingData.notes });

  // Resolve vehicle image paths to absolute URLs
  if (bookingData.vehicle && Array.isArray(bookingData.vehicle.images)) {
    bookingData.vehicle.images = bookingData.vehicle.images.map((img) => ({
      ...img,
      image_url: ensureAbsoluteUrl(req, img.image_path || img.image_url || ''),
    }));
  }

  return {
    booking: { ...bookingData, service_images, service_notes, timeline: mergedTimeline },
    plain,
    mergedTimeline,
  };
}

async function getBooking(req, res, next) {
  try {
    const { bookingId } = req.params;

    const detail = await loadAdminBookingDetail(bookingId, req);
    if (!detail) throw new HttpError(404, "Booking not found");

    const { booking: bookingData } = detail;

    // Get provider rating if assigned
    let providerRating = null;
    if (bookingData.assigned_driver_user_id) {
      const ratingData = await db.Review.findOne({
        attributes: [[fn("AVG", col("rating")), "avg_rating"], [fn("COUNT", col("id")), "review_count"]],
        where: { reviewee_user_id: bookingData.assigned_driver_user_id },
        raw: true,
      });
      providerRating = ratingData;
    }

    return res.success("Booking fetched", {
      booking: bookingData,
      providerRating,
    });
  } catch (err) {
    return next(err);
  }
}

async function exportBookingRecord(req, res, next) {
  try {
    const { bookingId } = req.params;
    const detail = await loadAdminBookingDetail(bookingId, req);
    if (!detail) throw new HttpError(404, "Booking not found");

    const { booking: bookingData, mergedTimeline } = detail;
    const transactions = Array.isArray(bookingData.transactions) ? bookingData.transactions : [];
    const latestTxn = transactions.length
      ? [...transactions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null;
    const paymentStatus =
      latestTxn?.status === "succeeded"
        ? "Paid"
        : latestTxn?.status
          ? String(latestTxn.status).replace(/_/g, " ")
          : null;

    const pdf = await generateBookingRecordPdf({
      booking: bookingData,
      user: bookingData.user,
      vehicle: bookingData.vehicle,
      driver: bookingData.assigned_driver,
      timeline: mergedTimeline,
      paymentStatus,
      latestTransaction: latestTxn,
    });

    const fileId = bookingData.booking_code || bookingData.id;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="booking-record-${fileId}.pdf"`);
    return res.send(pdf);
  } catch (err) {
    return next(err);
  }
}

// ─── EDIT BOOKING (OPS CONTROL) ─────────────────────────────────────────────

/**
 * Admin booking edit — allows changing schedule, service address,
 * provider assignment, and internal notes.
 * Each changed field is validated, diff-logged in the timeline and audit log,
 * and best-effort notifications are dispatched to the customer and provider(s).
 */
async function editBooking(req, res, next) {
  try {
    const { bookingId } = req.params;
    const adminId = req.auth.userId;
    const ip = req.ip || req.headers["x-forwarded-for"];

    const {
      scheduled_at,
      service_address,
      assigned_driver_user_id,
      notes,
    } = req.body;

    // At least one field must be provided
    const hasFields = [
      scheduled_at,
      service_address,
      assigned_driver_user_id,
      notes,
    ].some((v) => v !== undefined && v !== null);

    if (!hasFields) {
      throw new HttpError(400, "At least one field to update is required: scheduled_at, service_address, assigned_driver_user_id, or notes");
    }

    const booking = await db.Booking.findByPk(bookingId, {
      include: [
        { model: db.User, as: "user", attributes: ["id", "name", "first_name", "last_name", "email", "phone"] },
        { model: db.User, as: "assigned_driver", attributes: ["id", "name", "first_name", "last_name", "email", "phone"] },
      ],
    });
    if (!booking) throw new HttpError(404, "Booking not found");

    const nonEditableStatuses = ["completed", "cancelled", "refunded"];
    if (nonEditableStatuses.includes(booking.status)) {
      throw new HttpError(400, `Cannot edit a ${booking.status} booking`);
    }

    const changes = {};
    const timelineMessages = [];
    const auditDetails = {};
    const oldProvider = booking.assigned_driver ? { ...booking.assigned_driver.get({ plain: true }) } : null;
    let newProviderUser = null;

    // ── Validate & apply scheduled_at ─────────────────────────────────────
    if (scheduled_at !== undefined) {
      const newDate = new Date(scheduled_at);
      if (isNaN(newDate.getTime())) {
        throw new HttpError(400, "Invalid scheduled_at: must be a valid ISO 8601 datetime");
      }
      if (newDate <= new Date()) {
        throw new HttpError(400, "scheduled_at must be a future datetime");
      }
      changes.scheduled_at = newDate;
      auditDetails.scheduled_at = { from: booking.scheduled_at, to: newDate };
      timelineMessages.push(`Schedule updated to ${newDate.toISOString()}`);
      booking.scheduled_at = newDate;
      booking.service_datetime = newDate;
    }

    // ── Validate & apply service_address ──────────────────────────────────
    if (service_address !== undefined) {
      if (typeof service_address !== "string" || !service_address.trim()) {
        throw new HttpError(400, "service_address must be a non-empty string");
      }
      if (service_address.trim().length > 500) {
        throw new HttpError(400, "service_address must be 500 characters or fewer");
      }
      const trimmedAddress = service_address.trim();
      changes.service_address = trimmedAddress;
      auditDetails.service_address = { from: booking.service_address, to: trimmedAddress };
      timelineMessages.push(`Service address updated to: ${trimmedAddress}`);
      booking.service_address = trimmedAddress;
    }

    // ── Validate & apply provider assignment ──────────────────────────────
    if (assigned_driver_user_id !== undefined) {
      const newDriverId = assigned_driver_user_id === null ? null : Number(assigned_driver_user_id);

      if (newDriverId !== null) {
        if (!Number.isFinite(newDriverId) || newDriverId <= 0) {
          throw new HttpError(400, "assigned_driver_user_id must be a valid user ID or null");
        }
        // Verify the provider exists and is an approved driver
        const providerUser = await db.User.findByPk(newDriverId, {
          attributes: ["id", "name", "first_name", "last_name", "email", "phone"],
          include: [{
            model: db.DriverProfile,
            as: "driver_profile",
            attributes: ["id", "approval_status"],
            required: true,
          }],
        });
        if (!providerUser) {
          throw new HttpError(400, "Provider not found");
        }
        if (providerUser.driver_profile?.approval_status !== "approved") {
          throw new HttpError(400, "Provider is not approved. Only approved drivers can be assigned.");
        }
        newProviderUser = providerUser.get({ plain: true });
      }

      const oldDriverId = booking.assigned_driver_user_id;
      if (String(oldDriverId) !== String(newDriverId)) {
        changes.provider_changed = true;
        changes.assigned_driver_user_id = newDriverId;
        auditDetails.assigned_driver_user_id = { from: oldDriverId, to: newDriverId };
        const label = newDriverId ? (newProviderUser?.name || `User #${newDriverId}`) : "(unassigned)";
        timelineMessages.push(`Provider changed to: ${label}`);
        booking.assigned_driver_user_id = newDriverId;
        // Promote to assigned if currently just confirmed
        if (newDriverId && booking.status === "confirmed") {
          booking.status = "assigned";
          auditDetails.auto_status = "assigned";
          timelineMessages.push("Status auto-promoted to 'assigned' due to provider assignment");
        }
        if (!newDriverId && booking.status === "assigned") {
          booking.status = "confirmed";
          auditDetails.auto_status = "confirmed";
          timelineMessages.push("Status reverted to 'confirmed' because provider was removed");
        }
      }
    }

    // ── Apply internal notes ───────────────────────────────────────────────
    if (notes !== undefined) {
      if (notes !== null && typeof notes !== "string") {
        throw new HttpError(400, "notes must be a string or null");
      }
      if (typeof notes === "string" && notes.length > 2000) {
        throw new HttpError(400, "notes must be 2000 characters or fewer");
      }
      const trimmedNotes = notes === null ? null : notes.trim();
      auditDetails.notes = { updated: true };
      timelineMessages.push("Internal notes updated");
      booking.notes = trimmedNotes;
    }

    if (timelineMessages.length === 0) {
      // No actual changes after validation (e.g., provider reassigned to same provider)
      return res.success("No changes were made", { booking_id: Number(bookingId) });
    }

    await booking.save();
    await booking.reload();

    // ── Timeline + Audit ───────────────────────────────────────────────────
    await logTimeline(
      bookingId,
      "booking_edited",
      `Admin edited booking: ${timelineMessages.join("; ")}`,
      "admin",
      adminId,
      auditDetails
    );
    await logAudit(adminId, "booking_edit", "booking", bookingId, auditDetails, ip);

    // ── Realtime admin event ───────────────────────────────────────────────
    emitAdminEvent("booking_updated", {
      booking_id: Number(bookingId),
      status: booking.status,
      changes,
      edited_by: "admin",
    });

    // ── Customer + Provider notifications (best-effort, non-blocking) ─────
    notifyBookingEdited({
      bookingId,
      booking: { ...booking.get({ plain: true }), user: booking.user, assigned_driver: booking.assigned_driver },
      changes,
      newProvider: newProviderUser,
      oldProvider: changes.provider_changed ? oldProvider : null,
    }).catch((err) => {
      logger.error("edit_booking_notify_failed", { bookingId, message: err?.message });
    });

    return res.success("Booking updated successfully", {
      booking_id: Number(bookingId),
      status: booking.status,
      changes,
      updated_fields: timelineMessages,
    });
  } catch (err) {
    return next(err);
  }
}

// ─── CANCEL BOOKING ───────────────────────────────────────────────────────────

async function cancelBooking(req, res, next) {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const adminId = req.auth.userId;
    const ip = req.ip || req.headers["x-forwarded-for"];

    if (!reason || !reason.trim()) {
      throw new HttpError(400, "Cancellation reason is required");
    }

    const data = await cancelBookingAsAdmin({
      bookingId,
      reason: reason.trim(),
    });

    await logTimeline(
      bookingId,
      "booking_cancelled",
      `Booking cancelled by admin: ${reason.trim()}`,
      "admin",
      adminId,
      { refund_amount: data.refund_amount, wallet_reversal: data.wallet_reversal }
    );
    await logAudit(adminId, "booking_cancel", "booking", bookingId, { reason: reason.trim() }, ip);

    emitAdminEvent("booking_cancelled", {
      booking_id: Number(bookingId),
      status: "cancelled",
      cancelled_by: "admin",
    });

    // Notify customer + provider via socket
    const cancelledBooking = await db.Booking.findByPk(bookingId);
    if (cancelledBooking) {
      emitToCustomer(cancelledBooking.user_id, "booking_cancelled", {
        booking_id: Number(bookingId),
        status: "cancelled",
        cancelled_by: "admin",
        reason: reason.trim(),
      });
      if (cancelledBooking.assigned_driver_user_id) {
        emitToDriver(cancelledBooking.assigned_driver_user_id, "booking_cancelled", {
          booking_id: Number(bookingId),
          status: "cancelled",
        });
      }
    }

    return res.success("Booking cancelled", data);
  } catch (err) {
    return next(err);
  }
}

// ─── UPDATE BOOKING STATUS ────────────────────────────────────────────────────

async function updateBookingStatus(req, res, next) {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;
    const adminId = req.auth.userId;
    const ip = req.ip || req.headers["x-forwarded-for"];

    const validStatuses = ["confirmed", "assigned", "in_progress", "completed", "cancelled", "failed"];
    if (!status || !validStatuses.includes(status)) {
      throw new HttpError(400, `Invalid status. Must be one of: ${validStatuses.join(", ")}`);
    }

    const booking = await db.Booking.findByPk(bookingId);
    if (!booking) throw new HttpError(404, "Booking not found");

    if (["completed", "cancelled", "refunded"].includes(booking.status)) {
      throw new HttpError(400, `Cannot change status of a ${booking.status} booking`);
    }

    const previousStatus = booking.status;
    booking.status = status;
    if (status === "cancelled") {
      booking.cancelled_by = "admin";
      booking.cancelled_at = new Date();
    }
    await booking.save();
    await booking.reload();

    if (previousStatus !== "completed" && status === "completed") {
      captureBookingChatOnCompletion(bookingId).catch((err) => {
        logger.error("admin_booking_status_chat_capture_failed", { bookingId, message: err?.message });
      });
    }

    await handleBookingStatusWalletTransition({
      booking,
      previousStatus,
      transaction: null,
    });

    await logTimeline(bookingId, "status_changed", `Status changed from ${previousStatus} to ${status}`, "admin", adminId, { from: previousStatus, to: status });
    await logAudit(adminId, "booking_status_update", "booking", bookingId, { from: previousStatus, to: status }, ip);

    emitAdminEvent("booking_updated", {
      booking_id: Number(bookingId),
      status,
      previous_status: previousStatus,
    });

    // Notify customer + provider (best-effort)
    notifyBookingStatusChanged({
      bookingId,
      booking: { ...booking.get({ plain: true }) },
      previousStatus,
      newStatus: status,
    }).catch((err) => {
      logger.error("update_booking_status_notify_failed", { bookingId, message: err?.message });
    });

    return res.success("Booking status updated", { status });
  } catch (err) {
    return next(err);
  }
}

// ─── CREATE DISPUTE ───────────────────────────────────────────────────────────

async function createDispute(req, res, next) {
  try {
    const { bookingId } = req.params;
    const { customer_complaint, admin_notes } = req.body;
    const adminId = req.auth.userId;
    const ip = req.ip || req.headers["x-forwarded-for"];

    const booking = await db.Booking.findByPk(bookingId);
    if (!booking) throw new HttpError(404, "Booking not found");

    const existingDispute = await db.BookingDispute.findOne({
      where: { booking_id: bookingId, status: { [Op.in]: ["open", "investigating"] } },
    });
    if (existingDispute) {
      throw new HttpError(400, "An active dispute already exists for this booking");
    }

    const dispute = await db.BookingDispute.create({
      booking_id: bookingId,
      customer_complaint: customer_complaint || null,
      admin_notes: admin_notes || null,
      status: "open",
    });

    booking.status = "disputed";
    booking.dispute_status = "open";
    await booking.save();

    await logTimeline(bookingId, "dispute_opened", "Dispute opened by admin", "admin", adminId);
    await logAudit(adminId, "dispute_create", "booking", bookingId, { dispute_id: dispute.id }, ip);

    emitAdminEvent("booking_updated", {
      booking_id: Number(bookingId),
      status: "disputed",
      dispute_id: dispute.id,
    });

    // Notify customer + provider (best-effort)
    notifyDisputeOpened({
      bookingId,
      booking: { ...booking.get({ plain: true }) },
      disputeId: dispute.id,
    }).catch((err) => {
      logger.error("create_dispute_notify_failed", { bookingId, message: err?.message });
    });

    return res.success("Dispute created", dispute);
  } catch (err) {
    return next(err);
  }
}

// ─── RESOLVE DISPUTE ──────────────────────────────────────────────────────────

async function resolveDispute(req, res, next) {
  try {
    const { disputeId } = req.params;
    const { status, admin_notes, restore_status } = req.body;
    const adminId = req.auth.userId;
    const ip = req.ip || req.headers["x-forwarded-for"];

    const validStatuses = ["investigating", "resolved", "closed"];
    if (!status || !validStatuses.includes(status)) {
      throw new HttpError(400, `Invalid dispute status. Must be one of: ${validStatuses.join(", ")}`);
    }

    const dispute = await db.BookingDispute.findByPk(disputeId, {
      include: [{ model: db.Booking, as: "booking" }],
    });
    if (!dispute) throw new HttpError(404, "Dispute not found");

    dispute.status = status;
    if (admin_notes) dispute.admin_notes = admin_notes;
    if (["resolved", "closed"].includes(status)) {
      dispute.resolved_by = adminId;
      dispute.resolved_at = new Date();
    }
    await dispute.save();

    const booking = dispute.booking;
    if (booking) {
      booking.dispute_status = status;
      if (["resolved", "closed"].includes(status) && restore_status) {
        booking.status = restore_status;
      }
      await booking.save();
    }

    await logTimeline(booking.id, "dispute_updated", `Dispute ${status}`, "admin", adminId);
    await logAudit(adminId, "dispute_resolve", "dispute", disputeId, { status, admin_notes }, ip);

    // Emit admin realtime event
    emitAdminEvent("booking_updated", {
      booking_id: booking ? Number(booking.id) : null,
      dispute_id: Number(disputeId),
      dispute_status: status,
    });

    // Notify customer if resolved/closed (best-effort)
    if (["resolved", "closed"].includes(status) && booking) {
      notifyDisputeResolved({
        bookingId: booking.id,
        booking: { ...booking.get({ plain: true }) },
        disputeStatus: status,
        adminNotes: admin_notes,
      }).catch((err) => {
        logger.error("resolve_dispute_notify_failed", { disputeId, message: err?.message });
      });
    }

    return res.success("Dispute updated", dispute);
  } catch (err) {
    return next(err);
  }
}

// ─── DISPUTE STATS ────────────────────────────────────────────────────────────

async function getDisputeStats(req, res, next) {
  try {
    const [open, investigating, resolved, closed, total] = await Promise.all([
      db.BookingDispute.count({ where: { status: "open" } }),
      db.BookingDispute.count({ where: { status: "investigating" } }),
      db.BookingDispute.count({ where: { status: "resolved" } }),
      db.BookingDispute.count({ where: { status: "closed" } }),
      db.BookingDispute.count(),
    ]);

    // Average resolution time (hours) for resolved/closed disputes
    const resolvedRows = await db.BookingDispute.findAll({
      where: {
        status: { [Op.in]: ["resolved", "closed"] },
        resolved_at: { [Op.not]: null },
      },
      attributes: ["created_at", "resolved_at"],
      raw: true,
    });

    let avgResolutionHours = null;
    if (resolvedRows.length > 0) {
      const totalMs = resolvedRows.reduce((acc, r) => {
        return acc + (new Date(r.resolved_at) - new Date(r.created_at));
      }, 0);
      avgResolutionHours = Math.round(totalMs / resolvedRows.length / 3600000);
    }

    return res.success("Dispute stats fetched", {
      open,
      investigating,
      resolved,
      closed,
      total,
      avg_resolution_hours: avgResolutionHours,
    });
  } catch (err) {
    return next(err);
  }
}

// ─── LIST DISPUTES ────────────────────────────────────────────────────────────

async function listDisputes(req, res, next) {
  try {
    const { page = 1, limit = 10, status, search, from_date, to_date } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (status) where.status = status;
    if (from_date || to_date) {
      where.created_at = {};
      if (from_date) where.created_at[Op.gte] = new Date(from_date);
      if (to_date) {
        const end = new Date(to_date);
        end.setHours(23, 59, 59, 999);
        where.created_at[Op.lte] = end;
      }
    }

    // Search across booking code, customer name/email, provider name/email
    const bookingWhere = {};
    const andConditions = [];
    if (search && search.trim()) {
      const like = `%${search.trim()}%`;
      andConditions.push({
        [Op.or]: [
          { "$booking.booking_code$": { [Op.like]: like } },
          { "$booking.user.name$": { [Op.like]: like } },
          { "$booking.user.email$": { [Op.like]: like } },
          { "$booking.assigned_driver.name$": { [Op.like]: like } },
          { "$booking.assigned_driver.email$": { [Op.like]: like } },
        ],
      });
    }
    if (andConditions.length) where[Op.and] = andConditions;

    const { count, rows } = await db.BookingDispute.findAndCountAll({
      where,
      include: [
        {
          model: db.Booking,
          as: "booking",
          attributes: ["id", "booking_code", "status", "user_id", "assigned_driver_user_id", "service_type", "total_price", "scheduled_at"],
          include: [
            { model: db.User, as: "user", attributes: ["id", "name", "email", "phone"] },
            { model: db.User, as: "assigned_driver", attributes: ["id", "name", "email", "phone"] },
          ],
          required: !!search,
        },
        { model: db.User, as: "resolver", attributes: ["id", "name"] },
      ],
      order: [[col("BookingDispute.created_at"), "DESC"]],
      limit: limitNum,
      offset,
      distinct: true,
      subQuery: false,
    });

    return res.success("Disputes fetched", {
      rows,
      count,
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum,
    });
  } catch (err) {
    return next(err);
  }
}

// ─── GET DISPUTE DETAIL ───────────────────────────────────────────────────────

async function getDispute(req, res, next) {
  try {
    const { disputeId } = req.params;

    const dispute = await db.BookingDispute.findByPk(disputeId, {
      include: [
        {
          model: db.Booking,
          as: "booking",
          include: [
            { model: db.User, as: "user", attributes: ["id", "name", "email", "phone"] },
            { model: db.User, as: "assigned_driver", attributes: ["id", "name", "email", "phone"] },
          ],
        },
        { model: db.User, as: "resolver", attributes: ["id", "name", "email"] },
      ],
    });

    if (!dispute) throw new HttpError(404, "Dispute not found");

    return res.success("Dispute fetched", dispute);
  } catch (err) {
    return next(err);
  }
}

// ─── PROCESS REFUND ───────────────────────────────────────────────────────────

async function processRefund(req, res, next) {
  try {
    const { bookingId } = req.params;
    const { amount, reason } = req.body;
    const adminId = req.auth.userId;
    const ip = req.ip || req.headers["x-forwarded-for"];

    if (!amount || parseFloat(amount) <= 0) {
      throw new HttpError(400, "Refund amount must be greater than 0");
    }
    if (!reason || !reason.trim()) {
      throw new HttpError(400, "Refund reason is required");
    }

    const booking = await db.Booking.findByPk(bookingId, {
      include: [{ model: db.BookingTransaction, as: "transactions" }],
    });
    if (!booking) throw new HttpError(404, "Booking not found");

    const succeededTx = booking.transactions?.find((tx) => tx.status === "succeeded");
    if (!succeededTx) {
      throw new HttpError(400, "No successful transaction found for this booking");
    }

    const refundAmount = parseFloat(amount);
    const txAmount = parseFloat(succeededTx.amount);
    const existingRefunds = await db.RefundRequest.sum("amount", {
      where: { booking_id: bookingId, status: { [Op.in]: ["approved", "processing", "refunded"] } },
    });
    const totalRefunded = parseFloat(existingRefunds || 0);

    if (refundAmount + totalRefunded > txAmount) {
      throw new HttpError(400, `Refund amount exceeds available balance. Max refundable: $${(txAmount - totalRefunded).toFixed(2)}`);
    }

    // Check for duplicate pending refunds
    const pendingRefund = await db.RefundRequest.findOne({
      where: { booking_id: bookingId, status: { [Op.in]: ["requested", "approved", "processing"] } },
    });
    if (pendingRefund) {
      throw new HttpError(400, "A refund is already being processed for this booking");
    }

    // Process via Stripe
    let stripeRefund = null;
    if (succeededTx.stripe_payment_intent_id) {
      try {
        const stripe = await getStripe();
        stripeRefund = await stripe.refunds.create({
          payment_intent: succeededTx.stripe_payment_intent_id,
          amount: Math.round(refundAmount * 100),
          reason: "requested_by_customer",
          metadata: {
            booking_id: String(bookingId),
            admin_id: String(adminId),
            admin_reason: reason.trim(),
          },
        });
      } catch (stripeErr) {
        logger.error("Stripe refund failed", { bookingId, error: stripeErr?.message });
        throw new HttpError(502, `Stripe refund failed: ${stripeErr?.message || "Unknown error"}`);
      }
    }

    const refundRequest = await db.RefundRequest.create({
      booking_transaction_id: succeededTx.id,
      booking_id: bookingId,
      user_id: booking.user_id,
      amount: refundAmount,
      reason: reason.trim(),
      status: stripeRefund ? "refunded" : "approved",
      stripe_refund_id: stripeRefund?.id || null,
      stripe_payload: stripeRefund || null,
      processed_by: adminId,
      processed_at: new Date(),
    });

    // Update booking refund amount
    booking.refund_amount = parseFloat(booking.refund_amount || 0) + refundAmount;
    if (refundAmount >= txAmount - totalRefunded) {
      booking.status = "refunded";
    }
    await booking.save();

    await logTimeline(bookingId, "refund_processed", `Refund of $${refundAmount.toFixed(2)} processed: ${reason.trim()}`, "admin", adminId, { amount: refundAmount, stripe_refund_id: stripeRefund?.id });
    await logAudit(adminId, "refund_process", "booking", bookingId, { amount: refundAmount, reason: reason.trim(), refund_request_id: refundRequest.id }, ip);

    emitAdminEvent("refund_processed", {
      booking_id: Number(bookingId),
      amount: refundAmount,
      refund_request_id: refundRequest.id,
    });

    // Notify customer (best-effort)
    notifyRefundProcessed({
      bookingId,
      booking: { ...booking.get({ plain: true }), user: booking.user },
      amount: refundAmount,
      reason: reason.trim(),
    }).catch((err) => {
      logger.error("process_refund_notify_failed", { bookingId, message: err?.message });
    });

    const { syncRefund } = require("../../services/transactionSync.service");
    syncRefund({ refundRequest, booking, adminId }).catch(() => {});

    return res.success("Refund processed", refundRequest);
  } catch (err) {
    return next(err);
  }
}

// ─── LIST REFUNDS ─────────────────────────────────────────────────────────────

async function listRefunds(req, res, next) {
  try {
    const { page = 1, limit = 10, status, booking_id } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (status) where.status = status;
    if (booking_id) where.booking_id = booking_id;

    const { count, rows } = await db.RefundRequest.findAndCountAll({
      where,
      include: [
        {
          model: db.BookingTransaction,
          as: "booking_transaction",
          attributes: ["id", "transaction_code", "amount", "stripe_payment_intent_id"],
        },
        { model: db.User, as: "user", attributes: ["id", "name", "email"] },
      ],
      order: [[col("RefundRequest.created_at"), "DESC"]],
      limit: limitNum,
      offset,
    });

    return res.success("Refunds fetched", {
      rows,
      count,
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum,
    });
  } catch (err) {
    return next(err);
  }
}

// ─── GET PROVIDER LOCATION ────────────────────────────────────────────────────

async function getProviderLocation(req, res, next) {
  try {
    const { bookingId } = req.params;

    const locations = await db.DriverLocation.findAll({
      where: { booking_id: bookingId },
      order: [["created_at", "DESC"]],
      limit: 1,
    });

    return res.success("Provider location fetched", locations[0] || null);
  } catch (err) {
    return next(err);
  }
}

// ─── SERVICE DURATION REPORT ─────────────────────────────────────────────────

async function listServiceDurationReport(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const { search, from_date, to_date, provider_id } = req.query;

    const where = {
      status: 'completed',
      service_started_at: { [Op.not]: null },
    };

    if (provider_id) where.assigned_driver_user_id = Number(provider_id);
    if (from_date) where.service_completed_at = { ...where.service_completed_at, [Op.gte]: new Date(from_date) };
    if (to_date) {
      const end = new Date(to_date);
      end.setHours(23, 59, 59, 999);
      where.service_completed_at = { ...(where.service_completed_at || {}), [Op.lte]: end };
    }

    const providerInclude = {
      model: db.User,
      as: 'assigned_driver',
      attributes: ['id', 'name', 'first_name', 'last_name', 'email'],
      required: !!search || !!provider_id,
    };

    if (search) {
      const term = `%${search}%`;
      providerInclude.where = {
        [Op.or]: [
          { name: { [Op.like]: term } },
          { email: { [Op.like]: term } },
          { first_name: { [Op.like]: term } },
          { last_name: { [Op.like]: term } },
        ],
      };
      providerInclude.required = true;
    }

    const { count, rows } = await db.Booking.findAndCountAll({
      where,
      attributes: [
        'id', 'booking_code', 'service_type',
        'service_started_at', 'service_completed_at', 'service_duration_minutes',
        'address', 'service_address', 'ev_charging_address', 'service_location_name',
        'total_price', 'assigned_driver_user_id', 'user_id', 'created_at',
      ],
      include: [
        providerInclude,
        {
          model: db.User,
          as: 'user',
          attributes: ['id', 'name', 'first_name', 'last_name', 'email'],
        },
      ],
      order: [['service_completed_at', 'DESC']],
      limit,
      offset,
    });

    return res.success('Service duration report fetched', {
      records: rows.map((r) => r.get({ plain: true })),
      pagination: {
        total: count,
        page,
        limit,
        total_pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    return next(err);
  }
}

// ─── FLEET MAP ───────────────────────────────────────────────────────────────

/**
 * Returns all active bookings (assigned / in_progress) with the latest
 * provider location so the admin fleet map can render all jobs at once.
 */
async function getFleetMap(req, res, next) {
  try {
    const {
      status,           // comma-separated statuses, default = active only (no historical)
      date_from,        // ISO date string
      date_to,          // ISO date string
      user_id,          // customer user id
      provider_id,      // provider user id
      page = 1,
      limit = 500,
    } = req.query;

    // Define active vs historical statuses
    const ACTIVE_STATUSES = ['pending_payment', 'confirmed', 'assigned', 'in_progress', 'disputed'];
    const ALL_NON_DRAFT_STATUSES = ['pending_payment', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled', 'failed', 'disputed', 'refunded'];

    let where;
    if (status) {
      // Caller explicitly filtered — respect their choice fully
      const statuses = String(status).split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        where = { status: statuses[0] };
      } else {
        where = { status: { [Op.in]: statuses } };
      }
    } else {
      // Default: active bookings only (exclude completed/cancelled/refunded/failed)
      where = { status: { [Op.in]: ACTIVE_STATUSES } };
    }

    // Date range filter
    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at[Op.gte] = new Date(date_from);
      if (date_to) {
        const end = new Date(date_to);
        end.setHours(23, 59, 59, 999);
        where.created_at[Op.lte] = end;
      }
    }

    // Customer filter
    if (user_id) where.user_id = Number(user_id);

    // Provider filter
    if (provider_id) where.assigned_driver_user_id = Number(provider_id);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 500));
    const offset = (pageNum - 1) * limitNum;

    const { count, rows: bookings } = await db.Booking.findAndCountAll({
      where,
      include: [
        {
          model: db.User,
          as: "user",
          attributes: ["id", "name", "first_name", "last_name", "email", "phone"],
        },
        {
          model: db.User,
          as: "assigned_driver",
          attributes: ["id", "name", "first_name", "last_name", "email", "phone"],
          required: false,
        },
        {
          model: db.DriverLocation,
          as: "driver_locations",
          limit: 1,
          order: [["created_at", "DESC"]],
          required: false,
        },
      ],
      order: [["updated_at", "DESC"]],
      limit: limitNum,
      offset,
    });

    const formatName = (u) =>
      [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.name || u.email;

    const rows = bookings.map((b) => {
      const plain = b.get({ plain: true });
      const latestLoc = plain.driver_locations?.[0] || null;
      return {
        id: plain.id,
        booking_code: plain.booking_code ?? null,
        status: plain.status,
        tracking_status: plain.tracking_status ?? null,
        service_type: plain.service_type ?? null,
        scheduled_at: plain.scheduled_at ?? plain.service_datetime ?? null,
        created_at: plain.created_at ?? null,
        address: plain.address ?? plain.service_address ?? plain.ev_charging_address ?? null,
        // Primary customer pickup location (vehicle parked lat/lng)
        customer_lat: plain.latitude ? Number(plain.latitude) : null,
        customer_lng: plain.longitude ? Number(plain.longitude) : null,
        // Service/EV-charging location (may differ from pickup for combo bookings)
        service_lat: plain.service_latitude ? Number(plain.service_latitude) : null,
        service_lng: plain.service_longitude ? Number(plain.service_longitude) : null,
        charging_lat: plain.charging_latitude ? Number(plain.charging_latitude) : null,
        charging_lng: plain.charging_longitude ? Number(plain.charging_longitude) : null,
        total_price: plain.total_price ?? null,
        user: plain.user ? { id: plain.user.id, name: formatName(plain.user), email: plain.user.email, phone: plain.user.phone ?? null } : null,
        provider: plain.assigned_driver ? { id: plain.assigned_driver.id, name: formatName(plain.assigned_driver), email: plain.assigned_driver.email, phone: plain.assigned_driver.phone ?? null } : null,
        provider_lat: latestLoc ? Number(latestLoc.lat) : null,
        provider_lng: latestLoc ? Number(latestLoc.lng) : null,
        provider_location_at: latestLoc?.created_at ?? null,
      };
    });

    // Active bookings = assigned or in_progress (for the live-tracking count)
    const activeCount = rows.filter((r) => ["assigned", "in_progress"].includes(r.status)).length;

    return res.success("Fleet map data fetched", {
      bookings: rows,
      total: count,
      active: activeCount,
      page: pageNum,
      totalPages: Math.ceil(count / limitNum),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getDashboardStats,
  listBookings,
  getBooking,
  deleteTestBooking,
  archiveTestBooking,
  exportBookingRecord,
  editBooking,
  cancelBooking,
  updateBookingStatus,
  createDispute,
  resolveDispute,
  listDisputes,
  getDispute,
  getDisputeStats,
  processRefund,
  listRefunds,
  getProviderLocation,
  listServiceDurationReport,
  getFleetMap,
};
