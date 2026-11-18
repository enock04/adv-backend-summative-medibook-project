const express = require('express');
const controller = require('../controllers/appointmentController');

const router = express.Router();

router.post('/', controller.bookAppointment);
router.route('/:id').get(controller.getAppointment).delete(controller.cancelAppointment);

module.exports = router;
