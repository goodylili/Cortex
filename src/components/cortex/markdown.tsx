import { type ReactNode } from "react";

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
const BOLD = /^\*\*([^*]+)\*\*$/;
const ITALIC = /^\*([^*]+)\*$/;
const CODE = /^`([^`]+)`$/;
const LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const ORDERED = /^\d+\.\s+(.*)$/;
const UNORDERED = /^[-*]\s+(.*)$/;
const FENCE = /^```/;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let key = 0;
  for (const part of text.split(INLINE)) {
    if (!part) continue;
    const bold = BOLD.exec(part);
    if (bold) {
      out.push(<strong key={key++}>{bold[1]}</strong>);
      continue;
    }
    const italic = ITALIC.exec(part);
    if (italic) {
      out.push(<em key={key++}>{italic[1]}</em>);
      continue;
    }
    const code = CODE.exec(part);
    if (code) {
      out.push(
        <code className="md-code" key={key++}>
          {code[1]}
        </code>,
      );
      continue;
    }
    const link = LINK.exec(part);
    if (link) {
      out.push(
        <a
          className="md-link"
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          key={key++}
        >
          {link[1]}
        </a>,
      );
      continue;
    }
    out.push(<span key={key++}>{part}</span>);
  }
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let key = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (FENCE.test(line.trim())) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i]!.trim())) {
        body.push(lines[i]!);
        i++;
      }
      i++;
      blocks.push(
        <pre className="md-pre" key={key++}>
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      const content = inline(heading[2]!);
      blocks.push(
        level === 1 ? (
          <h1 className="md-h1" key={key++}>
            {content}
          </h1>
        ) : level === 2 ? (
          <h2 className="md-h2" key={key++}>
            {content}
          </h2>
        ) : (
          <h3 className="md-h3" key={key++}>
            {content}
          </h3>
        ),
      );
      i++;
      continue;
    }
    if (ORDERED.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && ORDERED.test(lines[i]!.trim())) {
        items.push(ORDERED.exec(lines[i]!.trim())![1]!);
        i++;
      }
      blocks.push(
        <ol className="md-ol" key={key++}>
          {items.map((it, n) => (
            <li key={n}>{inline(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    if (UNORDERED.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && UNORDERED.test(lines[i]!.trim())) {
        items.push(UNORDERED.exec(lines[i]!.trim())![1]!);
        i++;
      }
      blocks.push(
        <ul className="md-ul" key={key++}>
          {items.map((it, n) => (
            <li key={n}>{inline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !HEADING.test(lines[i]!) &&
      !FENCE.test(lines[i]!.trim()) &&
      !ORDERED.test(lines[i]!.trim()) &&
      !UNORDERED.test(lines[i]!.trim())
    ) {
      para.push(lines[i]!);
      i++;
    }
    blocks.push(
      <p className="md-p" key={key++}>
        {inline(para.join(" "))}
      </p>,
    );
  }
  return <div className="md">{blocks}</div>;
}
