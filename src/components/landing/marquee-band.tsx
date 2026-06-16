const MARQUEE_WORD = "Cortex";
const MARQUEE_REPEAT = 8;

export function MarqueeBand() {
  const words = Array.from({ length: MARQUEE_REPEAT * 2 });

  return (
    <div className="cortex-marquee overflow-hidden border-t border-ink/10 bg-canvas py-8">
      <div className="cortex-marquee-track">
        {words.map((_, index) => (
          <span
            key={index}
            className="mx-8 shrink-0 text-[clamp(4rem,15vw,13rem)] font-medium leading-none tracking-[-0.05em] text-ink/[0.07]"
          >
            {MARQUEE_WORD}
          </span>
        ))}
      </div>
    </div>
  );
}
