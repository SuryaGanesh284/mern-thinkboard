import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  BrainIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
  Loader2Icon,
  ArrowRightIcon,
  BookOpenIcon,
  SendIcon,
  FileTextIcon,
  PercentIcon,
  ExternalLinkIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/axios";

const AskBrainModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState("ask"); // 'ask' or 'search'
  const [query, setQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const abortControllerRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setStreamedAnswer("");
      setSources([]);
      setSearchResults([]);
    }
  }, [isOpen]);

  // Handle Ask Brain (RAG Streaming)
  const handleAskBrain = async () => {
    if (!query.trim()) return;

    setIsProcessing(true);
    setStreamedAnswer("");
    setSources([]);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001/api" : "/api";
      const response = await fetch(`${BASE_URL}/ai/ask-brain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error("RAG request failed");

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
              if (data.sources) {
                setSources(data.sources);
              }
              if (data.chunk) {
                setStreamedAnswer((prev) => prev + data.chunk);
              }
              if (data.error) {
                toast.error(data.error);
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Ask Brain error:", error);
        toast.error("Failed to query your second brain");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Semantic Vector Search
  const handleSemanticSearch = async (searchQuery = query) => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsProcessing(true);
    try {
      const res = await api.post("/ai/semantic-search", { query: searchQuery });
      setSearchResults(res.data.results || []);
    } catch (error) {
      console.error("Semantic search error:", error);
      toast.error("Semantic search failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeTab === "ask") {
        handleAskBrain();
      } else {
        handleSemanticSearch();
      }
    }
  };

  const openNote = (noteId) => {
    onClose();
    navigate(`/note/${noteId}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 px-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Modal Card */}
      <div
        className="w-full max-w-3xl bg-base-100 border border-primary/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Tabs */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-content/10 bg-base-200/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("ask");
                setSearchResults([]);
              }}
              className={`btn btn-sm gap-2 normal-case transition-all ${
                activeTab === "ask" ? "btn-primary shadow-md shadow-primary/20" : "btn-ghost"
              }`}
            >
              <BrainIcon className="size-4" />
              <span>Ask Your Second Brain</span>
              <span className="badge badge-xs badge-outline">RAG</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("search");
                setStreamedAnswer("");
                setSources([]);
                if (query.trim()) handleSemanticSearch(query);
              }}
              className={`btn btn-sm gap-2 normal-case transition-all ${
                activeTab === "search" ? "btn-primary shadow-md shadow-primary/20" : "btn-ghost"
              }`}
            >
              <SearchIcon className="size-4" />
              <span>Semantic Search</span>
              <span className="badge badge-xs badge-outline">Vector</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:text-base-content"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-4 border-b border-base-content/10 bg-base-100">
          <div className="relative flex items-center">
            {activeTab === "ask" ? (
              <SparklesIcon className="absolute left-4 size-5 text-primary animate-pulse" />
            ) : (
              <SearchIcon className="absolute left-4 size-5 text-base-content/50" />
            )}
            <input
              ref={inputRef}
              type="text"
              className="input input-bordered w-full pl-12 pr-24 text-base focus:input-primary"
              placeholder={
                activeTab === "ask"
                  ? "Ask anything across all your notes (e.g. 'What did I plan for the roadmap?')..."
                  : "Search by meaning (e.g. 'healthy diet and workouts')..."
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              disabled={isProcessing || !query.trim()}
              onClick={() => (activeTab === "ask" ? handleAskBrain() : handleSemanticSearch())}
              className="absolute right-2 btn btn-sm btn-primary gap-1"
            >
              {isProcessing ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <>
                  <span>{activeTab === "ask" ? "Ask" : "Search"}</span>
                  <SendIcon className="size-3" />
                </>
              )}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1 text-xs text-base-content/50">
            <span>💡 Tip: AI searches by concepts and meaning, not just exact keywords.</span>
            <span>Press <kbd className="kbd kbd-xs">Enter</kbd> to submit</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Ask Brain View */}
          {activeTab === "ask" && (
            <>
              {/* Answer Box */}
              {(isProcessing || streamedAnswer) && (
                <div className="rounded-xl bg-base-200/60 p-5 border border-primary/20 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <BrainIcon className="size-5 text-primary animate-pulse" />
                    <span className="font-semibold text-sm uppercase tracking-wider text-primary">
                      Synthesized Knowledge Answer
                    </span>
                    {isProcessing && <Loader2Icon className="size-3.5 animate-spin text-primary ml-auto" />}
                  </div>

                  <div className="prose prose-sm max-w-none text-base-content whitespace-pre-wrap leading-relaxed">
                    {streamedAnswer}
                    {isProcessing && (
                      <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1 align-middle" />
                    )}
                  </div>
                </div>
              )}

              {/* Source Note Citations */}
              {sources.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/60 mb-3 flex items-center gap-2">
                    <BookOpenIcon className="size-4 text-primary" />
                    Cited Source Notes ({sources.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sources.map((source) => (
                      <div
                        key={source._id}
                        onClick={() => openNote(source._id)}
                        className="card bg-base-200 hover:bg-base-300 border border-base-content/10 hover:border-primary/40 cursor-pointer transition-all duration-200 p-3.5 shadow-sm group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                            {source.title}
                          </h5>
                          <span className="badge badge-primary badge-xs shrink-0">
                            {source.similarity}% match
                          </span>
                        </div>
                        <p className="text-xs text-base-content/60 mt-1.5 line-clamp-2">{source.preview}...</p>
                        <div className="flex items-center text-[10px] text-primary font-medium mt-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>Open note</span>
                          <ExternalLinkIcon className="size-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isProcessing && !streamedAnswer && (
                <div className="text-center py-12 text-base-content/60">
                  <BrainIcon className="size-12 mx-auto mb-3 opacity-30 text-primary" />
                  <p className="font-medium text-base">Ask questions across your entire knowledge base</p>
                  <p className="text-xs mt-1 opacity-70">
                    Gemini AI retrieves relevant notes using semantic vector search and synthesizes answers with citations.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Semantic Search View */}
          {activeTab === "search" && (
            <div>
              {searchResults.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                    Found {searchResults.length} semantically relevant notes
                  </p>
                  {searchResults.map((result) => (
                    <div
                      key={result._id}
                      onClick={() => openNote(result._id)}
                      className="p-4 rounded-xl bg-base-200/70 hover:bg-base-300 border border-base-content/10 hover:border-primary/40 cursor-pointer transition-all duration-200 group"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-base group-hover:text-primary transition-colors flex items-center gap-2">
                          <FileTextIcon className="size-4 text-primary" />
                          {result.title}
                        </h4>
                        <div className="badge badge-primary badge-sm font-mono">
                          {Math.round(result.similarity * 100)}% Match
                        </div>
                      </div>
                      <p className="text-sm text-base-content/70 mt-2 line-clamp-2 font-sans">
                        {result.content}
                      </p>
                      <div className="flex items-center justify-between text-xs text-base-content/40 mt-3 pt-2 border-t border-base-content/5">
                        <span>{new Date(result.createdAt).toLocaleDateString()}</span>
                        <span className="text-primary font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          View Note <ArrowRightIcon className="size-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !isProcessing && (
                <div className="text-center py-12 text-base-content/60">
                  <SearchIcon className="size-12 mx-auto mb-3 opacity-30 text-primary" />
                  <p className="font-medium text-base">Search thoughts and ideas by conceptual similarity</p>
                  <p className="text-xs mt-1 opacity-70">
                    Find notes even if they use completely different keywords or phrasing.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AskBrainModal;
