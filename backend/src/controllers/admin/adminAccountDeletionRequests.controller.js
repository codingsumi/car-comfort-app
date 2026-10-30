'use strict';

const {
  listAdminDeletionRequests,
  getAdminDeletionRequestStats,
  approveDeletionRequest,
  rejectDeletionRequest
} = require('../../services/accountDeletionRequest.service');

async function list(req, res, next) {
  try {
    const data = await listAdminDeletionRequests(req.query || {});
    return res.success('Account deletion requests fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function approve(req, res, next) {
  try {
    const data = await approveDeletionRequest({
      requestId: req.params.id,
      adminId: req.auth?.userId,
      adminNote: req.body?.admin_note
    });
    return res.success('Account deletion request approved', data);
  } catch (err) {
    return next(err);
  }
}

async function reject(req, res, next) {
  try {
    const data = await rejectDeletionRequest({
      requestId: req.params.id,
      adminId: req.auth?.userId,
      adminNote: req.body?.admin_note
    });
    return res.success('Account deletion request rejected', data);
  } catch (err) {
    return next(err);
  }
}

async function stats(req, res, next) {
  try {
    const data = await getAdminDeletionRequestStats();
    return res.success('Account deletion request stats fetched', data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, stats, approve, reject };
