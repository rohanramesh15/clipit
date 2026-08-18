import React, { createContext, useContext, useState, ReactNode } from 'react';

interface HelpContextType {
  isHelpMode: boolean;
  toggleHelpMode: () => void;
  closeHelpMode: () => void;
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [isHelpMode, setIsHelpMode] = useState(false);

  const toggleHelpMode = () => setIsHelpMode((prev) => !prev);
  const closeHelpMode = () => setIsHelpMode(false);

  return (
    <HelpContext.Provider value={{ isHelpMode, toggleHelpMode, closeHelpMode }}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error('useHelp must be used within a HelpProvider');
  }
  return context;
}
