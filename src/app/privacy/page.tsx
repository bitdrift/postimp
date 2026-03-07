import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Post Imp",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-base-100 px-6 py-16">
      <div className="max-w-2xl mx-auto prose">
        <h1>Privacy Policy</h1>
        <p className="text-base-content/50">Last updated: March 2, 2026</p>

        <h2>Introduction</h2>
        <p>
          Post Imp (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the postimp.com
          website and SMS-based social media management service. This Privacy Policy explains how we
          collect, use, and protect your information.
        </p>

        <h2>Information We Collect</h2>
        <ul>
          <li>
            <strong>Account Information:</strong> Email address, password, and phone number provided
            during registration.
          </li>
          <li>
            <strong>Brand Information:</strong> Brand name, description, tone, and target audience
            you provide during onboarding.
          </li>
          <li>
            <strong>SMS Messages:</strong> Text messages and images you send to our service number
            for the purpose of creating social media posts.
          </li>
          <li>
            <strong>Instagram Data:</strong> Instagram account connection details and access tokens
            required to publish posts on your behalf.
          </li>
          <li>
            <strong>Usage Data:</strong> Information about how you interact with our service,
            including posts created and published.
          </li>
        </ul>

        <h2>How We Use Your Information</h2>
        <ul>
          <li>To provide and operate our SMS-based Instagram posting service.</li>
          <li>To generate AI-powered captions tailored to your brand voice and audience.</li>
          <li>To publish content to your connected Instagram account.</li>
          <li>To communicate with you via SMS about your posts and account.</li>
          <li>To improve and maintain our service.</li>
        </ul>

        <h2>Third-Party Services</h2>
        <p>We use the following third-party services to operate Post Imp:</p>
        <ul>
          <li>
            <strong>Twilio:</strong> For sending and receiving SMS messages.
          </li>
          <li>
            <strong>OpenAI:</strong> For AI-powered caption generation. Images and text you send may
            be processed by OpenAI.
          </li>
          <li>
            <strong>Instagram/Meta:</strong> For publishing posts to your Instagram account.
          </li>
          <li>
            <strong>Supabase:</strong> For data storage and authentication.
          </li>
          <li>
            <strong>Vercel:</strong> For hosting our website.
          </li>
        </ul>

        <h2>Data Retention</h2>
        <p>
          We retain your data for as long as your account is active. You may request deletion of
          your account and associated data by contacting us.
        </p>

        <h2>Data Security</h2>
        <p>
          We implement industry-standard security measures to protect your information, including
          encrypted connections, secure token storage, and access controls.
        </p>

        <h2>Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal information we hold about you.</li>
          <li>Request correction of inaccurate information.</li>
          <li>Request deletion of your account and data.</li>
          <li>Opt out of SMS communications by texting STOP.</li>
        </ul>

        <h2>SMS Messaging</h2>
        <p>
          By using Post Imp, you consent to receiving SMS messages at the phone number you provide.
          Message and data rates may apply. You can opt out at any time by texting STOP. Text HELP
          for assistance. Message frequency varies based on your usage.
        </p>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of significant
          changes via SMS or email.
        </p>

        <h2>Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, please contact us at{" "}
          <a href="mailto:support@postimp.com">support@postimp.com</a>.
        </p>
      </div>
    </div>
  );
}
