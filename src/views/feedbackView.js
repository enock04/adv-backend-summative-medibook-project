const { escapeHtml, toScriptJson } = require('../utils/html');

const renderLanguageLinks = (page) =>
  page.languages
    .map(({ code, name }) =>
      code === page.lang
        ? `<strong>${escapeHtml(name)}</strong>`
        : `<a href="/feedback?lang=${encodeURIComponent(code)}">${escapeHtml(name)}</a>`
    )
    .join(' | ');

const renderQuestion = (question, index) => `
      <div class="question">
        <label for="q${index + 1}">${index + 1}. ${escapeHtml(question)}</label>
        <textarea id="q${index + 1}" name="q${index + 1}" rows="4"></textarea>
      </div>`;

const renderFeedback = (page) => `<!DOCTYPE html>
<html lang="${escapeHtml(page.lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.text.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #1f2937; }
    nav { text-align: right; font-size: 0.9rem; }
    .question { margin-bottom: 1.25rem; }
    label { display: block; font-weight: 600; margin-bottom: 0.35rem; }
    textarea { width: 100%; box-sizing: border-box; padding: 0.5rem; font: inherit; }
    button { padding: 0.6rem 1.2rem; font: inherit; cursor: pointer; }
    .date { color: #6b7280; }
  </style>
</head>
<body>
  <nav>${renderLanguageLinks(page)}</nav>
  <h1>${escapeHtml(page.text.title)}</h1>
  <p class="date">${escapeHtml(page.text.dateLabel)}: ${escapeHtml(page.formattedDate)}</p>
  <p>${escapeHtml(page.text.instructions)}</p>
  <form id="feedback-form">${page.text.questions.map(renderQuestion).join('')}
    <button type="submit">${escapeHtml(page.text.submit)}</button>
  </form>
  <script>
    document.getElementById('feedback-form').addEventListener('submit', function (event) {
      event.preventDefault();
      alert(${toScriptJson(page.text.thanks)});
    });
  </script>
</body>
</html>
`;

module.exports = { renderFeedback };
