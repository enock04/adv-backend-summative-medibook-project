const doctorModel = require('../models/doctorModel');
const asyncHandler = require('../utils/asyncHandler');
const { notFound } = require('../utils/httpError');
const { parseId, validateDoctorInput } = require('../utils/validators');

const findOrFail = async (id) => {
  const doctor = await doctorModel.findById(id);
  if (!doctor) throw notFound(`Doctor ${id} not found`);
  return doctor;
};

const createDoctor = asyncHandler(async (req, res) => {
  const input = validateDoctorInput(req.body);
  const id = await doctorModel.create(input);
  res.status(201).location(`/api/doctors/${id}`).json(await doctorModel.findById(id));
});

const listDoctors = asyncHandler(async (req, res) => {
  res.json(await doctorModel.findAll());
});

const getDoctor = asyncHandler(async (req, res) => {
  res.json(await findOrFail(parseId(req.params.id)));
});

const updateDoctor = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const input = validateDoctorInput(req.body);
  await findOrFail(id);
  await doctorModel.update(id, input);
  res.json(await doctorModel.findById(id));
});

const deleteDoctor = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await findOrFail(id);
  await doctorModel.remove(id);
  res.status(204).end();
});

module.exports = { createDoctor, listDoctors, getDoctor, updateDoctor, deleteDoctor };
