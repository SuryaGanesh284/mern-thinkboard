import { useEffect } from "react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import api from "../lib/axios";
import toast from "react-hot-toast";
import { ArrowLeftIcon, LoaderIcon, Trash2Icon } from "lucide-react";
import AICopilot from "../components/AICopilot";
import AITitleButton from "../components/AITitleButton";
import RelatedNotes from "../components/RelatedNotes";
import MermaidDiagram from "../components/MermaidDiagram";

const NoteDetailPage = () => {
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();

  const { id } = useParams();

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const res = await api.get(`/notes/${id}`);
        setNote(res.data);
      } catch (error) {
        console.log("Error in fetching note", error);
        toast.error("Failed to fetch the note");
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this note?")) return;

    try {
      await api.delete(`/notes/${id}`);
      toast.success("Note deleted");
      navigate("/");
    } catch (error) {
      console.log("Error deleting the note:", error);
      toast.error("Failed to delete note");
    }
  };

  const handleSave = async () => {
    if (!note.title.trim() || !note.content.trim()) {
      toast.error("Please add a title or content");
      return;
    }

    setSaving(true);

    try {
      await api.put(`/notes/${id}`, note);
      toast.success("Note updated successfully");
      navigate("/");
    } catch (error) {
      console.log("Error saving the note:", error);
      toast.error("Failed to update note");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <LoaderIcon className="animate-spin size-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link to="/" className="btn btn-ghost">
              <ArrowLeftIcon className="h-5 w-5" />
              Back to Notes
            </Link>
            <button onClick={handleDelete} className="btn btn-error btn-outline">
              <Trash2Icon className="h-5 w-5" />
              Delete Note
            </button>
          </div>

          <div className="card bg-base-100">
            <div className="card-body">
              <div className="form-control mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="label p-0">
                    <span className="label-text font-medium">Title</span>
                  </label>
                  <AITitleButton
                    content={note.content}
                    onTitleGenerated={(newTitle) => setNote({ ...note, title: newTitle })}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Note title"
                  className="input input-bordered w-full"
                  value={note.title}
                  onChange={(e) => setNote({ ...note, title: e.target.value })}
                />
              </div>

              <div className="form-control mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="label p-0">
                    <span className="label-text font-medium">Content</span>
                  </label>
                </div>

                <AICopilot
                  currentTitle={note.title}
                  currentContent={note.content}
                  onApplyContent={(newContent) => setNote({ ...note, content: newContent })}
                  onAppendContent={(appended) =>
                    setNote({
                      ...note,
                      content: note.content ? `${note.content}\n\n${appended}` : appended,
                    })
                  }
                />

                <textarea
                  placeholder="Write your note here..."
                  className="textarea textarea-bordered h-44 font-sans text-base leading-relaxed"
                  value={note.content}
                  onChange={(e) => setNote({ ...note, content: e.target.value })}
                />
              </div>

              <div className="card-actions justify-end">
                <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>

          {/* AI Visual Mindmap & Architecture Diagram */}
          <MermaidDiagram
            noteTitle={note.title}
            noteContent={note.content}
            onInsertToNote={(mermaidBlock) =>
              setNote({
                ...note,
                content: note.content ? `${note.content}\n${mermaidBlock}` : mermaidBlock,
              })
            }
          />

          {/* AI-Connected Related Thoughts & Knowledge Graph */}
          <RelatedNotes noteId={id} />
        </div>
      </div>
    </div>
  );
};
export default NoteDetailPage;
