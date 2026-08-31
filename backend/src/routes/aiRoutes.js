import express from "express";
import {
  streamAI,
  getNoteTitle,
  semanticSearch,
  askBrain,
  syncEmbeddings,
} from "../controllers/aiController.js";

const router = express.Router();

router.post("/stream", streamAI);
router.post("/generate-title", getNoteTitle);
router.post("/semantic-search", semanticSearch);
router.post("/ask-brain", askBrain);
router.post("/sync-embeddings", syncEmbeddings);

export default router;
