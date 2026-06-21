import { type Metadata } from "next";

import { LegalPage, LegalSection } from "../legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy | Cortex",
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      intro="This placeholder explains how Cortex uses browser storage while a full policy is finalized."
    >
      <LegalSection heading="Local storage">
        <p>
          Cortex uses your browser&apos;s local storage to remember preferences
          such
          as theme and onboarding state. This data stays on your device.
        </p>
      </LegalSection>
      <LegalSection heading="Essential cookies">
        <p>
          We use only the cookies required to keep you signed in and to operate
          core functionality. We do not use advertising cookies.
        </p>
      </LegalSection>
      <LegalSection heading="Your choices">
        <p>
          You can clear cookies and local storage from your browser settings at
          any time, though doing so will reset your local preferences.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
