import { createContext, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Puzzle, X } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { Button } from './ui/button';

const EXTENSION_DOWNLOAD_URL = '/downloads/clipit-extension-1.5.6.zip';

interface ExtensionInstallContextValue {
  openExtensionInstall: () => void;
}

const ExtensionInstallContext = createContext<ExtensionInstallContextValue | null>(null);

export function useExtensionInstall() {
  const context = useContext(ExtensionInstallContext);
  if (!context) throw new Error('useExtensionInstall must be used within ExtensionInstallProvider');
  return context;
}

function ExtensionInstallModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dialogRef = useDialogFocus(isOpen, onClose);
  const steps = [
    ['Download the extension', 'Use the download button below to save the ClipIt ZIP file.'],
    ['Unzip the download', 'Open your Downloads folder, then double-click the ZIP on Mac or choose Extract All on Windows.'],
    ['Open Chrome extensions', 'In Chrome, visit chrome://extensions and turn on Developer mode in the top-right corner.'],
    ['Load the unpacked folder', 'Choose Load unpacked and select the folder you just unzipped, not the ZIP file itself.'],
    ['Watch with captions on', 'Stay signed in to ClipIt, then watch a YouTube or Netflix video with captions in your learning language.'],
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="extension-install-title"
            tabIndex={-1}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-subtle bg-app shadow-lg"
          >
            <Button type="button" onClick={onClose} variant="ghost" size="icon" aria-label="Close" className="absolute right-4 top-4 z-10 h-8 w-8 text-muted">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
            <div className="max-h-[calc(100dvh-2.5rem)] overflow-y-auto p-6 sm:p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent" aria-hidden="true">
                <Puzzle className="h-5 w-5" />
              </span>
              <h2 id="extension-install-title" className="mt-4 pr-10 font-heading text-card-title font-medium text-primary">Install the ClipIt extension</h2>

              <div className="mt-5 rounded-xl border border-subtle bg-surface px-4 py-3 text-body-sm text-secondary">
                <span className="font-semibold text-primary">Coming soon to the Chrome Web Store.</span> In the meantime, use the steps below to install the current version manually.
              </div>

              <ol className="mt-6 space-y-4">
                {steps.map(([title, detail], index) => (
                  <li key={title} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-meta font-semibold text-accent">{index + 1}</span>
                    <div>
                      <p className="text-body-sm font-semibold text-primary">{title}</p>
                      <p className="mt-0.5 text-body-sm text-secondary">{detail}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-6 rounded-xl border border-subtle bg-surface px-4 py-3 text-body-sm text-secondary">
                Chrome cannot install the ZIP directly. Select the unzipped folder when you choose <span className="font-semibold text-primary">Load unpacked</span>.
              </div>
              <a
                href={EXTENSION_DOWNLOAD_URL}
                download
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download extension ZIP
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ExtensionInstallProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openExtensionInstall = () => setIsOpen(true);

  return (
    <ExtensionInstallContext.Provider value={{ openExtensionInstall }}>
      {children}
      <ExtensionInstallModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </ExtensionInstallContext.Provider>
  );
}
