const { createCrudRouter } = require('./crudRouter');
const doctorController = require('../controllers/doctorController');
const reportController = require('../controllers/reportController');

const router = createCrudRouter(doctorController);

router.get('/:id/statistics', reportController.doctorStatistics);

module.exports = router;
