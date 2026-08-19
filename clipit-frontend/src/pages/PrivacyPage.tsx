interface PrivacyPageProps {
  onNavigate: (view: 'landing') => void;
}

export function PrivacyPage({ onNavigate }: PrivacyPageProps) {
  return (
    <div className="min-h-screen bg-app text-primary p-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => onNavigate('landing')}
          className="text-accent hover:underline mb-8 inline-block"
        >
          &larr; Back to home
        </button>

        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-secondary mb-6">Last updated: August 2026</p>

        <div className="space-y-8 text-secondary leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-primary mb-4">Overview</h2>
            <p>
              ClipIt ("we", "our", or "us") is a language learning application that helps users learn from YouTube and Netflix videos. This privacy policy explains how we collect, use, and protect your information when you use our browser extension and web application.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary mb-4">Information We Collect</h2>

            <h3 className="text-xl font-medium text-primary mt-4 mb-2">Account Information</h3>
            <p>
              When you create an account, we collect your email address and, if you sign up with email and password, a
              securely encrypted password. If you sign in with Google, we instead receive your name, email address, and
              profile picture from Google. Authentication is handled by our authentication provider, Supabase.
            </p>

            <h3 className="text-xl font-medium text-primary mt-4 mb-2">Learning Data</h3>
            <p>We collect information about your learning activity, including:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Videos you watch and extract vocabulary from (YouTube and Netflix video IDs and titles)</li>
              <li>Vocabulary words you save and review</li>
              <li>Flashcard review history and progress</li>
              <li>Learning streaks and statistics</li>
            </ul>

            <h3 className="text-xl font-medium text-primary mt-4 mb-2">Subtitle Content</h3>
            <p>We process subtitle text from videos to extract vocabulary. This text is used solely for creating your flashcards and is not shared with third parties.</p>

            <h3 className="text-xl font-medium text-primary mt-4 mb-2">Screenshots and Audio Clips (Netflix)</h3>
            <p>
              When you watch Netflix with the extension enabled, it captures short screenshots and audio clips at the
              moments a vocabulary word appears, so your flashcards can include that video context. These clips are
              tied to your account and used only to build your flashcards.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary mb-4">How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Provide and improve our language learning services</li>
              <li>Sync your vocabulary and progress across devices</li>
              <li>Generate translations for vocabulary words</li>
              <li>Send password reset emails when requested</li>
              <li>Track your learning progress and streaks</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary mb-4">Data Storage and Security</h2>
            <p>
              Your data is stored securely on our servers. We use industry-standard encryption for passwords and secure HTTPS connections for all data transmission. Authentication tokens are stored locally in your browser for session management.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary mb-4">Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong>Supabase:</strong> For account authentication and session management</li>
              <li><strong>Google:</strong> For Google Sign-In, if you choose to use it (name, email, and profile picture)</li>
              <li><strong>DeepL:</strong> For translating vocabulary words (only the words you save are sent for translation)</li>
              <li><strong>Resend:</strong> For sending password reset emails</li>
            </ul>
            <p className="mt-2">We do not sell or share your personal data with advertisers or data brokers.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary mb-4">Browser Extension Permissions</h2>
            <p>Our Chrome extension requires certain permissions to function:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong>activeTab:</strong> To access the current video page for subtitle extraction</li>
              <li><strong>storage:</strong> To store your login session locally</li>
              <li><strong>scripting:</strong> To read subtitles from YouTube and Netflix pages</li>
              <li><strong>tabCapture:</strong> To capture audio clips for flashcard playback</li>
              <li><strong>offscreen:</strong> To process captured audio in the background</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary mb-4">Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Access your personal data</li>
              <li>Delete your account and associated data</li>
              <li>Export your vocabulary and learning data</li>
            </ul>
            <p className="mt-2">To exercise these rights, contact us at the email below.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary mb-4">Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. We will notify users of significant changes by posting a notice on our website.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary mb-4">Contact Us</h2>
            <p>
              If you have questions about this privacy policy or your data, please contact us at: <a href="mailto:support@theclipitapp.com" className="text-accent hover:underline">support@theclipitapp.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
