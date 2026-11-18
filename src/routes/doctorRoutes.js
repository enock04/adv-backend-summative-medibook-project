const express = require('express');
const controller = require('../controllers/doctorController');
const reportController = require('../controllers/reportController');

const router = express.Router();

router.get('/:id/statistics', reportController.doctorStatistics);

router.route('/').get(controller.listDoctors).post(controller.createDoctor);
router
  .route('/:id')
  .get(controller.getDoctor)
  .put(controller.updateDoctor)
  .delete(controller.deleteDoctor);

module.exports = router;
