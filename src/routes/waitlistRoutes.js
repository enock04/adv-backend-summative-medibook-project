const express = require('express');
const controller = require('../controllers/waitlistController');

const router = express.Router();

router.route('/').get(controller.listWaitlist).post(controller.joinWaitlist);

module.exports = router;
