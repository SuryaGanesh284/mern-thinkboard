import express from "express";
import { streamAI, getNoteTitle } from "../controllers/aiController.js";

const router = express.Router();

router.post("/stream", streamAI);
router.post("/generate-title", getNoteTitle);

export default router;
