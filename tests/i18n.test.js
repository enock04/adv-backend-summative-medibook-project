const { resolveLanguage, getFeedbackPage, locales } = require('../src/utils/i18n');

describe('resolveLanguage', () => {
  test('defaults to English when no language is requested', () => {
    expect(resolveLanguage(undefined)).toBe('en');
  });

  test('accepts a supported language, ignoring case and spaces', () => {
    expect(resolveLanguage('fr')).toBe('fr');
    expect(resolveLanguage(' FR ')).toBe('fr');
  });

  test('falls back to English for an unsupported language', () => {
    expect(resolveLanguage('xx')).toBe('en');
  });

  test('falls back to English for malformed values instead of crashing', () => {
    expect(resolveLanguage(['fr', 'en'])).toBe('en');
    expect(resolveLanguage({ lang: 'fr' })).toBe('en');
    expect(resolveLanguage('__proto__')).toBe('en');
  });
});

describe('getFeedbackPage', () => {
  const fixedDate = new Date(2030, 0, 15, 12, 0, 0);

  test('formats the date for the active locale', () => {
    expect(getFeedbackPage('en', fixedDate).formattedDate).toMatch(/January/);
    expect(getFeedbackPage('fr', fixedDate).formattedDate).toMatch(/janvier/);
  });

  test('returns the translated text for the requested language', () => {
    expect(getFeedbackPage('fr', fixedDate).text.title).toBe(locales.fr.title);
    expect(getFeedbackPage('nope', fixedDate).text.title).toBe(locales.en.title);
  });
});

describe('locale files', () => {
  test.each(Object.keys(locales))('%s has exactly 5 questions and the same keys as English', (code) => {
    expect(locales[code].questions).toHaveLength(5);
    expect(Object.keys(locales[code]).sort()).toEqual(Object.keys(locales.en).sort());
  });
});
