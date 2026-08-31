import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import api from "../lib/axios";
import toast from "react-hot-toast";
import {
  ArrowLeftIcon,
  LoaderIcon,
  Trash2Icon,
  DownloadIcon,
  EyeIcon,
  PenLineIcon,
  CheckIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import AICopilot from "../components/AICopilot";
import AITitleButton from "../components/AITitleButton";
import RelatedNotes from "../components/RelatedNotes";
import MermaidDiagram from "../components/MermaidDiagram";

const NoteDetailPage = () => {
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewTab, setViewTab] = useState("edit"); // 'edit' or 'preview'

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

  const handleDownloadMarkdown = () => {
    if (!note) return;
    const mdContent = `# ${note.title}\n\n${note.content}`;
    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title.toLowerCase().replace(/[^a-z0-9]/gi, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Note exported as Markdown! 📄");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <LoaderIcon className="animate-spin size-10 text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200/50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Top Navigation & Action Bar */}
          <div className="flex items-center justify-between mb-6">
            <Link to="/" className="btn btn-ghost gap-2">
              <ArrowLeftIcon className="h-5 w-5" />
              <span>Back to Notes</span>
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="btn btn-outline btn-sm gap-1.5"
                title="Export as Markdown (.md)"
              >
                <DownloadIcon className="size-4" />
                <span className="hidden sm:inline">Export .md</span>
              </button>

              <button
                onClick={handleDelete}
                className="btn btn-error btn-outline btn-sm gap-1.5"
              >
                <Trash2Icon className="size-4" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-content/10 shadow-md">
            <div className="card-body p-6">
              {/* Title Section */}
              <div className="form-control mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="label p-0">
                    <span className="label-text font-semibold text-sm">Note Title</span>
                  </label>
                  <AITitleButton
                    content={note.content}
                    onTitleGenerated={(newTitle) => setNote({ ...note, title: newTitle })}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Note title"
                  className="input input-bordered w-full font-bold text-lg"
                  value={note.title}
                  onChange={(e) => setNote({ ...note, title: e.target.value })}
                />
              </div>

              {/* Content Section with Edit / Preview Switcher */}
              <div className="form-control mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="label p-0">
                    <span className="label-text font-semibold text-sm">Content</span>
                  </label>

                  {/* Edit / Markdown Preview Tabs */}
                  <div className="flex items-center bg-base-200 p-0.5 rounded-lg border border-base-content/5">
                    <button
                      type="button"
                      onClick={() => setViewTab("edit")}
                      className={`btn btn-xs gap-1 normal-case ${
                        viewTab === "edit" ? "btn-primary shadow-sm" : "btn-ghost"
                      }`}
                    >
                      <PenLineIcon className="size-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewTab("preview")}
                      className={`btn btn-xs gap-1 normal-case ${
                        viewTab === "preview" ? "btn-primary shadow-sm" : "btn-ghost"
                      }`}
                    >
                      <EyeIcon className="size-3" />
                      <span>Markdown Preview</span>
                    </button>
                  </div>
                </div>

                {/* Inline AI Copilot (Available in edit mode) */}
                {viewTab === "edit" && (
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
                )}

                {/* Edit Mode: Textarea */}
                {viewTab === "edit" ? (
                  <textarea
                    placeholder="Write your note here..."
                    className="textarea textarea-bordered h-56 font-mono text-sm leading-relaxed"
                    value={note.content}
                    onChange={(e) => setNote({ ...note, content: e.target.value })}
                  />
                ) : (
                  /* Preview Mode: Rich Formatted Markdown */
                  <div className="p-5 rounded-2xl bg-base-200/60 border border-base-content/10 min-h-[224px] prose prose-sm max-w-none text-base-content leading-relaxed">
                    {note.content ? (
                      <ReactMarkdown>{note.content}</ReactMarkdown>
                    ) : (
                      <p className="text-base-content/40 italic">Empty note</p>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="card-actions justify-end mt-2">
                <button
                  className="btn btn-primary shadow-md"
                  disabled={saving}
                  onClick={handleSave}
                >
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
