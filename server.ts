import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Meetora connect API" });
  });

  // Gemini Proxy
  app.post("/api/gemini/moderate", async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      // Using gemini-1.5-flash as a stable production model
      const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Analyze the following text for offensive language, hate speech, or inappropriate content. Return only "true" if it is inappropriate, and "false" if it is safe.
      Text: "${text}"`;
      
      const result = await model.generateContent(prompt);
      const isSafe = result.response.text().trim().toLowerCase() === 'true';
      res.json({ isInappropriate: isSafe });
    } catch (error) {
      console.error("Gemini Error:", error);
      res.json({ isInappropriate: false });
    }
  });

  app.post("/api/gemini/translate", async (req, res) => {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) return res.status(400).json({ error: "Text and targetLanguage are required" });
    
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Translate the following text to ${targetLanguage}. Return ONLY the translated text.
      Text: "${text}"`;
      
      const result = await model.generateContent(prompt);
      res.json({ translated: result.response.text().trim() || text });
    } catch (error) {
      console.error("Gemini Error:", error);
      res.json({ translated: text });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
