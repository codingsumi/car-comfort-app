const {
  getTutorialContent,
  AUDIENCE
} = require('../services/tutorialContent.service');
const { listTutorialVideoItems } = require('../services/tutorialVideoItem.service');

async function getTutorial(_req, res, next) {
  try {
    const tutorial = await getTutorialContent(AUDIENCE.CUSTOMER);
    return res.success('Tutorial fetched', tutorial);
  } catch (err) {
    return next(err);
  }
}

async function getDriverTutorial(_req, res, next) {
  try {
    const tutorial = await getTutorialContent(AUDIENCE.DRIVER);
    return res.success('Driver tutorial fetched', tutorial);
  } catch (err) {
    return next(err);
  }
}

async function listTutorialVideos(req, res, next) {
  try {
    const audience = String(req.query.audience || AUDIENCE.CUSTOMER).trim().toLowerCase();
    const data = await listTutorialVideoItems({ audience, publishedOnly: true });
    return res.success('Tutorial videos fetched', data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getTutorial,
  getDriverTutorial,
  listTutorialVideos
};
