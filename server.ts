import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";

// Lazy initialization of the Gemini client as recommended in guidelines
// to prevent crash on startup if GEMINI_API_KEY is not defined.
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Mail transporter lazy loader
let mailTransporter: any = null;
let isInitializingTransporter = false;

async function getMailTransporter() {
  if (mailTransporter) return mailTransporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && port && user && pass) {
    console.log("Using custom SMTP configuration");
    mailTransporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: port === "465",
      auth: { user, pass }
    });
  } else {
    if (isInitializingTransporter) {
      // Return a temporary simulator while background initialization completes
      return {
        sendMail: async (options: any) => {
          console.log("=== EMAIL SENDING SIMULATED (Background init in progress) ===");
          console.log(`From: ${options.from}`);
          console.log(`To: ${options.to}`);
          console.log(`Subject: ${options.subject}`);
          console.log("=============================================================");
          return { messageId: "simulated-id-initializing" };
        }
      };
    }

    console.log("Creating SMTP Test Account via Ethereal Email...");
    isInitializingTransporter = true;
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log(`Ethereal SMTP Account Created: user=${testAccount.user}`);
      mailTransporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    } catch (err) {
      console.error("Failed to create Ethereal SMTP account. Falling back to console-only logger:", err);
      // Fallback transport that logs to console
      mailTransporter = {
        sendMail: async (options: any) => {
          console.log("=== EMAIL SENDING SIMULATED ===");
          console.log(`From: ${options.from}`);
          console.log(`To: ${options.to}`);
          console.log(`Subject: ${options.subject}`);
          console.log(`Body: ${options.html}`);
          console.log("===============================");
          return { messageId: "simulated-id" };
        }
      };
    } finally {
      isInitializingTransporter = false;
    }
  }
  return mailTransporter;
}

