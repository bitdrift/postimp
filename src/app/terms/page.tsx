import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - Post Imp",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white px-6 py-16">
      <div className="max-w-2xl mx-auto prose prose-gray">
        <h1>Terms of Service</h1>
        <p className="text-gray-500">Last updated: March 2, 2026</p>

        <h2>Agreement to Terms</h2>
        <p>
          By accessing or using Post Imp (&quot;the Service&quot;), operated at
          postimp.com, you agree to be bound by these Terms of Service. If you
          do not agree, do not use the Service.
        </p>

        <h2>Description of Service</h2>
        <p>
          Post Imp is an AI-powered social media management service that allows
          you to create, review, and publish Instagram posts via SMS. You send
          photos and descriptions via text message, and our AI generates
          captions for your approval before publishing to your connected
          Instagram account.
        </p>

        <h2>Account Registration</h2>
        <ul>
          <li>You must provide a valid phone number and email to create an account.</li>
          <li>You are responsible for maintaining the security of your account credentials.</li>
          <li>You must be at least 18 years old to use the Service.</li>
          <li>You may not create multiple accounts for the same phone number.</li>
        </ul>

        <h2>Acceptable Use</h2>
        <p>You agree not to use the Service to:</p>
        <ul>
          <li>Post content that violates Instagram&apos;s Community Guidelines or Terms of Use.</li>
          <li>Send spam, offensive, or illegal content.</li>
          <li>Impersonate another person or brand.</li>
          <li>Attempt to gain unauthorized access to the Service or its systems.</li>
          <li>Use the Service for any unlawful purpose.</li>
        </ul>

        <h2>Content and Intellectual Property</h2>
        <ul>
          <li>You retain ownership of the images and content you submit.</li>
          <li>
            AI-generated captions are created for your use and become part of
            your published content.
          </li>
          <li>
            You grant Post Imp a limited license to process, store, and transmit
            your content as necessary to provide the Service.
          </li>
          <li>
            You are solely responsible for the content you publish through the
            Service.
          </li>
        </ul>

        <h2>Instagram Connection</h2>
        <ul>
          <li>
            You authorize Post Imp to publish content to your Instagram account
            on your behalf when you approve a post.
          </li>
          <li>
            You may disconnect your Instagram account at any time from your
            account settings.
          </li>
          <li>
            Post Imp is not responsible for changes to Instagram&apos;s API or
            policies that may affect the Service.
          </li>
        </ul>

        <h2>SMS Messaging</h2>
        <ul>
          <li>
            By using the Service, you consent to receiving SMS messages related
            to your posts and account.
          </li>
          <li>Message and data rates may apply based on your carrier plan.</li>
          <li>Text STOP to opt out of messages. Text HELP for assistance.</li>
          <li>Message frequency varies based on your usage of the Service.</li>
        </ul>

        <h2>Disclaimer of Warranties</h2>
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without
          warranties of any kind, either express or implied. We do not guarantee
          that the Service will be uninterrupted, error-free, or that AI-generated
          captions will meet your specific requirements.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Post Imp shall not be liable
          for any indirect, incidental, special, consequential, or punitive
          damages resulting from your use of the Service, including but not
          limited to loss of data, revenue, or reputation.
        </p>

        <h2>Termination</h2>
        <p>
          We reserve the right to suspend or terminate your account at any time
          for violation of these Terms. You may delete your account at any time
          by contacting us.
        </p>

        <h2>Changes to Terms</h2>
        <p>
          We may update these Terms from time to time. Continued use of the
          Service after changes constitutes acceptance of the updated Terms.
        </p>

        <h2>Contact Us</h2>
        <p>
          If you have questions about these Terms, please contact us at{" "}
          <a href="mailto:support@postimp.com">support@postimp.com</a>.
        </p>
      </div>
    </div>
  );
}
