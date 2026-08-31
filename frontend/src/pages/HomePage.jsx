import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import RateLimitedUI from "../components/RateLimitedUI";
import api from "../lib/axios";
import toast from "react-hot-toast";
import NoteCard from "../components/NoteCard";
import NotesNotFound from "../components/NotesNotFound";
import KnowledgeGraph from "../components/KnowledgeGraph";
import { LayoutGridIcon, NetworkIcon, SparklesIcon } from "lucide-react";

const HomePage = () => {
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("cards"); // 'cards' or 'graph'

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await api.get("/notes");
        setNotes(res.data);
        setIsRateLimited(false);
      } catch (error) {
        console.log("Error fetching notes", error);
        if (error.response?.status === 429) {
          setIsRateLimited(true);
        } else {
          toast.error("Failed to load notes");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, []);

  return (
    <div className="min-h-screen bg-base-200/50">
      <Navbar />

      {isRateLimited && <RateLimitedUI />}

      <div className="max-w-7xl mx-auto p-4 sm:p-6 mt-2">
        {/* Top Control Bar with View Switcher */}
        {!isRateLimited && notes.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 bg-base-100 p-3.5 rounded-2xl border border-base-content/10 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-base-content">Your Knowledge Base</span>
              <span className="badge badge-sm badge-primary font-mono">{notes.length} notes</span>
            </div>

            {/* View Switcher Tabs */}
            <div className="flex items-center bg-base-200 p-1 rounded-xl border border-base-content/5">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`btn btn-xs sm:btn-sm gap-1.5 normal-case rounded-lg transition-all ${
                  viewMode === "cards" ? "btn-primary shadow-sm" : "btn-ghost"
                }`}
              >
                <LayoutGridIcon className="size-3.5 sm:size-4" />
                <span>Notes Grid</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("graph")}
                className={`btn btn-xs sm:btn-sm gap-1.5 normal-case rounded-lg transition-all ${
                  viewMode === "graph" ? "btn-primary shadow-sm" : "btn-ghost"
                }`}
              >
                <NetworkIcon className="size-3.5 sm:size-4" />
                <span>Knowledge Graph</span>
                <span className="badge badge-primary badge-xs">AI</span>
              </button>
            </div>
          </div>
        )}

        {loading && <div className="text-center text-primary py-16 font-medium">Loading your second brain...</div>}

        {notes.length === 0 && !loading && !isRateLimited && <NotesNotFound />}

        {/* View Mode: Cards Grid */}
        {viewMode === "cards" && notes.length > 0 && !isRateLimited && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
            {notes.map((note) => (
              <NoteCard key={note._id} note={note} setNotes={setNotes} />
            ))}
          </div>
        )}

        {/* View Mode: Interactive 2D Knowledge Graph */}
        {viewMode === "graph" && notes.length > 0 && !isRateLimited && (
          <div className="animate-fadeIn">
            <KnowledgeGraph />
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
