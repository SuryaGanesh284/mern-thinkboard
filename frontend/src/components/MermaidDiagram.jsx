import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import {
  GitForkIcon,
  SparklesIcon,
  Loader2Icon,
  DownloadIcon,
  CopyIcon,
  CheckIcon,
  ArrowRightIcon,
  NetworkIcon,
  LayersIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/axios";

// Initialize mermaid with dark/cyber styling
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "monospace",
  themeVariables: {
    darkMode: true,
    primaryColor: "#00FF9D",
    primaryTextColor: "#000000",
    primaryBorderColor: "#00FF9D",
    lineColor: "#38BDF8",
    secondaryColor: "#1E293B",
    tertiaryColor: "#0F172A",
    background: "#0F172A",
    noteBkgColor: "#1E293B",
    noteTextColor: "#F8FAFC",
  },
});

const MermaidDiagram = ({ noteTitle = "", noteContent = "", onInsertToNote }) => {
  const [diagramType, setDiagramType] = useState("auto");
  const [mermaidCode, setMermaidCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const idRef = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

  const handleGenerateDiagram = async (type = diagramType) => {
    if (!noteContent.trim()) {
      toast.error("Please add note content first to generate a diagram");
      return;
    }

    setDiagramType(type);
    setIsGenerating(true);
    try {
      const res = await api.post("/ai/generate-diagram", {
        title: noteTitle,
        content: noteContent,
        diagramType: type,
      });

      if (res.data?.mermaidCode) {
        setMermaidCode(res.data.mermaidCode);
        toast.success("AI Diagram generated successfully! 📊");
      }
    } catch (error) {
      console.error("Diagram error:", error);
      toast.error("Failed to generate diagram with AI");
    } finally {
      setIsGenerating(false);
    }
  };

  // Render mermaid whenever mermaidCode updates
  useEffect(() => {
    if (!mermaidCode || !containerRef.current) return;

    const renderDiagram = async () => {
      try {
        containerRef.current.innerHTML = "";
        const uniqueId = `mermaid-svg-${Date.now()}`;
        const { svg } = await mermaid.render(uniqueId, mermaidCode);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        console.warn("Mermaid render warning:", err);
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="p-4 text-xs font-mono text-warning bg-base-300 rounded-xl">
              <p class="font-bold mb-1">Generated Mermaid Code:</p>
              <pre class="whitespace-pre-wrap">${mermaidCode}</pre>
            </div>
          `;
        }
      }
    };

    renderDiagram();
  }, [mermaidCode]);

  const handleCopy = () => {
    if (!mermaidCode) return;
    navigator.clipboard.writeText(`\`\`\`mermaid\n${mermaidCode}\n\`\`\``);
    setCopied(true);
    toast.success("Mermaid markdown copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSVG = () => {
    if (!containerRef.current) return;
    const svgEl = containerRef.current.querySelector("svg");
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(noteTitle || "diagram").toLowerCase().replace(/\s+/g, "-")}-mindmap.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Diagram SVG downloaded!");
  };

  return (
    <div className="my-3">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!mermaidCode && !isOpen && noteContent.trim()) {
            handleGenerateDiagram();
          }
        }}
        className={`btn btn-sm gap-2 transition-all duration-300 ${
          isOpen ? "btn-accent shadow-lg shadow-accent/20" : "btn-outline btn-accent"
        }`}
      >
        <GitForkIcon className="size-4" />
        <span>AI Mindmap & Diagram</span>
        <span className="badge badge-xs badge-accent">Mermaid</span>
      </button>

      {/* Diagram Panel */}
      {isOpen && (
        <div className="mt-3 p-5 rounded-2xl bg-base-300/90 border border-accent/20 backdrop-blur-md shadow-2xl animate-fadeIn">
          {/* Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-content/10 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-accent/10 text-accent">
                <NetworkIcon className="size-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm flex items-center gap-2">
                  AI Visual Mindmap & Architecture
                  <span className="badge badge-accent badge-sm">Mermaid.js</span>
                </h4>
                <p className="text-xs opacity-60">Automatically visualize concepts, workflows, and hierarchies</p>
              </div>
            </div>

            {/* Diagram Type Selector */}
            <div className="flex items-center gap-1.5 bg-base-100 p-1 rounded-xl border border-base-content/5">
              {[
                { id: "auto", label: "Auto" },
                { id: "mindmap", label: "Mindmap" },
                { id: "flowchart", label: "Flowchart" },
                { id: "sequence", label: "Sequence" },
              ].map((type) => (
                <button
                  key={type.id}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => handleGenerateDiagram(type.id)}
                  className={`btn btn-xs normal-case ${
                    diagramType === type.id ? "btn-accent shadow-sm" : "btn-ghost"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Diagram Display Card */}
          <div className="rounded-xl bg-[#0b0f19] border border-base-content/10 p-6 min-h-[220px] flex items-center justify-center overflow-x-auto shadow-inner relative">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-2 text-accent py-12">
                <Loader2Icon className="size-8 animate-spin" />
                <span className="text-sm font-medium">Generating visual diagram with Gemini AI...</span>
              </div>
            ) : !mermaidCode ? (
              <div className="text-center py-10 text-base-content/60">
                <LayersIcon className="size-10 mx-auto mb-2 opacity-30 text-accent" />
                <p className="text-sm font-medium">Click a diagram type above to generate</p>
                <p className="text-xs opacity-60">Converts your note into interactive Mermaid graphs</p>
              </div>
            ) : (
              <div ref={containerRef} className="w-full flex justify-center items-center" />
            )}
          </div>

          {/* Footer Actions */}
          {mermaidCode && !isGenerating && (
            <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-base-content/10 text-xs">
              <div className="text-base-content/60 flex items-center gap-1">
                <SparklesIcon className="size-3.5 text-accent" />
                <span>Generated with Mermaid.js</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn btn-xs btn-ghost gap-1"
                >
                  {copied ? <CheckIcon className="size-3.5 text-success" /> : <CopyIcon className="size-3.5" />}
                  <span>{copied ? "Copied Code" : "Copy Code"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSVG}
                  className="btn btn-xs btn-outline btn-accent gap-1"
                >
                  <DownloadIcon className="size-3.5" />
                  <span>Download SVG</span>
                </button>

                {onInsertToNote && (
                  <button
                    type="button"
                    onClick={() => {
                      onInsertToNote(`\n\n\`\`\`mermaid\n${mermaidCode}\n\`\`\`\n`);
                      toast.success("Mermaid block inserted into note content!");
                    }}
                    className="btn btn-xs btn-accent gap-1"
                  >
                    <ArrowRightIcon className="size-3.5" />
                    <span>Insert into Note</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MermaidDiagram;
