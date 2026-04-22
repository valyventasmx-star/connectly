import { useSearchParams } from 'react-router-dom';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

function Terms() {
  return (
    <div className="prose prose-sm max-w-none text-gray-600">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Terms of Service</h2>
      <p className="text-xs text-gray-400 mb-6">Last updated: January 1, 2025</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">1. Acceptance of Terms</h3>
      <p>By accessing or using Connectly ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">2. Description of Service</h3>
      <p>Connectly is a multi-tenant messaging platform that enables businesses to manage WhatsApp Business API communications. We provide tools for conversation management, team collaboration, and AI-assisted customer support.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">3. Account Registration</h3>
      <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 18 years old to use the Service.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">4. Acceptable Use</h3>
      <p>You agree not to use the Service to send spam, unsolicited messages, or content that violates WhatsApp's Business Policy. You agree to comply with all applicable laws and Meta's WhatsApp Business API Terms of Service.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">5. Billing and Payments</h3>
      <p>Paid plans are billed monthly in advance. All fees are non-refundable except as required by law. We reserve the right to change pricing with 30 days' notice. Failure to pay may result in service suspension.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">6. Intellectual Property</h3>
      <p>The Service and its content are owned by Connectly and protected by intellectual property laws. You retain ownership of your data. You grant us a license to process your data to provide the Service.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">7. Limitation of Liability</h3>
      <p>The Service is provided "as is." We are not liable for indirect, incidental, or consequential damages. Our total liability shall not exceed the amounts paid by you in the 12 months preceding the claim.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">8. Termination</h3>
      <p>Either party may terminate the agreement at any time. We may suspend your account immediately if you violate these terms. Upon termination, you may export your data within 30 days.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">9. Changes to Terms</h3>
      <p>We may update these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">10. Contact</h3>
      <p>For questions about these terms, please contact us at legal@connectly.app</p>
    </div>
  );
}

function Privacy() {
  return (
    <div className="prose prose-sm max-w-none text-gray-600">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Privacy Policy</h2>
      <p className="text-xs text-gray-400 mb-6">Last updated: January 1, 2025</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">1. Information We Collect</h3>
      <p>We collect information you provide (name, email, company), usage data (pages visited, features used), and message data processed through our platform to provide the Service.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">2. How We Use Your Information</h3>
      <p>We use your information to provide and improve the Service, process payments, send transactional emails (account confirmations, notifications), and comply with legal obligations. We do not sell your data to third parties.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">3. Data Storage and Security</h3>
      <p>Your data is stored on secure servers. We use industry-standard encryption in transit (TLS) and at rest. We retain your data for as long as your account is active and for 90 days after account deletion.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">4. Third-Party Services</h3>
      <p>We use third-party services including: Stripe (payment processing), Meta (WhatsApp API), Anthropic (AI features), and Railway/Vercel (infrastructure). Each has its own privacy policy.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">5. Cookies</h3>
      <p>We use essential cookies for authentication. We do not use tracking or advertising cookies. You may disable cookies in your browser, but this may affect Service functionality.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">6. Your Rights</h3>
      <p>You have the right to access, correct, or delete your personal data. You may export your data at any time from account settings. To exercise these rights, contact us at privacy@connectly.app</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">7. WhatsApp Message Data</h3>
      <p>Messages sent through our platform are processed according to Meta's privacy policy. End-user contact information is stored to provide conversation management features and is not shared with other workspaces.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">8. Changes to This Policy</h3>
      <p>We will notify you of significant changes via email. Continued use of the Service constitutes acceptance of the updated policy.</p>

      <h3 className="font-semibold text-gray-800 mt-6 mb-2">9. Contact</h3>
      <p>For privacy inquiries, contact us at privacy@connectly.app</p>
    </div>
  );
}

export default function Legal() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'terms';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900">Connectly</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit">
          {[['terms', 'Terms of Service'], ['privacy', 'Privacy Policy']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setParams({ tab: key })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          {tab === 'terms' ? <Terms /> : <Privacy />}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Connectly. All rights reserved.
        </p>
      </div>
    </div>
  );
}
