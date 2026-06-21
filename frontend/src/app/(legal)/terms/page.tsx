import { type Metadata } from "next";

import { LegalPage, LegalSection } from "../legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | Cortex",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These placeholder terms outline the basics of using Cortex while a full agreement is finalized."
    >
      <LegalSection heading="Using Cortex">
        <p>
          Cortex provides tools to store, share, and reason over your own
          memory. You are responsible for the content you upload and for keeping
          your Sui wallet credentials secure.
        </p>
      </LegalSection>
      <LegalSection heading="Ownership">
        <p>
          You own your memory. Cortex does not claim rights over the data you
          store, and you can export or remove it at any time.
        </p>
      </LegalSection>
      <LegalSection heading="Availability">
        <p>
          Cortex depends on the Sui, Walrus, and Seal networks and on
          third-party model providers. We do not guarantee uninterrupted
          availability of these external services.
        </p>
      </LegalSection>
      <LegalSection heading="Changes">
        <p>
          These terms may be updated as Cortex evolves. Continued use after an
          update means you accept the revised terms.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
