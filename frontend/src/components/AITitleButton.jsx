import { useState } from "react";
import { SparklesIcon, Loader2Icon } from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/axios";

const AITitleButton = ({ content, onTitleGenerated }) => {
  const [loading, setLoading] = useState(false);

  const handleGenerateTitle = async () => {
    if (!content || !content.trim()) {
      toast.error("Please write some content first to generate a title");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/ai/generate-title", { content });
      if (res.data?.title) {
        onTitleGenerated(res.data.title);
        toast.success(`Generated: "${res.data.title}"`);
      }
    } catch (error) {
      console.error("Failed to generate title:", error);
      toast.error("Failed to generate title with AI");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGenerateTitle}
      disabled={loading || !content?.trim()}
      className="btn btn-xs btn-outline btn-primary gap-1 ml-auto"
      title="Generate a smart title with AI based on your content"
    >
      {loading ? (
        <Loader2Icon className="size-3 animate-spin" />
      ) : (
        <SparklesIcon className="size-3 text-amber-400 animate-pulse" />
      )}
      <span>{loading ? "Thinking..." : "AI Title"}</span>
    </button>
  );
};

export default AITitleButton;
