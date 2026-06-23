import { create } from "zustand";

// The answer typewriter reveals text in ~24 ticks. Writing each tick into the main
// store re-rendered the whole app tree (the top-level view subscribes to the entire
// store), which is the biggest source of jank during a reply. Park the in-flight
// partial text here instead: only the small <StreamingAnswer /> reads it, so a tick
// re-renders that node alone. The final text is committed back to the chat once,
// streaming is done.
interface StreamState {
  text: string;
  setText: (text: string) => void;
}

export const useStreamStore = create<StreamState>((set) => ({
  text: "",
  setText: (text) => set({ text }),
}));
