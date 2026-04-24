const OpenAI = require('openai');
const kb = require('./knowledgeBase');
const personality = require('../config/personality.json');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple in-memory session store
const sessions = {};

exports.handleChat = async (req, res) => {
  const { message, sessionId = 'default', history: clientHistory } = req.body;

  if (!message) {
    return res.status(400).json({ error: "No message provided" });
  }

  // 0. Initialize SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Initialize or retrieve session history (server-side backup)
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      history: [],
      intent: null,
      context: {}
    };
  }

  const session = sessions[sessionId];

  try {
    // 1. Retrieve relevant project context
    const relevantProjects = kb.search(message);
    const contextText = relevantProjects.length > 0 
      ? "\nSUPPORTING EVIDENCE FROM PORTFOLIO:\n" + relevantProjects.map(p => {
          const sanitizedContent = p.content.replace(/## Client\n[\s\S]*?(?=\n##|$)/, "## Client\n[Confidential]\n");
          return `Project: ${p.title}\n${sanitizedContent}`;
        }).join("\n\n---\n\n")
      : "\nNo specific project data matched this query. Speak generally based on your Boss's broad technical experience.";

    // 2. Prepare System Prompt with new Brevity guidelines
    const systemPrompt = `
      ${personality.persona.description}
      
      TONE & STYLE: ${personality.persona.tone}. ${personality.communication_guidelines.style}
      PRONOUNS: Use '${personality.persona.pronouns.self}' for self, and refer to your creator as '${personality.persona.owner}'.
      
      CORE MISSION: Turn visitor interest into trust and action.
      
      CONVERSATIONAL RULES:
      ${personality.communication_guidelines.conversational_flow.join('\n')}
      
      STRATEGIC RULES:
      1. DISCOVERY FIRST: Talk like a human first. Use curious questions to identify if they are a Client, Recruiter, or Founder.
      2. PROOF-HEAVY: Don't just list tech. Mention a specific challenge solved or project context (e.g., 'He scaled a fintech app to 10k+ concurrent users').
      3. CONCISE BUT IMPACTFUL: Aim for 2-3 sharp sentences (roughly 20-30 words) for conversational turns. Be direct and punchy.
      4. NO PREMATURE LINKS: Only offer booking or portfolio links once intent is confirmed.
      5. TECHNICAL AUTHORITY: Speak with the confidence of a lead engineer.
      6. CALLS TO ACTION LINKS:
         - Book a call: ${personality.persona.links.calendly}
         - View Code (GitHub): ${personality.persona.links.github}
         - Hire on Upwork: ${personality.persona.links.upwork}
      7. CONFIDENTIALITY: NEVER share specific 'Client' names.
      
      Remember: Every sentence must add value. Lead the sale through technical authority.
    `;


    // 3. Prepare message list
    // Use client-provided history as primary source, fallback to server-side session
    const conversationHistory = clientHistory || session.history;
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: "user", content: message }
    ];

    // 4. Call OpenAI with Streaming
    const stream = await openai.chat.completions.create({
      model: process.env.MODEL_NAME || "gpt-4o",
      messages: messages,
      temperature: 1,
      stream: true,
    });

    let fullReply = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullReply += content;
        // Standard SSE format
        res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
      }
    }

    // 5. Update session history after successful stream
    session.history.push({ role: "user", content: message });
    session.history.push({ role: "assistant", content: fullReply });

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error("Streaming Error:", error);
    res.write(`data: ${JSON.stringify({ error: "Assistant systems are lagging. Please try again." })}\n\n`);
    res.end();
  }
};


