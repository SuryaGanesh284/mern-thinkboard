import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

let aiClient = null;

export const getGeminiClient = () => {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in backend/.env");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
};

const CANDIDATE_MODELS = ["gemini-flash-latest", "gemini-2.5-pro", "gemini-pro-latest"];

/**
 * Helper to stream content with model fallback on 503 errors
 */
const generateStreamWithFallback = async (ai, promptContent, onChunk) => {
  let lastError = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const responseStream = await ai.models.generateContentStream({
        model,
        contents: promptContent,
      });

      for await (const chunk of responseStream) {
        const textChunk = chunk.text;
        if (textChunk) {
          onChunk(textChunk);
        }
      }
      return; // Succeeded!
    } catch (err) {
      console.warn(`Model ${model} stream error (${err.message?.substring(0, 80)}), trying next candidate...`);
      lastError = err;
    }
  }
  throw lastError || new Error("All AI models failed to respond");
};

/**
 * Stream AI transformation / generation via Server-Sent Events
 */
export const streamAIText = async ({ text = "", action = "continue", customPrompt = "", noteTitle = "", onChunk }) => {
  const ai = getGeminiClient();

  let instruction = ACTION_PROMPTS[action] || customPrompt || "Enhance and complete the text.";
  
  if (action === "custom" && customPrompt) {
    instruction = `Perform the following instruction on the provided note text: "${customPrompt}". Return only the resulting text without conversational preambles.`;
  }

  const promptContent = `You are ThinkBoard AI, an elite, context-aware writing copilot integrated into a note-taking app.
Always output clean, high quality text or Markdown directly. Never output conversational filler.

${noteTitle ? `Note Title: ${noteTitle}\n` : ""}${text ? `Current Note Content:\n"""\n${text}\n"""` : "(Empty note)"}

Task Instruction:
${instruction}`.trim();

  await generateStreamWithFallback(ai, promptContent, onChunk);
};

/**
 * Generate a smart, concise title for note content
 */
export const generateNoteTitle = async ({ content }) => {
  const ai = getGeminiClient();
  const res = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: `Analyze the following note content and generate a crisp, descriptive, professional title (maximum 4-6 words). Do not put quotes or punctuation around the title. Return ONLY the title text.\n\nContent:\n${content.substring(0, 1500)}`,
  });

  return (res.text || "Untitled Note").trim().replace(/^["']|["']$/g, "");
};

/**
 * Generate 3072-dimensional vector embedding for text
 */
export const getEmbedding = async (text) => {
  if (!text || !text.trim()) return [];
  const ai = getGeminiClient();
  try {
    const res = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: text.substring(0, 4000),
    });
    return res.embeddings?.[0]?.values || [];
  } catch (error) {
    console.error("Embedding generation error:", error);
    return [];
  }
};

/**
 * Calculate Cosine Similarity between two numeric vectors
 */
