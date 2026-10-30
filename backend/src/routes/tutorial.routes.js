const express = require('express');
const TutorialController = require('../controllers/tutorial.controller');

const router = express.Router();

router.get('/', TutorialController.getTutorial);
router.get('/driver', TutorialController.getDriverTutorial);
router.get('/videos', TutorialController.listTutorialVideos);

module.exports = router;
