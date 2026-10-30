'use strict';

const {
  createAuthenticatedRequest,
  sendPublicDeletionOtp,
  submitPublicDeletionRequest
} = require('../services/accountDeletionRequest.service');

async function createMine(req, res, next) {
  try {
    const data = await createAuthenticatedRequest({
      auth: req.auth || {},
      reason: req.body?.reason
    });
    return res.success(
      data.already_pending ? 'Account deletion request is already pending' : 'Account deletion request submitted',
      data
    );
  } catch (err) {
    return next(err);
  }
}

async function sendPublicOtp(req, res, next) {
  try {
    const data = await sendPublicDeletionOtp({
      name: req.body?.name,
      email: req.body?.email
    });
    return res.success('Verification OTP sent', data);
  } catch (err) {
    return next(err);
  }
}

async function submitPublic(req, res, next) {
  try {
    const data = await submitPublicDeletionRequest({
      name: req.body?.name,
      email: req.body?.email,
      otp: req.body?.otp,
      reason: req.body?.reason
    });
    return res.success('Account deletion request submitted', data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { createMine, sendPublicOtp, submitPublic };
