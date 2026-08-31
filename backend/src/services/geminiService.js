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

const DEFAULT_MODEL = "gemini-flash-latest";

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
 * Stream AI transformation / generation via Server-Sent Events
 */
export const streamAIText = async ({ text = "", action = "continue", customPrompt = "", noteTitle = "", onChunk }) => {
  const ai = getGeminiClient();

  let instruction = ACTION_PROMPTS[action] || customPrompt || "Enhance and complete the text.";
  
  if (action === "custom" && customPrompt) {
    instruction = `Perform the following instruction on the provided note text: "${customPrompt}". Return only the resulting text without conversational preambles.`;
  }

  const systemInstruction = `You are ThinkBoard AI, an elite, context-aware writing copilot and knowledge assistant integrated into a modern note-taking app.
Always output clean, high quality text or Markdown. Never output conversational filler such as "Sure, here is your note:" or "Here you go:". Start directly with the content.`;

  const promptContent = `
[Note Context]
${noteTitle ? `Note Title: ${noteTitle}\n` : ""}${text ? `Current Note Content:\n"""\n${text}\n"""` : "(Empty note)"}

[Task Instruction]
${instruction}
`.trim();

  const responseStream = await ai.models.generateContentStream({
    model: DEFAULT_MODEL,
    contents: promptContent,
    config: {
      systemInstruction,
    },
  });

  for await (const chunk of responseStream) {
    const textChunk = chunk.text;
    if (textChunk) {
      onChunk(textChunk);
    }
  }
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
