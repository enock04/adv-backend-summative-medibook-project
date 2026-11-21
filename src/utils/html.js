const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);

// Safe to place inside an inline <script>: JSON with '<' escaped so '</script>' cannot appear.
const toScriptJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

module.exports = { escapeHtml, toScriptJson };
