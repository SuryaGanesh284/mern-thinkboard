import { useState, useEffect } from "react";
import { Link } from "react-router";
import { SparklesIcon, ArrowRightIcon, NetworkIcon, Loader2Icon } from "lucide-react";
import api from "../lib/axios";

const RelatedNotes = ({ noteId }) => {
  const [relatedNotes, setRelatedNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRelated = async () => {
      if (!noteId) return;
      setLoading(true);
      try {
        const res = await api.get(`/ai/related-notes/${noteId}`);
        setRelatedNotes(res.data.relatedNotes || []);
      } catch (error) {
        console.error("Failed to fetch related notes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRelated();
  }, [noteId]);

  if (loading) {
    return (
      <div className="card bg-base-100 p-4 border border-base-content/10 shadow-sm mt-6">
        <div className="flex items-center gap-2 text-xs text-base-content/60">
          <Loader2Icon className="size-3.5 animate-spin text-primary" />
          <span>Discovering semantically related thoughts...</span>
        </div>
      </div>
    );
  }

  if (relatedNotes.length === 0) {
    return null;
  }

  return (
    <div className="card bg-base-100 border border-primary/20 p-5 shadow-md mt-6 animate-fadeIn">
      <div className="flex items-center justify-between border-b border-base-content/10 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <NetworkIcon className="size-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-base-content flex items-center gap-2">
              Related Thoughts & Ideas
              <span className="badge badge-primary badge-xs">AI Knowledge Graph</span>
            </h3>
            <p className="text-[11px] text-base-content/60">Automatically connected through conceptual similarity</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {relatedNotes.map((item) => (
          <Link
            key={item._id}
            to={`/note/${item._id}`}
            className="p-3.5 rounded-xl bg-base-200/80 hover:bg-base-300 border border-base-content/10 hover:border-primary/40 transition-all duration-200 flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-start justify-between gap-1.5 mb-1.5">
                <h4 className="font-semibold text-xs text-base-content group-hover:text-primary transition-colors line-clamp-1">
                  {item.title}
                </h4>
                <span className="badge badge-primary badge-xs shrink-0 font-mono">
                  {item.similarity}%
                </span>
              </div>

              {/* AI connection reason */}
              {item.reason && (
                <div className="p-2 rounded-lg bg-primary/5 border border-primary/10 text-[11px] text-primary/90 leading-tight mb-2 flex items-start gap-1">
                  <SparklesIcon className="size-3 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{item.reason}</span>
                </div>
              )}

              <p className="text-[11px] text-base-content/60 line-clamp-2">{item.content}</p>
            </div>

            <div className="flex items-center justify-end text-[10px] text-primary font-medium mt-2.5 gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>View Thought</span>
              <ArrowRightIcon className="size-3" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default RelatedNotes;
