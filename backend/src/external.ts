// Loads an optional peer SDK at runtime. The module specifier is a variable so
// the compiler does NOT try to resolve it — that keeps mock-only builds light
// (the @mysten/* and @mysten-incubation/memwal SDKs are optional peers, only
// needed for the live path). Throws a clear error if the SDK isn't installed.

export async function importExternal(name: string): Promise<any> {
  try {
    return await import(/* @vite-ignore */ name);
  } catch {
    throw new Error(`optional SDK "${name}" is not installed. Run \`pnpm add ${name}\` to enable the live path.`);
  }
}
