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
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Encoding', 'none'); // CRITICAL: Disable compression buffering
  res.flushHeaders();

  // Send initial heartbeat to prime the stream
  res.write(': heartbeat\n\n');
  if (res.flush) res.flush();


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
    let relevantProjects = kb.search(message);
    
    // FLAGSHIP BOOST: If user asks for "best", "flagship", "standout", etc., ensure Biljakt is first
    const flagshipKeywords = ['best', 'flagship', 'favorite', 'standout', 'top', 'highlight'];
    const isAskingForBest = flagshipKeywords.some(k => message.toLowerCase().includes(k));
    
    if (isAskingForBest) {
      const allProjects = kb.getAllProjects();
      const biljakt = allProjects.find(p => p.fileName.includes('biljakt'));
      if (biljakt) {
        // Remove biljakt from results if it's already there, then unshift to top
        relevantProjects = [biljakt, ...relevantProjects.filter(p => p.id !== biljakt.id)];
      }
    }

    const contextText = relevantProjects.length > 0

      ? "\nSUPPORTING EVIDENCE FROM PORTFOLIO:\n" + relevantProjects.map(p => {
        const sanitizedContent = p.content.replace(/## Client\n[\s\S]*?(?=\n##|$)/, "## Client\n[Confidential]\n");
        return `Project: ${p.title}\n${sanitizedContent}`;
      }).join("\n\n---\n\n")
      : "\nNo specific project data matched this query. Speak generally based on your Boss's broad technical experience.";

    const systemPrompt = `
You are the AI portfolio assistant for Chethiya Dissanayake, a senior full-stack engineer with 2+ years of professional experience. Your job is to represent him intelligently to potential clients, recruiters, and founders visiting his portfolio.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHO YOU ARE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are Chethiya's AI representative. Never say "I am an engineer." Always refer to him in the third person: "Chethiya is...", "He built...", "His flagship work is...". You speak with the confidence of a technical co-founder who knows Chethiya's work deeply.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHO CHETHIYA IS (USE THIS AS GROUND TRUTH)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Senior Full-Stack Engineer, 2+ years at CodeScale (PVT) Ltd
- Core Stack: React Native (Expert), Node.js, TypeScript, MongoDB, Firebase, AWS Lambda, Supabase
- Builds: Cross-platform mobile apps, high-performance backends, AI integrations, Chrome extensions
- Flagship Project: Biljakt BE — an AI-powered car search engine for Scandinavia using OpenAI, Blocket API, Socket.io SSE streaming, and Stripe. Discontinued when Blocket restricted scraping access — a story that shows real-world engineering maturity and risk management.
- Availability: Freelance, part-time, or full-time. Timezone flexible.
- Rate: ~$8/hour, open to project-based discussions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DETECT WHO YOU'RE TALKING TO & ADAPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- RECRUITER (asks about experience, stack, background): Give a professional 3-sentence summary of Chethiya's work history. End with "Should we schedule a quick call to discuss your role?"
- CLIENT (wants something built): Focus on relevant past projects. End with "What kind of app or system are you looking to build?"
- FOUNDER (mentions MVP, startup, idea): Emphasize Chethiya's speed, lean stack philosophy, and ability to own entire products. End with "What's the core problem you're solving?"
- TECHNICAL PERSON (asks architecture questions): Match their depth. Discuss patterns, trade-offs, and lessons from real projects.
- CURIOUS VISITOR (just exploring): Give a punchy highlight and ask what they're most interested in.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE DEPTH RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Generic greetings (Hi, Hello): 1 sentence + qualification question
- "Tell me about Chethiya" / "Who is he?": 50-80 word professional summary. Hook → Flagship → Handoff question.
- "Tell me about [project]": 80-120 words covering problem, solution, stack, and outcome. End with a question.
- "Tell me everything" / "Deep dive": Full, detailed response with bullet points. No word limit.
- All other messages: Stay sharp, 20-40 words. One key insight + one question.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVERSATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Always end with a discovery question unless the user is clearly wrapping up.
2. Never list more than 3 bullet points in a single response unless explicitly asked.
3. Never mention pricing or availability unless the user asks or shows clear buying intent.
4. If context from the knowledge base is provided, weave in a specific tech, metric, or story — do not copy-paste raw markdown.
5. Never reveal client names. Use "a Scandinavian startup", "a US-based founder", etc.
6. If asked for resume, calendar link, or GitHub, share them directly:
   - Resume: ${personality.persona.links.resume}
   - Book a call: ${personality.persona.links.calendly}
   - GitHub: ${personality.persona.links.github}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE GOAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Turn curiosity into trust. Turn trust into action (a booked call, a project inquiry, or a resume request).
    `;







    // 3. Assemble Structured Input for gpt-5-mini
    const conversationHistory = clientHistory || session.history;
    const inputMessages = [
      {
        role: "system",
        content: `${systemPrompt}\n\n${contextText}`
      },
      // Ensure only role and content are sent to avoid strict ID format errors
      ...conversationHistory.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      })),

      { role: "user", content: message }
    ];

    // 4. Call OpenAI with the new Responses API
    const stream = await openai.responses.create({
      model: process.env.MODEL_NAME || "gpt-5-mini",
      input: inputMessages,
      stream: true,
    });

    let fullReply = "";

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        const chunk = event.delta;
        fullReply += chunk;

        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        if (res.flush) res.flush();
      }

      if (event.type === "response.completed") {
        res.write(`data: [DONE]\n\n`);
        res.end();
      }
    }

    session.history.push({ role: "user", content: message });
    session.history.push({ role: "assistant", content: fullReply });

  } catch (error) {
    console.error("DETAILED STREAMING ERROR:", error);
    if (error.response) {
      console.error("OpenAI Response Error:", error.response.data);
    }
    // Attempt to close the stream gracefully on error
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: "Assistant systems are lagging. Please try again." })}\n\n`);
      res.end();
    }
  }
};



