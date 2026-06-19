export function Footer() {
  return (
    <footer className="footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 20 }}>
      <p>
        Cortex —{" "}
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </p>
      <a href="/colophon">Colophon</a>
    </footer>
  );
}
