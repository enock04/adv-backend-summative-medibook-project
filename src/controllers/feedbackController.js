const { getFeedbackPage } = require('../utils/i18n');
const { renderFeedback } = require('../views/feedbackView');

const showFeedback = (req, res) => {
  res.type('html').send(renderFeedback(getFeedbackPage(req.query.lang)));
};

module.exports = { showFeedback };
