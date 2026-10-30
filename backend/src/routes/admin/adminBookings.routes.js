const express = require("express");
const router = express.Router();
const { adminAuth } = require("../../middlewares/admin/auth/authMiddleware");
const {
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
} = require("../../controllers/admin/adminBookings.controller");

// Dashboard stats
router.get("/bookings/stats", adminAuth, getDashboardStats);

// Fleet map — all active bookings with latest provider locations
router.get("/bookings/fleet-map", adminAuth, getFleetMap);

// Service duration report (must be before :bookingId param route)
router.get("/bookings/service-duration-report", adminAuth, listServiceDurationReport);

// Booking CRUD
router.get("/bookings", adminAuth, listBookings);
router.get("/bookings/:bookingId/export.pdf", adminAuth, exportBookingRecord);
router.get("/bookings/:bookingId", adminAuth, getBooking);
router.delete("/bookings/:bookingId/test", adminAuth, deleteTestBooking);
router.patch("/bookings/:bookingId/test-archive", adminAuth, archiveTestBooking);
router.patch("/bookings/:bookingId/edit", adminAuth, editBooking);
router.patch("/bookings/:bookingId/cancel", adminAuth, cancelBooking);
router.patch("/bookings/:bookingId/status", adminAuth, updateBookingStatus);

// Provider location
router.get("/bookings/:bookingId/location", adminAuth, getProviderLocation);

// Disputes
router.get("/disputes/stats", adminAuth, getDisputeStats);
router.post("/bookings/:bookingId/dispute", adminAuth, createDispute);
router.get("/disputes", adminAuth, listDisputes);
router.get("/disputes/:disputeId", adminAuth, getDispute);
router.patch("/disputes/:disputeId/resolve", adminAuth, resolveDispute);

// Refunds
router.post("/bookings/:bookingId/refund", adminAuth, processRefund);
router.get("/refunds", adminAuth, listRefunds);

module.exports = router;
