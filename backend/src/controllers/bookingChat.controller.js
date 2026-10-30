'use strict';

const {
  getBookingChatSession,
  getBookingChatTranscript,
  sendBookingChatNotification,
} = require('../services/bookingChat.service');

async function session(req, res, next) {
  try {
    const data = await getBookingChatSession({
      bookingId: req.params.id,
      auth: req.auth || {},
    });
    return res.success('Booking chat session fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function transcript(req, res, next) {
  try {
    const data = await getBookingChatTranscript({
      bookingId: req.params.id,
      auth: req.auth || {},
    });
    return res.success('Booking chat transcript fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function notify(req, res, next) {
  try {
    const data = await sendBookingChatNotification({
      bookingId: req.params.id,
      auth: req.auth || {},
      messageId: req.body.message_id || req.body.messageId,
      message: req.body.message || req.body.msg,
    });
    return res.success('Booking chat notification processed', data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  session,
  transcript,
  notify,
};
