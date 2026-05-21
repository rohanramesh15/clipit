import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ReviewSessionState {
  isActive: boolean;
  sessionCap: number;
  cardsReviewed: number;
  sessionReviewed: number;
  isCapReached: boolean;
  isExtended: boolean;
}

interface ReviewSessionContextType {
  session: ReviewSessionState;
  startSession: () => void;
  endSession: () => void;
  recordCardReview: () => boolean; // Returns true if cap was just reached
  extendSession: () => void;
  resetSession: () => void;
  setCardsReviewedToday: (count: number) => void;
  getGoalLabel: () => string;
}

const ReviewSessionContext = createContext<ReviewSessionContextType | undefined>(undefined);

// Get today's date key for localStorage
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

// Check if session was extended today
function wasExtendedToday(): boolean {
  const stored = localStorage.getItem('extended_session_date');
  return stored === getTodayKey();
}

// Mark session as extended for today
function markExtendedToday(): void {
  localStorage.setItem('extended_session_date', getTodayKey());
}

// Get daily goal from localStorage and convert to card cap
function getSessionCap(): number {
  const stored = localStorage.getItem('daily_goal');
  const minutes = stored ? parseInt(stored, 10) : 15;

  // Convert daily goal (minutes) to card cap
  switch (minutes) {
    case 5: return 10;
    case 15: return 30;
    case 30: return 60;
    case 60: return 120;
    default: return 30; // Default to 15 min = 30 cards
  }
}

// Get goal label for display
function getGoalLabelFromStorage(): string {
  const stored = localStorage.getItem('daily_goal');
  const minutes = stored ? parseInt(stored, 10) : 15;

  switch (minutes) {
    case 5: return '10 cards';
    case 15: return '30 cards';
    case 30: return '60 cards';
    case 60: return '120 cards';
    default: return '30 cards';
  }
}

export function ReviewSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ReviewSessionState>({
    isActive: false,
    sessionCap: getSessionCap(),
    cardsReviewed: 0,
    sessionReviewed: 0,
    isCapReached: false,
    isExtended: wasExtendedToday(),
  });

  const startSession = useCallback(() => {
    setSession(prev => ({
      ...prev,
      isActive: true,
      sessionCap: getSessionCap(),
      isExtended: wasExtendedToday(),
      sessionReviewed: 0,
      isCapReached: false,
    }));
  }, []);

  const endSession = useCallback(() => {
    setSession(prev => ({
      ...prev,
      isActive: false,
    }));
  }, []);

  // Record a card review, returns true if cap was just reached
  const recordCardReview = useCallback((): boolean => {
    let capJustReached = false;

    setSession(prev => {
      const newCount = prev.cardsReviewed + 1;
      const newSessionCount = prev.sessionReviewed + 1;

      // Check if cap reached (only if not extended)
      if (!prev.isExtended && prev.cardsReviewed < prev.sessionCap && newCount >= prev.sessionCap) {
        capJustReached = true;
        return {
          ...prev,
          cardsReviewed: newCount,
          sessionReviewed: newSessionCount,
          isCapReached: true,
        };
      }

      return {
        ...prev,
        cardsReviewed: newCount,
        sessionReviewed: newSessionCount,
      };
    });

    return capJustReached;
  }, []);

  const extendSession = useCallback(() => {
    markExtendedToday();
    setSession(prev => ({
      ...prev,
      isExtended: true,
      isCapReached: false,
    }));
  }, []);

  const resetSession = useCallback(() => {
    setSession(prev => ({
      ...prev,
      isActive: false,
      sessionCap: getSessionCap(),
      sessionReviewed: 0,
      isCapReached: false,
      isExtended: wasExtendedToday(),
    }));
  }, []);

  const setCardsReviewedToday = useCallback((count: number) => {
    setSession(prev => ({
      ...prev,
      cardsReviewed: Math.max(0, count),
      isCapReached: !prev.isExtended && count >= prev.sessionCap,
    }));
  }, []);

  const getGoalLabel = useCallback(() => {
    return getGoalLabelFromStorage();
  }, []);

  return (
    <ReviewSessionContext.Provider
      value={{
        session,
        startSession,
        endSession,
        recordCardReview,
        extendSession,
        resetSession,
        setCardsReviewedToday,
        getGoalLabel,
      }}
    >
      {children}
    </ReviewSessionContext.Provider>
  );
}

export function useReviewSession() {
  const context = useContext(ReviewSessionContext);
  if (!context) {
    throw new Error('useReviewSession must be used within a ReviewSessionProvider');
  }
  return context;
}
