const patientModel = require('../models/patientModel');
const { createCrudController } = require('./crudController');
const { validatePatientInput } = require('../utils/validators');

module.exports = createCrudController({
  model: patientModel,
  label: 'Patient',
  validate: validatePatientInput,
});
