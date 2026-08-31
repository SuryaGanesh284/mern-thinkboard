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

const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
];

const ACTION_PROMPTS = {
  continue: "Continue writing smoothly from where this text left off. Maintain the same tone and context. Do not add conversational intro/outro.",
  polish: "Improve the clarity, grammar, vocabulary, and flow of the following text while strictly preserving its original meaning. Return only the polished text.",
  tone_executive: "Rewrite the following text into a high-impact, crisp executive summary suitable for leadership and managers. Use concise bullet points where appropriate.",
  tone_casual: "Rewrite the following text in a friendly, conversational, and accessible tone while keeping all important information.",
  tone_technical: "Rewrite the following text as structured, professional technical documentation / specifications with clear sections and precise terminology.",
  extract_actions: "Extract all actionable tasks, to-dos, and next steps from the following text into an interactive Markdown checklist format (- [ ] Task description). Add priority tags like [High], [Medium], [Low] where applicable.",
  summarize: "Provide a concise, high-value 2-4 bullet point summary (TL;DR) of the following text.",
  key_takeaways: "Identify the core insights, key concepts, and takeaways from this note in structured bullet points.",
};

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
 * Generate a creative, descriptive, catchy title for note content
 */
export const generateNoteTitle = async ({ content }) => {
  if (!content || !content.trim()) return "Untitled Note";

  const ai = getGeminiClient();
  const prompt = `You are a creative copywriter and editor. Read the following note content and generate a single, highly creative, memorable, and descriptive title (2 to 5 words).
Rules:
1. Do NOT simply repeat or copy the first few words of the content.
2. Capture the core theme, purpose, and essence creatively.
3. Return ONLY the title text. Do NOT include quotes, asterisks, bullet points, or intros like "Here is a title".

Note Content:
"""
${content.substring(0, 1500)}
"""`;

  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      let title = (res.text || "").trim();
      // Remove any quotes, asterisks, markdown, or conversational preambles
      title = title.replace(/^["'*#\s]+|["'*#\s]+$/g, "");
      title = title.split("\n")[0].replace(/^(Title|Here is a title|Suggested title):\s*/i, "").trim();
      if (title && title.length > 2) return title;
    } catch (e) {
      console.warn(`Model ${model} failed for title generation:`, e.message?.substring(0, 80));
    }
  }

  return "Insightful Note";
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
4. Generate a punchy, crisp, creative title (3-6 words).
5. Extract 2-4 smart category tags (e.g. ["Engineering", "Roadmap", "Design"]).
6. If any actionable to-dos or commitments were mentioned, extract them into a checklist (- [ ] Task).

Return your response strictly in the following JSON format:
{
  "title": "Concise Descriptive Title",
  "content": "The full polished note in structured Markdown format...",
  "tags": ["Tag1", "Tag2"],
  "actionItems": ["Action item 1", "Action item 2"]
}`;

  let resText = "";

  // 1. If we have raw transcript from browser speech recognition, process it directly with text for highest speed and precision
  if (rawTranscript && rawTranscript.trim()) {
    const textPrompt = `${instructions}\n\nSpoken Voice Transcript:\n"""\n${rawTranscript}\n"""`;
    for (const model of CANDIDATE_MODELS) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: textPrompt,
        });
        resText = res.text || "";
        if (resText) break;
      } catch (e) {
        console.warn(`Model ${model} failed for voice text:`, e.message?.substring(0, 80));
      }
    }
  }

  // 2. If audioBase64 is provided and we still don't have text, use multimodal audio input
  if (!resText && audioBase64) {
    const audioPrompt = [
      {
        inlineData: {
          mimeType,
          data: audioBase64,
        },
      },
      instructions,
    ];
    for (const model of CANDIDATE_MODELS) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: audioPrompt,
        });
        resText = res.text || "";
        if (resText) break;
      } catch (e) {
        console.warn(`Model ${model} failed for audio input:`, e.message?.substring(0, 80));
      }
    }
  }

  // Parse JSON response
  try {
    const cleaned = resText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed && (parsed.title || parsed.content)) {
      return {
        title: parsed.title || "Spoken Thoughts",
        content: parsed.content || rawTranscript,
        tags: parsed.tags || ["Voice Note"],
        actionItems: parsed.actionItems || [],
      };
    }
  } catch (err) {
    console.warn("Failed to parse voice memo JSON, fallback:", err.message);
  }

  return {
    title: rawTranscript ? "Spoken Thoughts" : "Voice Brain Dump",
    content: resText || rawTranscript || "Voice memo captured.",
    tags: ["Voice Note", "Thoughts"],
    actionItems: [],
  };
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




