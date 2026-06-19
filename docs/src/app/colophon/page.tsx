export default function ColophonPage(): React.JSX.Element {
  return (
    <>
      <style>{`
        .colophon-page {
          max-width: 36rem;
          margin: 0 auto;
          padding: 4rem 1.5rem 3rem;
          font-family: var(--font-body);
        }
        @media (max-width: 900px) {
          .colophon-page {
            padding-top: 2rem;
          }
        }
        .colophon-content {
          font-size: 0.75rem;
          color: var(--muted);
          line-height: 1.8;
        }
        .colophon-content p {
          margin-bottom: 0.5rem;
        }
        .colophon-content a {
          color: var(--ink);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .colophon-content a:hover {
          color: var(--accent-ink);
        }
        .colophon-table-wrapper {
          position: relative;
          margin-top: 1.5rem;
        }
        .colophon-table {
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 1;
        }
        .colophon-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.3rem 0;
          border-bottom: 1px dotted var(--line);
        }
        .colophon-row:last-child {
          border-bottom: none;
        }
        .colophon-row-label {
          color: var(--faint);
        }
        .colophon-row-value {
          color: var(--muted);
          text-align: right;
        }
        .colophon-row-value a {
          color: var(--muted);
        }
      `}</style>
      <div className="colophon-page">
        <div className="colophon-content">
          <p>
            Cortex is a local-first persistent memory layer and multi-agent operating
            system for AI. It ingests notes, files, and other sources, extracts durable
            memories, stores artifacts on user-controlled infrastructure, recalls the right
            context later, and improves over time through consolidation.
          </p>
          <p>
            These docs are a static{" "}
            <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer">Next.js</a>{" "}
            site. Code samples are highlighted with{" "}
            <a href="https://github.com/FormidableLabs/prism-react-renderer" target="_blank" rel="noopener noreferrer">
              prism-react-renderer
            </a>
            ; light and dark themes are driven entirely by CSS custom properties, so every
            surface adapts to your system preference.
          </p>

          <div className="colophon-table-wrapper">
            <div className="colophon-table">
              <div className="colophon-row">
                <span className="colophon-row-label">Framework</span>
                <span className="colophon-row-value">
                  <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer">Next.js</a>
                </span>
              </div>
              <div className="colophon-row">
                <span className="colophon-row-label">Headings</span>
                <span className="colophon-row-value">
                  <a href="https://www.fontshare.com/fonts/expose" target="_blank" rel="noopener noreferrer">Expose</a>
                </span>
              </div>
              <div className="colophon-row">
                <span className="colophon-row-label">Body &amp; mono</span>
                <span className="colophon-row-value">
                  <a href="https://fonts.google.com/specimen/Roboto" target="_blank" rel="noopener noreferrer">Roboto</a>
                </span>
              </div>
              <div className="colophon-row">
                <span className="colophon-row-label">Theme</span>
                <span className="colophon-row-value">Light &amp; dark</span>
              </div>
              <div className="colophon-row">
                <span className="colophon-row-label">Storage layer</span>
                <span className="colophon-row-value">Sui · Walrus · Seal · MemWal</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
