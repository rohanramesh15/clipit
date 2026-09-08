import { createContext, useContext, type ReactNode } from 'react';

const EXTENSION_CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/nmlljikicjjjahlaebkdjiiklbhggdmp';

interface ExtensionInstallContextValue {
  openExtensionInstall: () => void;
}

const ExtensionInstallContext = createContext<ExtensionInstallContextValue | null>(null);

export function useExtensionInstall() {
  const context = useContext(ExtensionInstallContext);
  if (!context) throw new Error('useExtensionInstall must be used within ExtensionInstallProvider');
  return context;
}

export function ExtensionInstallProvider({ children }: { children: ReactNode }) {
  const openExtensionInstall = () => window.open(EXTENSION_CHROME_STORE_URL, '_blank', 'noopener,noreferrer');

  return (
    <ExtensionInstallContext.Provider value={{ openExtensionInstall }}>
      {children}
    </ExtensionInstallContext.Provider>
  );
}
