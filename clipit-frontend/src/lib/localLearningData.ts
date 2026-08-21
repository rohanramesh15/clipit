// Learning state is deliberately local (for fast FSRS scheduling), but it
// must never cross account boundaries on a shared browser. These keys are
// cleared on logout, session expiry, and when a different Supabase user signs
// in. Visual preferences such as `theme` intentionally do not live here.

const ACTIVE_USER_KEY = 'clipit_active_learning_user';

const LEARNING_STORAGE_KEYS = [
  'deadbird_fsrs_cards',
  'deadbird_review_history',
  'lipit_deleted_cards',
  'deadbird_language',
  'daily_goal',
  'tts_voice',
  'extended_session_date',
  'onboarding_answers',
] as const;

export function clearLocalLearningData() {
  try {
    LEARNING_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(ACTIVE_USER_KEY);
  } catch {
    // Storage can be unavailable in private browsing; auth must still work.
  }
}

/**
 * Makes local learning state belong to exactly one active account. Legacy
 * unscoped state has no trustworthy owner, so it is discarded on first use.
 */
export function activateLocalLearningData(userId: string) {
  try {
    const previousUserId = localStorage.getItem(ACTIVE_USER_KEY);
    if (previousUserId !== userId) clearLocalLearningData();
    localStorage.setItem(ACTIVE_USER_KEY, userId);
  } catch {
    // Storage is a progressive enhancement only.
  }
}
