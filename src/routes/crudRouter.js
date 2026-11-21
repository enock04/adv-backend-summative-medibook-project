const express = require('express');

// Standard REST routes for a controller made by createCrudController.
const createCrudRouter = (controller) => {
  const router = express.Router();
  router.route('/').get(controller.list).post(controller.create);
  router
    .route('/:id')
    .get(controller.get)
    .put(controller.update)
    .delete(controller.remove);
  return router;
};

module.exports = { createCrudRouter };
