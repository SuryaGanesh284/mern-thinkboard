import { useState, useRef, useEffect } from "react";
import {
  MicIcon,
  SquareIcon,
  SparklesIcon,
  Loader2Icon,
  XIcon,
  CheckIcon,
  Volume2Icon,
  ListTodoIcon,
  TagIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/axios";

const VoiceRecorder = ({ onApplyVoiceNote }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const speechRecognitionRef = useRef(null);

  // Timer while recording
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const startRecording = async () => {
    audioChunksRef.current = [];
    setLiveTranscript("");

    try {
      // 1. Start audio recording via MediaRecorder
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200);

      // 2. Initialize live speech recognition for real-time visual feedback if supported
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
          let current = "";
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript + " ";
          }
          setLiveTranscript(current.trim());
        };

        recognition.onerror = (e) => console.warn("Speech recognition error:", e);
        recognition.start();
        speechRecognitionRef.current = recognition;
      }

      setIsRecording(true);
      toast.success("Recording started. Speak freely!");
    } catch (error) {
      console.error("Microphone access error:", error);
      toast.error("Could not access microphone. Please allow microphone permissions.");
    }
  };

  const stopAndProcess = async () => {
    if (!mediaRecorderRef.current && !liveTranscript) return;

    setIsRecording(false);
    setIsProcessing(true);

    // Stop Web Speech
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }

    // Stop MediaRecorder stream tracks
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach((track) => track.stop());
    }

    // Small delay to collect final chunks
    setTimeout(async () => {
      try {
        let audioBase64 = "";
        let mimeType = "audio/webm";

        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const reader = new FileReader();
          audioBase64 = await new Promise((resolve) => {
            reader.onloadend = () => {
              const base64data = reader.result?.split(",")?.[1] || "";
              resolve(base64data);
            };
            reader.readAsDataURL(audioBlob);
          });
        }

        const res = await api.post("/ai/transcribe-voice", {
          audioBase64,
          mimeType,
          rawTranscript: liveTranscript,
        });

        if (res.data) {
          const { title, content, tags, actionItems } = res.data;
          onApplyVoiceNote({ title, content, tags, actionItems });
          toast.success("Voice thoughts transformed into structured note! ✨");
          setIsOpen(false);
        }
      } catch (error) {
        console.error("Voice processing error:", error);
        toast.error("Failed to process voice note with AI");
      } finally {
        setIsProcessing(false);
      }
    }, 400);
  };

  const cancelRecording = () => {
    setIsRecording(false);
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream?.getTracks().forEach((track) => track.stop());
    }
    setLiveTranscript("");
    setRecordingTime(0);
    setIsOpen(false);
  };

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="mb-4">
      {/* Trigger Button */}
      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            startRecording();
          }}
          className="btn btn-sm btn-outline btn-secondary gap-2 shadow-sm"
        >
          <MicIcon className="size-4 text-secondary animate-pulse" />
          <span>Voice Brain Dump (AudioPen)</span>
          <span className="badge badge-xs badge-secondary">AI</span>
        </button>
      ) : (
        /* Active Recording Card */
        <div className="p-4 rounded-2xl bg-base-300/90 border border-secondary/30 shadow-xl backdrop-blur-md animate-fadeIn">
          <div className="flex items-center justify-between border-b border-base-content/10 pb-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${isRecording ? "bg-error/20 text-error animate-pulse" : "bg-primary/20 text-primary"}`}>
                <MicIcon className="size-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm flex items-center gap-2">
                  {isRecording ? "Listening to your thoughts..." : isProcessing ? "AI structuring note..." : "Ready"}
                  {isRecording && (
                    <span className="badge badge-error badge-sm font-mono animate-pulse">
                      {formatSeconds(recordingTime)}
                    </span>
                  )}
                </h4>
                <p className="text-xs opacity-60">Speak naturally — AI will remove fillers & structure with headings</p>
              </div>
            </div>

            <button
              type="button"
              onClick={cancelRecording}
              className="btn btn-ghost btn-xs btn-circle"
              disabled={isProcessing}
            >
              <XIcon className="size-4" />
            </button>
          </div>

          {/* Animated Waveform Visualizer */}
          {isRecording && (
            <div className="flex items-center justify-center gap-1.5 py-3 bg-base-100/50 rounded-xl mb-3">
              {[40, 70, 30, 90, 60, 100, 50, 80, 45, 95, 65, 35].map((height, i) => (
                <div
                  key={i}
                  className="w-1.5 bg-secondary rounded-full animate-bounce"
                  style={{
                    height: `${height}%`,
                    maxHeight: "36px",
                    minHeight: "8px",
                    animationDuration: `${0.4 + (i % 5) * 0.15}s`,
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Live spoken preview */}
          {liveTranscript && (
            <div className="p-3 bg-base-100 rounded-xl text-xs text-base-content/80 max-h-24 overflow-y-auto font-sans leading-relaxed mb-3 border border-base-content/5">
              <span className="font-semibold text-secondary mr-1.5">Live Transcript:</span>
              {liveTranscript}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between gap-2 mt-2 pt-2">
            <button
              type="button"
              onClick={cancelRecording}
              disabled={isProcessing}
              className="btn btn-xs btn-ghost text-base-content/60"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {isRecording ? (
                <button
                  type="button"
                  onClick={stopAndProcess}
                  className="btn btn-sm btn-secondary gap-2 shadow-md shadow-secondary/20"
                >
                  <SquareIcon className="size-3.5 fill-current" />
                  <span>Done Speaking (Generate Note)</span>
                </button>
              ) : isProcessing ? (
                <button type="button" disabled className="btn btn-sm btn-secondary gap-2">
                  <Loader2Icon className="size-4 animate-spin" />
                  <span>Structuring thoughts with AI...</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
