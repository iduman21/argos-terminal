const MESSAGES = {
  en: { error: 'Something went wrong', cacheMiss: 'Cache not ready', badRequest: 'Bad request' },
  tr: { error: 'Bir hata oluştu', cacheMiss: 'Önbellek hazır değil', badRequest: 'Geçersiz istek' },
  ar: { error: 'حدث خطأ', cacheMiss: 'ذاكرة التخزين المؤقت غير جاهزة', badRequest: 'طلب غير صالح' }
};

function pickLang(lang) {
  return (lang || 'en').toLowerCase().split('-')[0];
}

function t(lang, key) {
  const l = pickLang(lang);
  return (MESSAGES[l] && MESSAGES[l][key]) || MESSAGES.en[key] || key;
}

module.exports = { pickLang, t };
