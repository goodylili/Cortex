// Minimal ambient types for mammoth (ships no declarations). We only use raw text
// extraction from a .docx ArrayBuffer.
declare module "mammoth" {
  interface ExtractResult {
    value: string;
    messages: unknown[];
  }
  interface MammothInput {
    arrayBuffer: ArrayBuffer;
  }
  const mammoth: {
    extractRawText(input: MammothInput): Promise<ExtractResult>;
  };
  export default mammoth;
}
