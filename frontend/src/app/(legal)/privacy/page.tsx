import { type Metadata } from "next";

import { LegalPage, LegalSection } from "../legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Cortex",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="Cortex is a sovereign memory layer built on the Sui stack. This page is a placeholder summary of how we approach your data while a full policy is finalized."
    >
      <LegalSection heading="What we store">
        <p>
          Your memory is stored on Walrus and encrypted with Seal. Encryption
          and storage happen client-side through your own Sui wallet, so the
          contents of your memory are not readable by us.
        </p>
      </LegalSection>
      <LegalSection heading="What stays local">
        <p>
          Profile preferences and onboarding answers are kept in your browser
          and are not transmitted to a Cortex server unless you explicitly use a
          server-backed feature.
        </p>
      </LegalSection>
      <LegalSection heading="Third parties">
        <p>
          Some features call model providers and the Sui, Walrus, and Seal
          networks to function. Those providers process only the data needed to
          fulfil the request you initiate.
        </p>
      </LegalSection>
      <LegalSection heading="Contact">
        <p>
          For privacy questions, reach us through the project repository linked
          in the footer.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
