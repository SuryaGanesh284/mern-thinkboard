import { PenSquareIcon, Trash2Icon, ClockIcon, TagIcon } from "lucide-react";
import { Link } from "react-router";
import { formatDate } from "../lib/utils";
import api from "../lib/axios";
import toast from "react-hot-toast";

const NoteCard = ({ note, setNotes }) => {
  const handleDelete = async (e, id) => {
    e.preventDefault(); // get rid of the navigation behaviour

    if (!window.confirm("Are you sure you want to delete this note?")) return;

    try {
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((n) => n._id !== id)); // get rid of the deleted one
      toast.success("Note deleted successfully");
    } catch (error) {
      console.log("Error in handleDelete", error);
      toast.error("Failed to delete note");
    }
  };

  const wordCount = note.content ? note.content.trim().split(/\s+/).length : 0;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 180));

  return (
    <Link
      to={`/note/${note._id}`}
      className="card bg-base-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 
      border-t-4 border-solid border-[#00FF9D] group"
    >
      <div className="card-body p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="card-title text-base-content text-lg font-bold group-hover:text-primary transition-colors line-clamp-1">
            {note.title}
          </h3>
        </div>

        <p className="text-base-content/70 text-sm line-clamp-3 leading-relaxed mt-1">
          {note.content}
        </p>

        {/* Tags if available */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {note.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="badge badge-xs badge-outline badge-primary font-mono">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="card-actions justify-between items-center mt-4 pt-3 border-t border-base-content/5">
          <div className="flex items-center gap-2 text-xs text-base-content/60">
            <span>{formatDate(new Date(note.createdAt))}</span>
            <span>•</span>
            <span className="flex items-center gap-0.5">
              <ClockIcon className="size-3" />
              {readTimeMin}m read
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="btn btn-ghost btn-xs text-primary p-1">
              <PenSquareIcon className="size-3.5" />
            </span>
            <button
              className="btn btn-ghost btn-xs text-error p-1 hover:bg-error/10"
              onClick={(e) => handleDelete(e, note._id)}
              title="Delete note"
            >
              <Trash2Icon className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
};
export default NoteCard;
