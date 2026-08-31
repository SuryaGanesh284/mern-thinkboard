import { useState, useRef } from "react";
import {
  SparklesIcon,
  Wand2Icon,
  CheckIcon,
  CopyIcon,
  XIcon,
  Loader2Icon,
  ArrowRightIcon,
  ListTodoIcon,
  BriefcaseIcon,
  MessageSquareIcon,
  FileTextIcon,
  CpuIcon,
  SendIcon,
} from "lucide-react";
import toast from "react-hot-toast";

const AI_ACTIONS = [
  { id: "continue", label: "Continue Writing", icon: Wand2Icon, desc: "Expand and write next section" },
  { id: "polish", label: "Polish & Fix Grammar", icon: SparklesIcon, desc: "Improve vocabulary and clarity" },
  { id: "extract_actions", label: "Extract Action Items", icon: ListTodoIcon, desc: "Turn notes into to-do checklist" },
  { id: "tone_executive", label: "Executive Summary", icon: BriefcaseIcon, desc: "Crisp leadership bullet points" },
  { id: "tone_technical", label: "Technical Spec", icon: CpuIcon, desc: "Structured engineering format" },
  { id: "tone_casual", label: "Casual & Friendly", icon: MessageSquareIcon, desc: "Relaxed conversational tone" },
  { id: "summarize", label: "TL;DR Summary", icon: FileTextIcon, desc: "Concise 3-bullet takeaway" },
];

const AICopilot = ({ currentTitle = "", currentContent = "", onApplyContent, onAppendContent }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState("continue");
  const [customPrompt, setCustomPrompt] = useState("");
  const [streamedResult, setStreamedResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortControllerRef = useRef(null);

  const handleGenerate = async (actionId = activeAction) => {
    setActiveAction(actionId);

    if (actionId === "custom" && !customPrompt.trim()) {
      toast.error("Please enter a custom prompt");
      return;
    }

    if (!currentContent.trim() && actionId !== "custom") {
      toast.error("Write some note content first to give AI context");
      return;
    }

    setIsGenerating(true);
    setStreamedResult("");

    // Create abort controller for streaming cancellation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001/api" : "/api";
      const response = await fetch(`${BASE_URL}/ai/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: currentContent,
          action: actionId,
          customPrompt: actionId === "custom" ? customPrompt : "",
          noteTitle: currentTitle,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("AI streaming request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.replace("data: ", ""));
              if (data.chunk) {
                setStreamedResult((prev) => prev + data.chunk);
              }
              if (data.error) {
                toast.error(data.error);
              }
            } catch {
              // Ignore partial parse errors
            }
          }
        }
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Streaming error:", error);
        toast.error("AI generation failed. Check backend connection.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!streamedResult) return;
    navigator.clipboard.writeText(streamedResult);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReplace = () => {
    if (!streamedResult) return;
    onApplyContent(streamedResult);
    toast.success("Note content updated with AI response!");
    setIsOpen(false);
  };

  const handleAppend = () => {
    if (!streamedResult) return;
    onAppendContent(streamedResult);
    toast.success("AI content appended to note!");
    setIsOpen(false);
  };

  return (
    <div className="my-3">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`btn btn-sm gap-2 transition-all duration-300 ${
          isOpen ? "btn-primary shadow-lg shadow-primary/20" : "btn-outline btn-primary"
        }`}
      >
        <SparklesIcon className="size-4 animate-pulse text-amber-300" />
        <span>ThinkBoard AI Copilot</span>
      </button>

      {/* Floating / Embedded AI Panel */}
      {isOpen && (
        <div className="mt-3 p-5 rounded-2xl bg-base-300/80 border border-primary/20 backdrop-blur-md shadow-2xl transition-all">
          <div className="flex items-center justify-between border-b border-base-content/10 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <SparklesIcon className="size-5 text-primary animate-spin" style={{ animationDuration: "6s" }} />
              </div>
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  AI Writing Assistant
                  <span className="badge badge-primary badge-sm">Gemini 2.5</span>
                </h3>
                <p className="text-xs opacity-60">Context-aware transformations and instant generation</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn btn-ghost btn-xs btn-circle"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          {/* Quick AI Presets */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
            {AI_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => handleGenerate(action.id)}
                  className={`btn btn-sm h-auto py-2 justify-start flex-col items-start text-left normal-case border ${
                    activeAction === action.id && !streamedResult
                      ? "btn-primary border-primary"
                      : "btn-ghost bg-base-100 hover:bg-base-200 border-base-content/5"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium text-xs">
                    <Icon className="size-3.5 text-primary" />
                    <span>{action.label}</span>
                  </div>
                  <span className="text-[10px] opacity-60 font-normal line-clamp-1">{action.desc}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Prompt Input */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Ask AI anything about this note (e.g. 'Translate to Spanish', 'Make a table')..."
                className="input input-sm input-bordered w-full pr-10"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleGenerate("custom");
                  }
                }}
              />
            </div>
            <button
              type="button"
              disabled={isGenerating || !customPrompt.trim()}
              onClick={() => handleGenerate("custom")}
              className="btn btn-sm btn-primary gap-1"
            >
              <SendIcon className="size-3.5" />
              <span>Ask</span>
            </button>
          </div>

          {/* AI Streaming Response Output Area */}
          {(isGenerating || streamedResult) && (
            <div className="rounded-xl bg-base-100 p-4 border border-base-content/10 shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    {isGenerating && <Loader2Icon className="size-3.5 animate-spin text-primary" />}
                    AI Response
                  </span>
                </div>

                {isGenerating && (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="btn btn-xs btn-error btn-outline"
                  >
                    Stop Generating
                  </button>
                )}
              </div>

              <div className="whitespace-pre-wrap text-sm leading-relaxed max-h-64 overflow-y-auto font-sans p-2 rounded-lg bg-base-200/50">
                {streamedResult}
                {isGenerating && (
                  <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1 align-middle" />
                )}
              </div>

              {/* Action Buttons to apply the AI output */}
              {streamedResult && !isGenerating && (
                <div className="flex flex-wrap items-center justify-end gap-2 mt-4 pt-3 border-t border-base-content/10">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="btn btn-xs btn-ghost gap-1"
                  >
                    {copied ? <CheckIcon className="size-3.5 text-success" /> : <CopyIcon className="size-3.5" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAppend}
                    className="btn btn-xs btn-secondary btn-outline gap-1"
                  >
                    <ArrowRightIcon className="size-3.5" />
                    <span>Append to Note</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReplace}
                    className="btn btn-xs btn-primary gap-1"
                  >
                    <CheckIcon className="size-3.5" />
                    <span>Replace Entire Content</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AICopilot;
