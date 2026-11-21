const asyncHandler = require('../utils/asyncHandler');
const { notFound } = require('../utils/httpError');
const { parseId } = require('../utils/validators');

// Shared CRUD handlers for any resource whose model exposes
// create, findAll, findById, update and remove.
const createCrudController = ({ model, label, validate }) => {
  const findOrFail = async (id) => {
    const record = await model.findById(id);
    if (!record) throw notFound(`${label} ${id} not found`);
    return record;
  };

  return {
    create: asyncHandler(async (req, res) => {
      const id = await model.create(validate(req.body));
      res.status(201).location(`${req.baseUrl}/${id}`).json(await model.findById(id));
    }),

    list: asyncHandler(async (req, res) => {
      res.json(await model.findAll());
    }),

    get: asyncHandler(async (req, res) => {
      res.json(await findOrFail(parseId(req.params.id)));
    }),

    update: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      const input = validate(req.body);
      await findOrFail(id);
      await model.update(id, input);
      res.json(await model.findById(id));
    }),

    remove: asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      await findOrFail(id);
      await model.remove(id);
      res.status(204).end();
    }),
  };
};

module.exports = { createCrudController };