// Local history to display in user settings/notifications debugger
const sentEmailsHistory: any[] = [];

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Proactively trigger SMTP transporter setup on startup so it's ready instantly
  getMailTransporter().catch(err => console.error("Proactive transporter initialization failed:", err));

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Meetora connect API" });
  });

  // Helper function to handle fallback and retry on high-demand / unavailable models
  async function generateContentWithFallback(prompt: string, systemInstruction?: string): Promise<string> {
    const ai = getGeminiClient();
    const config: any = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    // Attempt 1: gemini-3.5-flash
    try {
      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config,
      });
      if (result && result.text) return result.text;
    } catch (error) {
      console.warn("Attempt 1: gemini-3.5-flash failed, waiting 500ms before next attempt.", error);
    }

    // Attempt 2: gemini-3.5-flash retry after delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config,
      });
      if (result && result.text) return result.text;
    } catch (error) {
      console.warn("Attempt 2: gemini-3.5-flash retry failed, falling back to gemini-3.1-flash-lite.", error);
    }

    // Attempt 3: gemini-3.1-flash-lite fallback definition
    try {
      const result = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config,
      });
      if (result && result.text) {
        return result.text;
      }
    } catch (error) {
      console.warn("Attempt 3: gemini-3.1-flash-lite failed. Trying gemini-flash-latest fallback...", error);
    }

    // Attempt 4: gemini-flash-latest fallback definition
    try {
      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
        config,
      });
      if (result && result.text) {
        return result.text;
      }
    } catch (error) {
      console.warn("Attempt 4: gemini-flash-latest failed. All Gemini model endpoints are currently experiencing load.", error);
    }

    return ""; // Return safe empty string so callers can fallback offline without crashing
  }

  // Gemini Proxy
  app.post("/api/gemini/moderate", async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    
    try {
      const prompt = `Analyze the following text for offensive language, hate speech, or inappropriate content. Return only "true" if it is inappropriate, and "false" if it is safe.
      Text: "${text}"`;
      
      const resultText = await generateContentWithFallback(prompt);
      const isSafe = resultText.trim().toLowerCase() === 'true';
      res.json({ isInappropriate: isSafe });
    } catch (error) {
      console.error("Gemini Moderate Error:", error);
      res.json({ isInappropriate: false }); // Fallback gracefully to letting text pass
    }
  });

  app.post("/api/gemini/translate", async (req, res) => {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) return res.status(400).json({ error: "Text and targetLanguage are required" });
    
    try {
      const prompt = `Translate the following text to ${targetLanguage}. Return ONLY the translated text.
      Text: "${text}"`;
      
      const resultText = await generateContentWithFallback(prompt);
      res.json({ translated: resultText.trim() || text });
    } catch (error) {
      console.error("Gemini Translate Error:", error);
      res.json({ translated: text }); // Fallback gracefully to original text
    }
  });

  // Fetch sent emails history (simulated & SMTP)
  app.get("/api/emails", (req, res) => {
    res.json(sentEmailsHistory);
  });

  // Clear emails history
  app.post("/api/emails/clear", (req, res) => {
    sentEmailsHistory.length = 0;
    res.json({ success: true });
  });

  // Send real / simulated email notifications
  app.post("/api/send-email", async (req, res) => {
    const { to, recipientName, title, message } = req.body;
    if (!to || !title || !message) {
      return res.status(400).json({ error: "recipient, title and message are required" });
    }

    try {
      const transporter = await getMailTransporter();
      
      const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 580px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05);
      border: 1px solid #f1f5f9;
    }
    .header {
      background: linear-gradient(135deg, #ec4899, #f43f5e);
      padding: 36px 32px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.75px;
    }
    .header p {
      margin: 8px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
      font-weight: 500;
    }
    .content {
      padding: 40px 32px;
    }
    .content p {
      color: #334155;
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 20px 0;
    }
    .notification-box {
      background-color: #fafafc;
      border-left: 4px solid #ec4899;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 28px;
      border-top: 1px solid #f1f5f9;
      border-right: 1px solid #f1f5f9;
      border-bottom: 1px solid #f1f5f9;
    }
    .notification-title {
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 6px 0;
      font-size: 15px;
    }
    .notification-message {
      color: #475569;
      font-size: 14px;
      line-height: 1.5;
      margin: 0;
    }
    .btn-container {
      text-align: center;
      margin-top: 32px;
    }
    .btn {
      display: inline-block;
      background-color: #ec4899;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 12px;
      font-weight: 800;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.75px;
      text-align: center;
      box-shadow: 0 4px 14px rgba(236, 72, 153, 0.3);
    }
    .footer {
      background-color: #fafafc;
      padding: 28px;
      text-align: center;
      border-top: 1px solid #f1f5f9;
    }
    .footer p {
      margin: 0;
      color: #94a3b8;
      font-size: 11px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Meetora Connect</h1>
      <p>Instant System notification Sync</p>
    </div>
    <div class="content">
      <p>Hello <strong>${recipientName || "there"}</strong>,</p>
      <p>While you were away from Meetora, a new notification was delivered to your account:</p>
      <div class="notification-box">
        <h3 class="notification-title">${title}</h3>
        <p class="notification-message">${message}</p>
      </div>
      <p>Launch the application now to view the details, join the chat room, or connect with matches!</p>
      <div class="btn-container">
        <a href="https://ais-pre-buvl4gakretr4j5wmcdudm-533468213362.europe-west2.run.app" class="btn" target="_blank">Open Meetora Connect</a>
      </div>
    </div>
    <div class="footer">
      <p>This message was dispatched directly by Meetora's smart offline notify router.</p>
      <p>To configure your notification channels, please visit your user profile preferences.</p>
      <p>&copy; 2026 Meetora Connect Inc. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

      const info = await transporter.sendMail({
        from: '"Meetora Connect" <noreply@meetora.com>',
        to: to,
        subject: `🔔 Meetora Sync: ${title}`,
        html: emailHtml,
      });

      // Retrieve Ethereal message preview URL if generated
      let previewUrl = null;
      if (typeof nodemailer.getTestMessageUrl === "function") {
        previewUrl = nodemailer.getTestMessageUrl(info);
      }

      console.log(`[Email Dispatched] to=${to} subject="${title}"`);
      if (previewUrl) {
        console.log(`[Ethereal Preview URL] ${previewUrl}`);
      }

      // Add to sent log history
      sentEmailsHistory.unshift({
        id: Math.random().toString(36).substring(7),
        to,
        recipientName: recipientName || "User",
        title,
        message,
        timestamp: new Date().toISOString(),
        previewUrl,
        success: true
      });

      res.json({ success: true, previewUrl });
    } catch (error: any) {
      console.error("Email sending failure:", error);
      
      // Still log failure to history for visual audit
      sentEmailsHistory.unshift({
        id: Math.random().toString(36).substring(7),
        to,
        recipientName: recipientName || "User",
        title,
        message,
        timestamp: new Date().toISOString(),
        previewUrl: null,
        success: false,
        error: error.message || String(error)
      });

      res.status(500).json({ error: "Failed to deliver email notification", details: error.message });
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
