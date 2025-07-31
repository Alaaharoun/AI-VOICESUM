// Language Configuration for Auto-Detection
// Modify these arrays to change supported languages

// Primary auto-detection languages (recommended: 5-7 languages for best performance)
const PRIMARY_AUTO_DETECT_LANGUAGES = [
  "en-US", "ar-SA", "fr-FR", "es-ES", "de-DE"
];

// Alternative auto-detection languages (fallback if primary fails)
const ALTERNATIVE_AUTO_DETECT_LANGUAGES = [
  "en-US", "ar-SA"
];

// Extended auto-detection languages (more languages, may be slower)
const EXTENDED_AUTO_DETECT_LANGUAGES = [
  "en-US", "ar-SA", "ja-JP", "zh-CN", "hi-IN", "fr-FR", "es-ES", "de-DE"
];

// Popular language combinations
const POPULAR_LANGUAGES = [
  "en-US", "ar-SA", "fr-FR", "es-ES", "de-DE", "it-IT", "pt-BR", "ru-RU"
];

// Asian languages focus
const ASIAN_LANGUAGES = [
  "en-US", "ar-SA", "ja-JP", "zh-CN", "ko-KR", "hi-IN", "th-TH", "vi-VN"
];

// European languages focus
const EUROPEAN_LANGUAGES = [
  "en-US", "ar-SA", "fr-FR", "es-ES", "de-DE", "it-IT", "pt-BR", "ru-RU", "nl-NL", "pl-PL"
];

// Export configurations
module.exports = {
  PRIMARY_AUTO_DETECT_LANGUAGES,
  ALTERNATIVE_AUTO_DETECT_LANGUAGES,
  EXTENDED_AUTO_DETECT_LANGUAGES,
  POPULAR_LANGUAGES,
  ASIAN_LANGUAGES,
  EUROPEAN_LANGUAGES
};

// Usage in server.js:
// const { PRIMARY_AUTO_DETECT_LANGUAGES } = require('./language-config.js');
// const autoDetectLanguages = PRIMARY_AUTO_DETECT_LANGUAGES; 