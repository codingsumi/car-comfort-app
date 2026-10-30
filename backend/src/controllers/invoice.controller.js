const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { generateBookingInvoicePdf } = require('../services/invoice.service');

async function getByToken(req, res, next) {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) throw new HttpError(400, 'Invalid token');

    const txn = await db.BookingTransaction.findOne({
      where: { transaction_code: token }
    });
    if (!txn) throw new HttpError(404, 'Invoice not found');

    const booking = await db.Booking.findOne({
      where: { id: txn.booking_id },
      include: [
        { model: db.Vehicle, as: 'vehicle' },
        {
          model: db.User,
          as: 'assigned_driver',
          attributes: ['id', 'first_name', 'last_name', 'name', 'email', 'phone'],
          required: false,
        },
      ],
    });
    if (!booking) throw new HttpError(404, 'Booking not found');

    const user = await db.User.findByPk(txn.user_id);
    if (!user) throw new HttpError(404, 'User not found');

    const bookingPlain = booking.get({ plain: true });

    // Photo counts and payment status — fetched in parallel with the user lookup.
    const [beforePhotoCount, afterPhotoCount] = await Promise.all([
      db.BookingImage.count({
        where: { booking_id: booking.id, image_type: 'before_service' },
      }),
      db.BookingImage.count({
        where: { booking_id: booking.id, image_type: 'after_service' },
      }),
    ]);

    const paymentStatus = txn.status === 'succeeded' ? 'Paid' : null;

    const pdf = await generateBookingInvoicePdf({
      booking: bookingPlain,
      user: user.get({ plain: true }),
      vehicle: bookingPlain.vehicle || null,
      driver: bookingPlain.assigned_driver || null,
      token,
      invoiceId: txn.id,
      paymentStatus,
      beforePhotoCount,
      afterPhotoCount,
    });

    const fileId = booking.booking_code ? String(booking.booking_code) : String(booking.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${fileId}.pdf"`);
    return res.status(200).send(pdf);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getByToken };

