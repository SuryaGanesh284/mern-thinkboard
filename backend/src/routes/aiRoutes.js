import express from "express";
import {
  streamAI,
  getNoteTitle,
  semanticSearch,
  askBrain,
  syncEmbeddings,
  transcribeVoice,
  getRelatedNotes,
  getKnowledgeGraph,
  createDiagram,
} from "../controllers/aiController.js";

const router = express.Router();

router.post("/stream", streamAI);
router.post("/generate-title", getNoteTitle);
router.post("/semantic-search", semanticSearch);
router.post("/ask-brain", askBrain);
router.post("/sync-embeddings", syncEmbeddings);
router.post("/transcribe-voice", transcribeVoice);
router.get("/related-notes/:id", getRelatedNotes);
router.get("/knowledge-graph", getKnowledgeGraph);
router.post("/generate-diagram", createDiagram);

export default router;
