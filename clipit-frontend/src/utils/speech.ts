let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices() {
  cachedVoices = window.speechSynthesis.getVoices();
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function langTag(language: string): string {
  return language === 'uk' ? 'uk-UA' : language === 'en' ? 'en-US' : 'ko-KR';
}

/** Speaks text in the given app language, preferring higher-quality voices when available. */
export function speak(text: string, language: string): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langTag(language);
  utterance.rate = 0.9;

  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  const langPrefix = language === 'uk' ? 'uk' : language === 'en' ? 'en' : 'ko';

  const targetVoice =
    voices.find((v) => v.lang.startsWith(langPrefix) && v.name.includes('Google')) ||
    voices.find((v) => v.lang.startsWith(langPrefix) && v.name.includes('Yuna')) ||
    voices.find((v) => v.lang.startsWith(langPrefix) && v.name.includes('Sora')) ||
    voices.find(
      (v) =>
        v.lang.startsWith(langPrefix) &&
        !v.name.includes('Eddy') &&
        !v.name.includes('Rocko') &&
        !v.name.includes('Shelley'),
    ) ||
    voices.find((v) => v.lang.startsWith(langPrefix));

  if (targetVoice) {
    utterance.voice = targetVoice;
  }

  window.speechSynthesis.speak(utterance);
}
