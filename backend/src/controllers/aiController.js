import Note from "../models/Note.js";
import {
  streamAIText,
  generateNoteTitle,
  getEmbedding,
  cosineSimilarity,
  askSecondBrain,
  processVoiceMemo,
  explainConnection,
} from "../services/geminiService.js";

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

/**
 * Semantic Vector Search over all user notes
 */
export const semanticSearch = async (req, res) => {
  const { query, limit = 5 } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: "Search query is required" });
  }

  try {
    const queryEmbedding = await getEmbedding(query);
    if (!queryEmbedding || queryEmbedding.length === 0) {
      return res.status(500).json({ error: "Failed to generate query embedding" });
    }

    const notes = await Note.find();
    
    const scoredNotes = [];

    for (const note of notes) {
      let embedding = note.embedding;
      // If note has no embedding yet, compute and save it
      if (!embedding || embedding.length === 0) {
        embedding = await getEmbedding(`${note.title}\n\n${note.content}`);
        note.embedding = embedding;
        await note.save().catch((e) => console.warn("Save embedding error:", e.message));
      }

      const score = cosineSimilarity(queryEmbedding, embedding);
      scoredNotes.push({
        _id: note._id,
        title: note.title,
        content: note.content,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        similarity: Math.round(score * 1000) / 1000,
      });
    }

    // Sort by highest similarity
    scoredNotes.sort((a, b) => b.similarity - a.similarity);

    const topResults = scoredNotes.slice(0, limit);
    res.status(200).json({ results: topResults });
  } catch (error) {
    console.error("Semantic search error:", error);
    res.status(500).json({ error: error.message || "Semantic search failed" });
  }
};

/**
 * Ask Your Second Brain (RAG Streaming Chat)
 */
export const askBrain = async (req, res) => {
  const { question } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Question is required" });
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const queryEmbedding = await getEmbedding(question);
    const notes = await Note.find();

    const scoredNotes = [];
    for (const note of notes) {
      let embedding = note.embedding;
      if (!embedding || embedding.length === 0) {
        embedding = await getEmbedding(`${note.title}\n\n${note.content}`);
        note.embedding = embedding;
        await note.save().catch(() => {});
      }
      const score = cosineSimilarity(queryEmbedding, embedding);
      scoredNotes.push({
        _id: note._id,
        title: note.title,
        content: note.content,
        similarity: score,
      });
    }

    scoredNotes.sort((a, b) => b.similarity - a.similarity);
    // Take top 4 most relevant notes
    const relevantNotes = scoredNotes.slice(0, 4);

    // Send sources metadata first
    res.write(
      `data: ${JSON.stringify({
        sources: relevantNotes.map((n) => ({
          _id: n._id,
          title: n.title,
          similarity: Math.round(n.similarity * 100),
          preview: n.content.substring(0, 100),
        })),
      })}\n\n`
    );

    // Stream the synthesized answer
    await askSecondBrain({
      question,
      relevantNotes,
      onChunk: (chunk) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      },
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Ask Brain error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message || "Failed to ask second brain" })}\n\n`);
    res.end();
  }
};

/**
 * Process Voice Memo / Speech Dump into Clean Structured Note
 */
export const transcribeVoice = async (req, res) => {
  const { audioBase64, mimeType, rawTranscript } = req.body;

  if (!audioBase64 && (!rawTranscript || !rawTranscript.trim())) {
    return res.status(400).json({ error: "Either audioBase64 or rawTranscript is required" });
  }

  try {
    const structuredResult = await processVoiceMemo({
      audioBase64,
      mimeType,
      rawTranscript,
    });

    res.status(200).json(structuredResult);
  } catch (error) {
    console.error("Transcribe voice error:", error);
    res.status(500).json({ error: error.message || "Failed to process voice memo" });
  }
};

/**
 * Sync / Backfill embeddings for all existing notes
 */
export const syncEmbeddings = async (req, res) => {
  try {
    const notes = await Note.find({ $or: [{ embedding: { $size: 0 } }, { embedding: { $exists: false } }] });
    let updatedCount = 0;

    for (const note of notes) {
      const embedding = await getEmbedding(`${note.title}\n\n${note.content}`);
      if (embedding.length > 0) {
        note.embedding = embedding;
        await note.save();
        updatedCount++;
      }
    }

    res.status(200).json({ message: `Successfully synced ${updatedCount} notes with AI embeddings!` });
  } catch (error) {
    console.error("Sync embeddings error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get Semantically Related Notes for a specific note ID + AI explanations
 */
export const getRelatedNotes = async (req, res) => {
  const { id } = req.params;

  try {
    const currentNote = await Note.findById(id);
    if (!currentNote) {
      return res.status(404).json({ error: "Note not found" });
    }

    let currentEmbedding = currentNote.embedding;
    if (!currentEmbedding || currentEmbedding.length === 0) {
      currentEmbedding = await getEmbedding(`${currentNote.title}\n\n${currentNote.content}`);
      currentNote.embedding = currentEmbedding;
      await currentNote.save().catch(() => {});
    }

    const allNotes = await Note.find({ _id: { $ne: id } });
    const scored = [];

    for (const note of allNotes) {
      let embedding = note.embedding;
      if (!embedding || embedding.length === 0) {
        embedding = await getEmbedding(`${note.title}\n\n${note.content}`);
        note.embedding = embedding;
        await note.save().catch(() => {});
      }

      const score = cosineSimilarity(currentEmbedding, embedding);
      if (score > 0.35) {
        scored.push({
          _id: note._id,
          title: note.title,
          content: note.content,
          similarity: Math.round(score * 100),
          createdAt: note.createdAt,
        });
      }
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    const topRelated = scored.slice(0, 3);

    // Generate quick connection explanation for top related note if available
    const enrichedResults = await Promise.all(
      topRelated.map(async (related) => {
        let reason = "";
        try {
          reason = await explainConnection(currentNote, related);
        } catch {
          reason = "Related by contextual and semantic similarity.";
        }
        return {
          ...related,
          reason,
        };
      })
    );

    res.status(200).json({ relatedNotes: enrichedResults });
  } catch (error) {
    console.error("Get related notes error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch related notes" });
  }
};

/**
 * Generate 2D Knowledge Graph nodes and semantic similarity links
 */
export const getKnowledgeGraph = async (req, res) => {
  try {
    const notes = await Note.find();
    if (notes.length === 0) {
      return res.status(200).json({ nodes: [], links: [] });
    }

    // Ensure embeddings exist
    for (const note of notes) {
      if (!note.embedding || note.embedding.length === 0) {
        note.embedding = await getEmbedding(`${note.title}\n\n${note.content}`);
        await note.save().catch(() => {});
      }
    }

    const nodes = notes.map((n, index) => ({
      id: String(n._id),
      title: n.title,
      preview: n.content.substring(0, 80),
      createdAt: n.createdAt,
      group: (index % 5) + 1,
    }));

    const links = [];
    // Compute pairwise similarity
    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const score = cosineSimilarity(notes[i].embedding, notes[j].embedding);
        // Link notes if similarity is high enough
        if (score > 0.45) {
          links.push({
            source: String(notes[i]._id),
            target: String(notes[j]._id),
            similarity: Math.round(score * 100),
            value: Math.max(1, Math.round((score - 0.45) * 10)),
          });
        }
      }
    }

    res.status(200).json({ nodes, links });
  } catch (error) {
    console.error("Knowledge graph error:", error);
    res.status(500).json({ error: error.message || "Failed to generate knowledge graph" });
  }
};




