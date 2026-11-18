const patientModel = require('../models/patientModel');
const asyncHandler = require('../utils/asyncHandler');
const { notFound } = require('../utils/httpError');
const { parseId, validatePatientInput } = require('../utils/validators');

const findOrFail = async (id) => {
  const patient = await patientModel.findById(id);
  if (!patient) throw notFound(`Patient ${id} not found`);
  return patient;
};

const createPatient = asyncHandler(async (req, res) => {
  const input = validatePatientInput(req.body);
  const id = await patientModel.create(input);
  res.status(201).location(`/api/patients/${id}`).json(await patientModel.findById(id));
});

const listPatients = asyncHandler(async (req, res) => {
  res.json(await patientModel.findAll());
});

const getPatient = asyncHandler(async (req, res) => {
  res.json(await findOrFail(parseId(req.params.id)));
});

const updatePatient = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const input = validatePatientInput(req.body);
  await findOrFail(id);
  await patientModel.update(id, input);
  res.json(await patientModel.findById(id));
});

const deletePatient = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await findOrFail(id);
  await patientModel.remove(id);
  res.status(204).end();
});

module.exports = { createPatient, listPatients, getPatient, updatePatient, deletePatient };
