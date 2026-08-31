import { streamAIText, generateNoteTitle } from "../services/geminiService.js";

/**
 * Handle streaming AI requests via SSE (Server-Sent Events)
 */
export const streamAI = async (req, res) => {
  const { text, action, customPrompt, noteTitle } = req.body;

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    await streamAIText({
      text,
      action,
      customPrompt,
      noteTitle,
      onChunk: (chunk) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      },
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("AI Streaming Error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message || "AI generation failed" })}\n\n`);
    res.end();
  }
};

/**
 * Handle auto-generating title for notes
 */
export const getNoteTitle = async (req, res) => {
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: "Content is required to generate a title" });
  }

  try {
    const title = await generateNoteTitle({ content });
    res.status(200).json({ title });
  } catch (error) {
    console.error("Generate Title Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate title" });
  }
};
