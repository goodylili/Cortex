import { type Metadata } from "next";

import { LegalPage, LegalSection } from "../legal-page";

export const metadata: Metadata = {
  title: "Security | Cortex",
};

export default function SecurityPage() {
  return (
    <LegalPage
      title="Security"
      intro="Cortex is designed so that you, not a platform, hold the keys to your memory. This page summarizes our security model."
    >
      <LegalSection heading="Encryption">
        <p>
          Memory is encrypted with Seal before it leaves your device. Keys are
          managed through your own Sui wallet, so plaintext memory is never
          exposed to Cortex infrastructure.
        </p>
      </LegalSection>
      <LegalSection heading="Sharing">
        <p>
          Shared memory is addressed by SuiNS handle and access is scoped by
          identity. A recipient can only decrypt what was explicitly shared with
          them.
        </p>
      </LegalSection>
      <LegalSection heading="Reporting an issue">
        <p>
          If you discover a vulnerability, please report it privately through the
          project repository linked in the footer so we can address it before
          disclosure.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
