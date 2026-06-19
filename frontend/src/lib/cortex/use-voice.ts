// Self-contained voice hooks for the composer. useDictation captures microphone
// audio with MediaRecorder and transcribes it via the Whisper-backed /api/transcribe
// endpoint; useReadAloud speaks responses through the browser-native SpeechSynthesis
// API. Both are SSR-safe and carry no external dependencies.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TRANSCRIBE_ENDPOINT = "/api/transcribe";
const DEFAULT_MIME = "audio/webm";
const RECORDING_FILE_NAME = "dictation.webm";

type TranscribeResponse = { text?: string; ok?: boolean; reason?: string };

export function useDictation(): {
  supported: boolean;
  recording: boolean;
  busy: boolean;
  start: () => Promise<void>;
  stop: () => Promise<string>;
} {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.getUserMedia === "function" &&
        typeof window !== "undefined" &&
        typeof window.MediaRecorder === "function",
    );
  }, []);

  const releaseStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.mediaDevices?.getUserMedia !== "function" ||
      typeof window === "undefined" ||
      typeof window.MediaRecorder !== "function"
    ) {
      throw new Error("Dictation is not supported in this environment");
    }

    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setRecording(false);
      throw new Error(
        `Microphone access failed: ${(err as Error).message || "permission denied"}`,
      );
    }

    try {
      const recorder = new MediaRecorder(stream);
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
      recorderRef.current = null;
      setRecording(false);
      throw new Error(
        `Recorder initialization failed: ${(err as Error).message}`,
      );
    }
  }, []);

  const stop = useCallback(async (): Promise<string> => {
    const recorder = recorderRef.current;
    if (!recorder) {
      setRecording(false);
      return "";
    }

    const mimeType = recorder.mimeType || DEFAULT_MIME;

    const chunks = await new Promise<Blob[]>((resolve) => {
      recorder.addEventListener(
        "stop",
        () => resolve(chunksRef.current),
        { once: true },
      );
      try {
        recorder.stop();
      } catch {
        resolve(chunksRef.current);
      }
    });

    releaseStream();
    setRecording(false);
    setBusy(true);

    try {
      const blob = new Blob(chunks, { type: mimeType });
      const form = new FormData();
      form.append("file", blob, RECORDING_FILE_NAME);

      const res = await fetch(TRANSCRIBE_ENDPOINT, {
        method: "POST",
        body: form,
      });
      if (!res.ok) return "";

      const data = (await res.json()) as TranscribeResponse;
      if (!data.ok || !data.text) return "";
      return data.text.trim();
    } catch {
      return "";
    } finally {
      chunksRef.current = [];
      setBusy(false);
    }
  }, [releaseStream]);

  useEffect(() => releaseStream, [releaseStream]);

  return { supported, recording, busy, start, stop };
}

export function useReadAloud(): {
  supported: boolean;
  speaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
} {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { supported, speaking, speak, stop };
}
