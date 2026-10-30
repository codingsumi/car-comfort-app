const { HttpError } = require('../../utils/httpError');
const reviewModerationService = require('../../services/reviewModeration.service');
const moderationDashboardService = require('../../services/moderationDashboard.service');
const platformReportsService = require('../../services/platformReports.service');
const supportTicketsService = require('../../services/supportTickets.service');
const faqAdminService = require('../../services/faqAdmin.service');
const moderationLogService = require('../../services/moderationLog.service');
const { bufferToWebp, saveWebpFile } = require('../../utils/fileUpload');

function getClientIp(req) {
  return platformReportsService.getClientIp(req);
}

async function getReviewStats(req, res, next) {
  try {
    const stats = await reviewModerationService.getReviewStats();
    return res.success('Review stats', stats);
  } catch (e) {
    return next(e);
  }
}

async function getDashboard(req, res, next) {
  try {
    const data = await moderationDashboardService.getModerationDashboardSummary({
      dateFrom: req.query.date_from,
      dateTo: req.query.date_to,
    });
    return res.success('Moderation dashboard', data);
  } catch (e) {
    return next(e);
  }
}

async function listReviews(req, res, next) {
  try {
    const result = await reviewModerationService.listReviews(req.query);
    return res.success('Reviews', result);
  } catch (e) {
    return next(e);
  }
}

async function getReview(req, res, next) {
  try {
    const data = await reviewModerationService.getReviewDetail(req.params.id);
    return res.success('Review detail', data);
  } catch (e) {
    return next(e);
  }
}

async function patchReviewStatus(req, res, next) {
  try {
    const { status, reason, moderation_notes } = req.body;
    const review = await reviewModerationService.updateModerationStatus(req.params.id, {
      status,
      reason,
      moderation_notes,
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('Review updated', review);
  } catch (e) {
    return next(e);
  }
}

async function patchReviewEdit(req, res, next) {
  try {
    const { message } = req.body;
    const review = await reviewModerationService.editReviewContent(req.params.id, {
      message,
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('Review edited', review);
  } catch (e) {
    return next(e);
  }
}

async function postReviewResponse(req, res, next) {
  try {
    const { response } = req.body;
    const review = await reviewModerationService.respondToReview(req.params.id, {
      response,
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('Review response posted', review);
  } catch (e) {
    return next(e);
  }
}

async function deleteReviewResponse(req, res, next) {
  try {
    const review = await reviewModerationService.deleteAdminResponse(req.params.id, {
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('Review response deleted', review);
  } catch (e) {
    return next(e);
  }
}

async function listReports(req, res, next) {
  try {
    const result = await platformReportsService.listReports(req.query);
    return res.success('Reports', result);
  } catch (e) {
    return next(e);
  }
}

async function getReport(req, res, next) {
  try {
    const data = await platformReportsService.getReportById(req.params.id);
    return res.success('Report', data);
  } catch (e) {
    return next(e);
  }
}

async function patchReportStatus(req, res, next) {
  try {
    const report = await platformReportsService.updateReportStatus(req.params.id, req.body, {
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('Report updated', report);
  } catch (e) {
    return next(e);
  }
}

async function postReportNote(req, res, next) {
  try {
    const row = await platformReportsService.addReportNote(
      req.params.id,
      { note: req.body.note, is_internal: req.body.is_internal },
      { adminId: req.auth.userId, ipAddress: getClientIp(req) }
    );
    return res.success('Note added', row, 201);
  } catch (e) {
    return next(e);
  }
}

async function listSupportTickets(req, res, next) {
  try {
    const result = await supportTicketsService.listTicketsForAdmin(req.query);
    return res.success('Tickets', result);
  } catch (e) {
    return next(e);
  }
}

async function getSupportTicket(req, res, next) {
  try {
    const data = await supportTicketsService.getTicketById(req.params.id, {
      messagesPage: req.query.messages_page,
      messagesLimit: req.query.messages_limit,
    });
    return res.success('Ticket', data);
  } catch (e) {
    return next(e);
  }
}

async function postSupportReply(req, res, next) {
  try {
    const ticketId = req.params.id;
    const message = req.body.message;
    const internal_note = req.body.internal_note === true || req.body.internal_note === 'true';

    if (!internal_note) {
      throw new HttpError(
        410,
        'Public ticket replies are sent in real time via Firebase. Use the live chat panel in the admin UI.'
      );
    }

    const attachments = [];
    const files = req.files || [];
    const adminSupportCtrl = require('./adminSupport.controller');
    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      const url = await adminSupportCtrl.saveSupportAttachment(file, ticketId, req);
      if (url) attachments.push(url);
    }

    const msg = await supportTicketsService.appendMessage(
      ticketId,
      {
        senderId: req.auth.userId,
        senderRole: 'admin',
        message,
        attachments: attachments.length ? attachments : null,
        internal_note,
      },
      { adminId: req.auth.userId, ipAddress: getClientIp(req) }
    );

    return res.success('Reply sent', msg, 201);
  } catch (e) {
    return next(e);
  }
}

async function patchSupportTicketStatus(req, res, next) {
  try {
    const ticket = await supportTicketsService.updateTicketStatus(req.params.id, req.body, {
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('Ticket updated', ticket);
  } catch (e) {
    return next(e);
  }
}

async function listFaqs(req, res, next) {
  try {
    const result = await faqAdminService.listFaqs(req.query);
    return res.success('FAQs', result);
  } catch (e) {
    return next(e);
  }
}

async function postFaqCategory(req, res, next) {
  try {
    const row = await faqAdminService.createCategory(req.body);
    return res.success('Category created', row, 201);
  } catch (e) {
    return next(e);
  }
}

async function postFaq(req, res, next) {
  try {
    const row = await faqAdminService.createFaq(req.body, {
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('FAQ created', row, 201);
  } catch (e) {
    return next(e);
  }
}

async function patchFaq(req, res, next) {
  try {
    const row = await faqAdminService.updateFaq(req.params.id, req.body, {
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('FAQ updated', row);
  } catch (e) {
    return next(e);
  }
}

async function deleteFaq(req, res, next) {
  try {
    const result = await faqAdminService.deleteFaq(req.params.id, {
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('FAQ deleted', result);
  } catch (e) {
    return next(e);
  }
}

async function listFaqCategories(req, res, next) {
  try {
    const rows = await faqAdminService.listCategories();
    return res.success('FAQ categories', rows);
  } catch (e) {
    return next(e);
  }
}

async function listModerationLogs(req, res, next) {
  try {
    const result = await moderationLogService.listModerationLogs(req.query);
    return res.success('Moderation logs', result);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  getDashboard,
  getReviewStats,
  listReviews,
  getReview,
  patchReviewStatus,
  patchReviewEdit,
  postReviewResponse,
  deleteReviewResponse,
  listReports,
  getReport,
  patchReportStatus,
  postReportNote,
  listSupportTickets,
  getSupportTicket,
  postSupportReply,
  patchSupportTicketStatus,
  listFaqs,
  listFaqCategories,
  postFaqCategory,
  postFaq,
  patchFaq,
  deleteFaq,
  listModerationLogs,
};
