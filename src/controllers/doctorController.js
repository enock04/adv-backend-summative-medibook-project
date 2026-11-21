const doctorModel = require('../models/doctorModel');
const { createCrudController } = require('./crudController');
const { validateDoctorInput } = require('../utils/validators');

module.exports = createCrudController({
  model: doctorModel,
  label: 'Doctor',
  validate: validateDoctorInput,
});
