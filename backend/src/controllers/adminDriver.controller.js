const db = require('../models');
const { HttpError } = require('../utils/httpError');
const {
  sendDriverApproved,
  sendDriverRejected
} = require('../services/lifecycleEmail.service');
const { sendSms } = require('../services/sms.service');

async function getDriverUserOrThrow(userId) {
  const user = await db.User.findByPk(userId);
  if (!user) throw new HttpError(404, 'User not found');
  if (user.role !== 'driver') throw new HttpError(400, 'User is not a service provider');
  return user;
}

async function getProfileOrThrow(userId) {
  const profile = await db.DriverProfile.findOne({ where: { user_id: userId } });
  if (!profile) throw new HttpError(404, 'Service provider profile not found');
  return profile;
}

async function approve(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) throw new HttpError(400, 'Invalid userId');

    const user = await getDriverUserOrThrow(userId);
    const profile = await getProfileOrThrow(userId);

    await profile.update({
      approval_status: 'approved',
      approval_reason: null,
      approved_at: new Date(),
      rejected_at: null
    });

    await sendDriverApproved({ user });

    if (user.phone) {
      const phoneNumber = `${user.country_code || ''}${user.phone}`;
      await sendSms({
        to: phoneNumber,
        text: `Car Comfort: Congratulations! Your service provider profile has been approved. You can now start accepting rides.`
      }).catch(() => {});
    }

    return res.success('Service provider approved', {
      driver_profile: {
        user_id: profile.user_id,
        approval_status: profile.approval_status,
        approval_reason: profile.approval_reason,
        approved_at: profile.approved_at,
        rejected_at: profile.rejected_at
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function reject(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) throw new HttpError(400, 'Invalid userId');

    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) throw new HttpError(400, 'reason is required');

    const user = await getDriverUserOrThrow(userId);
    const profile = await getProfileOrThrow(userId);

    await profile.update({
      approval_status: 'rejected',
      approval_reason: reason,
      approved_at: null,
      rejected_at: new Date()
    });

    await sendDriverRejected({ user, reason });

    if (user.phone) {
      const phoneNumber = `${user.country_code || ''}${user.phone}`;
      await sendSms({
        to: phoneNumber,
        text: `Car Comfort: Your service provider profile was rejected. Reason: ${reason}. Please open the app and resubmit your onboarding data.`
      }).catch(() => {});
    }

    return res.success('Service provider rejected', {
      driver_profile: {
        user_id: profile.user_id,
        approval_status: profile.approval_status,
        approval_reason: profile.approval_reason,
        approved_at: profile.approved_at,
        rejected_at: profile.rejected_at
      }
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  approve,
  reject
};

