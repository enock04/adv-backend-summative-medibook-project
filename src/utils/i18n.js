const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', '..', 'locales');
const DEFAULT_LANGUAGE = 'en';

// Loaded once when the module is first required (not per request).
// Adding a language only needs a new JSON file in /locales.
const locales = Object.fromEntries(
  fs
    .readdirSync(LOCALES_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => [
      path.basename(file, '.json'),
      JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8')),
    ])
);

// Anything unsupported or malformed (missing, array, unknown code) falls back to English.
const resolveLanguage = (requested, supported = Object.keys(locales)) => {
  if (typeof requested !== 'string') return DEFAULT_LANGUAGE;
  const code = requested.trim().toLowerCase();
  return supported.includes(code) ? code : DEFAULT_LANGUAGE;
};

const getFeedbackPage = (requested, now = new Date()) => {
  const lang = resolveLanguage(requested);
  return {
    lang,
    text: locales[lang],
    formattedDate: new Intl.DateTimeFormat(lang, { dateStyle: 'full' }).format(now),
    languages: Object.entries(locales).map(([code, locale]) => ({ code, name: locale.languageName })),
  };
};

module.exports = { resolveLanguage, getFeedbackPage, locales };
