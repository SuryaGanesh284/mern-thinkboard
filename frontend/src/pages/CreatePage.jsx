import { ArrowLeftIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router";
import api from "../lib/axios";
import AICopilot from "../components/AICopilot";
import AITitleButton from "../components/AITitleButton";
import VoiceRecorder from "../components/VoiceRecorder";
import MermaidDiagram from "../components/MermaidDiagram";

const CreatePage = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast.error("All fields are required");
      return;
    }

    setLoading(true);
    try {
      await api.post("/notes", {
        title,
        content,
      });

      toast.success("Note created successfully!");
      navigate("/");
    } catch (error) {
      console.log("Error creating note", error);
      if (error.response.status === 429) {
        toast.error("Slow down! You're creating notes too fast", {
          duration: 4000,
          icon: "💀",
        });
      } else {
        toast.error("Failed to create note");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Link to={"/"} className="btn btn-ghost mb-6">
            <ArrowLeftIcon className="size-5" />
            Back to Notes
          </Link>

          <div className="card bg-base-100">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <h2 className="card-title text-2xl">Create New Note</h2>
              </div>

              {/* Voice Brain Dump Component */}
              <VoiceRecorder
                onApplyVoiceNote={({ title: newTitle, content: newContent }) => {
                  if (newTitle) setTitle(newTitle);
                  if (newContent) setContent(newContent);
                }}
              />

              <form onSubmit={handleSubmit}>
                <div className="form-control mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="label p-0">
                      <span className="label-text font-medium">Title</span>
                    </label>
                    <AITitleButton
                      content={content}
                      onTitleGenerated={(newTitle) => setTitle(newTitle)}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Note Title (or click 'AI Title' to auto-generate)"
                    className="input input-bordered w-full"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="form-control mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="label p-0">
                      <span className="label-text font-medium">Content</span>
                    </label>
                  </div>

                  <AICopilot
                    currentTitle={title}
                    currentContent={content}
                    onApplyContent={(newContent) => setContent(newContent)}
                    onAppendContent={(appended) =>
                      setContent((prev) => (prev ? `${prev}\n\n${appended}` : appended))
                    }
                  />

                  <textarea
                    placeholder="Write your note here (or use ThinkBoard AI to brainstorm and draft)..."
                    className="textarea textarea-bordered h-44 font-sans text-base leading-relaxed"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />

                  {/* AI Mindmap & Diagram Generator */}
                  <MermaidDiagram
                    noteTitle={title}
                    noteContent={content}
                    onInsertToNote={(mermaidBlock) =>
                      setContent((prev) => (prev ? `${prev}\n${mermaidBlock}` : mermaidBlock))
                    }
                  />
                </div>

                <div className="card-actions justify-end">
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? "Creating..." : "Create Note"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default CreatePage;
