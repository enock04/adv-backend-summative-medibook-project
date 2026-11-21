const { createCrudRouter } = require('./crudRouter');
const patientController = require('../controllers/patientController');

module.exports = createCrudRouter(patientController);