export const cosineSimilarity = (vecA, vecB) => {
  if (!vecA?.length || !vecB?.length || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Ask Your Second Brain (RAG Engine with Citations)
 */
export const askSecondBrain = async ({ question, relevantNotes, onChunk }) => {
  const ai = getGeminiClient();

  const contextBlocks = relevantNotes
    .map(
      (n, i) => `[Source Note #${i + 1}]
Note ID: ${n._id}
Title: ${n.title}
Content:
${n.content}
`
    )
    .join("\n---\n");

  const promptContent = `You are ThinkBoard's Second Brain AI.
Answer the user's question accurately using ONLY the information provided in the user's personal notes below.
Guidelines:
1. Synthesize insights clearly with structured Markdown and concise bullet points.
2. Whenever you mention or derive a fact from a specific note, cite it inline like **[Source: Note Title]**.
3. If the user's notes do not contain the answer, politely state that you couldn't find it in their notes.

[User's Personal Notes Knowledge Base]
${contextBlocks || "(No notes found in knowledge base)"}

[User Question]
${question}`.trim();

  await generateStreamWithFallback(ai, promptContent, onChunk);
};

/**
 * Process Voice Memo / Speech Dump into Clean Structured Note (AudioPen / Granola style)
 */
export const processVoiceMemo = async ({ audioBase64, mimeType = "audio/webm", rawTranscript = "" }) => {
  const ai = getGeminiClient();

  const instructions = `You are an expert executive thought organizer and note structuring specialist (similar to AudioPen and Granola).
Your task is to take this spoken voice memo / brain dump and transform it into a beautifully structured, highly readable personal note.

Requirements:
1. Remove all filler words (e.g. "um", "uh", "you know", "like", "so basically", false starts, stutters).
2. Fix run-on sentences and grammatical slips while strictly preserving the user's authentic ideas, opinions, and intent.
3. Organize the thoughts into logical sections with clear Markdown headers (##, ###), clean bullet points, and bold emphasis where impactful.
4. Generate a punchy, crisp title (3-6 words).
5. Extract 2-4 smart category tags (e.g. ["Engineering", "Roadmap", "Design"]).
6. If any actionable to-dos or commitments were mentioned, extract them into a checklist (- [ ] Task).

Return your response strictly in the following JSON format:
{
  "title": "Concise Descriptive Title",
  "content": "The full polished note in structured Markdown format...",
  "tags": ["Tag1", "Tag2"],
  "actionItems": ["Action item 1", "Action item 2"]
}`;

  let promptContents;
  if (audioBase64) {
    promptContents = [
      {
        inlineData: {
          mimeType,
          data: audioBase64,
        },
      },
      instructions,
    ];
  } else {
    promptContents = `${instructions}\n\nSpoken Transcript:\n"""\n${rawTranscript}\n"""`;
  }

  let resText = "";
  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: promptContents,
      });
      resText = res.text || "";
      if (resText) break;
    } catch (e) {
      console.warn(`Model ${model} failed for voice memo:`, e.message?.substring(0, 80));
    }
  }

  // Parse JSON response
  try {
    const cleaned = resText.replace(/```json/gi, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn("Failed to parse voice memo JSON, fallback to raw text:", err.message);
    return {
      title: "Voice Brain Dump",
      content: resText || rawTranscript,
      tags: ["Voice Memo"],
      actionItems: [],
    };
  }
};

/**
 * Explain the semantic connection between two related notes
 */
export const explainConnection = async (noteA, noteB) => {
  const ai = getGeminiClient();
  const prompt = `Explain in one short, punchy sentence (maximum 12 words) why these two notes are conceptually connected.
Note 1: "${noteA.title}" - ${noteA.content.substring(0, 200)}
Note 2: "${noteB.title}" - ${noteB.content.substring(0, 200)}
Return only the short sentence.`;

  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      return (res.text || "").trim().replace(/^["']|["']$/g, "");
    } catch {
      // fallback
    }
  }
  return "Connected by related concepts and shared themes.";
};

/**
 * Generate Visual Mindmaps / Flowcharts in Mermaid.js syntax from note content
 */
export const generateDiagram = async ({ content, title = "", diagramType = "auto" }) => {
  const ai = getGeminiClient();

  const prompt = `You are an expert systems visualizer and Mermaid.js diagram architect.
Analyze the following note and generate a clean, visually clear, and accurate Mermaid.js diagram.

Requirements:
1. Diagram type preference: ${diagramType === "auto" ? "Choose the best fit (mindmap for concepts/ideas, graph TD for architectures/processes, sequenceDiagram for interactions)" : diagramType}.
2. Ensure strict, valid Mermaid syntax. Do not invent custom keywords.
3. For flowcharts, use "graph TD" with clear descriptive node labels: id["Label Text"].
4. For mindmaps, use valid "mindmap" syntax with proper root and nested indentation.
5. Do NOT include Markdown code blocks (e.g. do NOT write \`\`\`mermaid or \`\`\`). Return ONLY the pure Mermaid code.

Note Title: "${title}"
Note Content:
"""
${content.substring(0, 3000)}
"""`;

  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      let code = (res.text || "").trim();
      // Remove any accidental markdown backticks
      code = code.replace(/```mermaid/gi, "").replace(/```/g, "").trim();
      if (code) {
        return { mermaidCode: code, diagramType };
      }
    } catch (e) {
      console.warn(`Model ${model} failed for diagram generation:`, e.message?.substring(0, 80));
    }
  }

  // Fallback mindmap
  return {
    mermaidCode: `mindmap\n  root(("${title || "Note"}"))\n    Key Concepts\n      Ideas\n      Implementation\n    Next Steps\n      Action Items`,
    diagramType: "mindmap",
  };
};




