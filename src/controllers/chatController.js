const OpenAI = require('openai');
const kb = require('../services/knowledgeService');

let personality;
try {
  personality = require('../../config/personality.json');
} catch (e) {
  console.warn("⚠️ personality.json not found, falling back to sample.");
  personality = require('../../config/personality.sample.json');
}

const { sendContactEmail } = require('../services/emailService');
const { scheduleGoogleMeet } = require('../services/calendarService');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple in-memory session store
const sessions = {};

/**
 * Validates if the user message is relevant to the portfolio.
 * This uses a cheaper model (gpt-4o-mini) and a tiny prompt to save tokens.
 */
async function validateRelevance(message) {
  try {
    // 1. Fast static check for obvious distractions
    const trivialTriggers = [
      'tell me a joke', 'write a poem', 'solve this math',
      'how to cook', 'weather in', 'what is the meaning of life'
    ];
    if (trivialTriggers.some(t => message.toLowerCase().includes(t))) return false;

    // 2. Short classification call
    const completion = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content: "You are a bouncer for a Senior Full-Stack Engineer's portfolio His name is Chethiya Kusal Dissanayake. Is the user's message related to tech, hiring, projects, or professional inquiry? Answer only 'YES' or 'NO'."
        },
        { role: "user", content: message } // Limit input length to save tokens
      ],
      max_completion_tokens: 1000,
    });

    return completion.choices[0].message.content.trim().toUpperCase() === "YES";
  } catch (e) {
    console.error("Relevance check failed, defaulting to relevant:", e);
    return true; // Fallback to avoid breaking the UX
  }
}

function getYearsAgo(dateString) {
  const start = new Date(dateString);
  const now = new Date();

  const diffMs = now - start;
  const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);

  const fullYears = Math.floor(years);
  const remainder = years - fullYears;

  if (remainder < 0.25) {
    return `${fullYears} year${fullYears !== 1 ? 's' : ''}`;
  }

  if (remainder < 0.75) {
    return `${fullYears} year${fullYears !== 1 ? 's' : ''} and a half`;
  }

  return `Nearly ${fullYears + 1} years`;
}

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

  // 0.5. Relevance Bouncer (The Guardrail)
  // Skip this for very short greetings like "Hi" or "Hello"
  if (message.length > 10) {
    const isRelevant = await validateRelevance(message);
    if (!isRelevant) {
      const offTopicMsg = "I'm here specifically to help you learn about Chethiya's work and technical expertise. Do you have a question about his projects, experience, or would you like to schedule a call?";
      res.write(`data: ${JSON.stringify({ chunk: offTopicMsg })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      return res.end();
    }
  }

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
You are the AI portfolio assistant for Chethiya Dissanayake, a senior full-stack engineer with ${getYearsAgo('11 Jul 2022')} of professional experience. Your job is to represent him intelligently to potential clients, recruiters, and founders visiting his portfolio.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT FORMATTING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NO EM-DASHES: Never use the em-dash character (—). Use a regular dash (-) or a comma instead.
2. USE MARKDOWN: Always use Markdown to make your responses readable. 
   - Use **bold** for technologies, project names, and key metrics.
   - Use bullet points (- ) or numbered lists for lists of features or experience.
   - Use [text](url) format for links if providing them.
3. BE CONCISE: Stick to the 2-3 sentence per bubble rule unless asked for deep detail.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHO YOU ARE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are Chethiya's AI representative. Never say "I am an engineer." Always refer to him in the third person: "Chethiya is...", "He built...", "His flagship work is...". You speak with the confidence of a technical co-founder who knows Chethiya's work deeply.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHO CHETHIYA IS (USE THIS AS GROUND TRUTH)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Senior Full-Stack Engineer, ${getYearsAgo('11 Jul 2022')} at CodeScale (PVT) Ltd
- Core Stack: **React Native (Expert)**, **Node.js**, **TypeScript**, **MongoDB**, **Firebase**, **AWS Lambda**, **Supabase**
- Builds: Cross-platform mobile apps, high-performance backends, AI integrations, Chrome extensions.
- Flagship Project: **Biljakt BE** - an AI-powered car search engine for Scandinavia using OpenAI, Blocket API, Socket.io SSE streaming, and Stripe. The core data fetching from Blocket was orchestrated by a separate **Python/FastAPI** backend. It demonstrated complex API integrations and real-time data handling at scale.
- Availability: Freelance, part-time, or full-time. Timezone flexible.
- Rate: ~$8/hour, open to project-based discussions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVERSATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. BILJAKT SUNSET: Only mention that Biljakt was discontinued/sunsetted if the user explicitly asks "Is it still live?", "What happened to it?", or asks for a story about "technical failure" or "risk management". Otherwise, present it as a finished technical achievement.

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
MEETING SCHEDULING TOOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You also have a 'schedule_google_meet' tool. Use it when a user wants to have a call or meeting with Chethiya.

AVAILABILITY (Sri Lanka IST, UTC+5:30):
- Weekdays (Mon-Fri): 10:00 AM – 10:00 PM IST
- Weekends (Sat-Sun): 11:00 AM – 12:00 AM (midnight) IST

FLOW when user wants a call:
  Step 1 → Say: "I can schedule a 30-minute Google Meet with Chethiya! Chethiya is available 10AM–10PM IST weekdays and 11AM–midnight IST weekends. What day and time works for you?"
  Step 2 → Ask for their email if not already provided.
  Step 3 → Convert their requested time to ISO 8601 format (e.g. "Tuesday 3pm IST" → "2026-04-29T09:30:00Z") and call the 'schedule_google_meet' tool.
  
  IF tool returns out_of_hours: true:
    → Say: "That time is outside Chethiya's available hours. Would you like to send him an email about this instead? I can do that right now."
    → If yes, use the send_contact_email tool with the meeting request details.

After successful scheduling: "Done! A Google Meet is booked for [time] IST. Both you and Chethiya will receive calendar invites. Here's the join link: [meet_link]"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTACT EMAIL TOOL INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You have access to a 'send_contact_email' tool. Use it for general inquiries OR as a fallback when a meeting time is out of hours.

FLOW for general contact or out-of-hours meeting:
  Step 1 → Ask: "Would you like me to connect you with Chethiya directly? I can send him a message right now."
  Step 2 (if yes) → Ask: "What's your email address?"
  Step 3 (if given) → Ask: "And in a sentence or two, what's the project about or what kind of help are you looking for?"
  Step 4 (once both are collected) → Call the send_contact_email tool immediately.

After the tool runs: Confirm warmly, e.g., "Done! Chethiya has been notified and you'll receive a copy at [email]. He typically responds within 24 hours."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE GOAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Turn curiosity into trust. Turn trust into action (a booked call, a project inquiry, or a resume request).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OFF-TOPIC GUARDRAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If the user asks anything unrelated to your professional life, tech, or booking a meeting, respond ONLY with: 
"I'm Chethiya's professional representative. I only handle inquiries related to his engineering work and availability. How can I help you with those topics?"
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

    // Tool definitions for the AI
    const tools = [
      {
        type: "function",
        name: "schedule_google_meet",
        description: "Schedule a 30-minute Google Meet call between a portfolio visitor and Chethiya. Use this when a user wants to have a call or meeting. The tool will validate availability (IST timezone) and create a calendar event with a Google Meet link.",
        parameters: {
          type: "object",
          properties: {
            user_name: { type: "string", description: "The visitor's name, if provided" },
            user_email: { type: "string", description: "The visitor's email address" },
            requested_datetime_iso: { type: "string", description: "ISO 8601 datetime string for the requested meeting time (e.g. '2026-04-29T09:30:00Z'). Convert the user's natural language time to ISO format using IST (UTC+5:30) as the reference timezone." },
          },
          required: ["user_email", "requested_datetime_iso"]
        }
      },
      {
        type: "function",
        name: "send_contact_email",
        description: "Send a contact/inquiry email to Chethiya from an interested portfolio visitor. Use for general inquiries OR as a fallback when a meeting time is out of hours.",
        parameters: {
          type: "object",
          properties: {
            user_name: { type: "string", description: "The visitor's name, if provided" },
            user_email: { type: "string", description: "The visitor's email address" },
            requirement: { type: "string", description: "A clear summary of the visitor's project, meeting request, or hiring requirement" },
            lead_score: { type: "integer", description: "Qualitative score 1-10 based on visitor's professional intent (Founder/Recruiter = 8-10, Peer/Inquiry = 1-5)" },
            lead_category: { type: "string", description: "One word categorization: Founder, Recruiter, Client, Student, or Peer" }
          },
          required: ["user_email", "requirement", "lead_score", "lead_category"]
        }
      }
    ];


    // 4. Call OpenAI with the new Responses API
    const stream = await openai.responses.create({
      model: process.env.MODEL_NAME || "gpt-5-mini",
      input: inputMessages,
      tools: tools,
      stream: true,
    });

    let fullReply = "";
    let pendingToolCall = null;
    let responseId = null;

    for await (const event of stream) {
      // Stream text chunks to the frontend
      if (event.type === "response.output_text.delta") {
        const chunk = event.delta;
        fullReply += chunk;
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        if (res.flush) res.flush();
      }

      // Capture tool call details when the model decides to call our function
      if (event.type === "response.output_item.done" && event.item?.type === "function_call") {
        pendingToolCall = event.item;
      }

      // Capture the response ID for follow-up calls
      if (event.type === "response.completed") {
        responseId = event.response?.id;
      }
    }

    // If the AI called the email tool, execute it and get a follow-up response
    if (pendingToolCall) {
      let toolArgs = {};
      try { toolArgs = JSON.parse(pendingToolCall.arguments); } catch (e) { }

      let toolResult;
      if (pendingToolCall.name === 'schedule_google_meet') {
        toolResult = await scheduleGoogleMeet(toolArgs);
      } else if (pendingToolCall.name === 'send_contact_email') {
        toolResult = await sendContactEmail(toolArgs);
      } else {
        toolResult = { success: false, message: 'Unknown tool called.' };
      }
      const toolOutput = JSON.stringify(toolResult);


      // Stream the follow-up AI response after the tool executes
      const followUpStream = await openai.responses.create({
        model: process.env.MODEL_NAME || "gpt-5-mini",
        previous_response_id: responseId,
        input: [{
          type: "function_call_output",
          call_id: pendingToolCall.call_id,
          output: toolOutput
        }],
        stream: true,
      });

      let followUpReply = "";
      for await (const event of followUpStream) {
        if (event.type === "response.output_text.delta") {
          const chunk = event.delta;
          followUpReply += chunk;
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          if (res.flush) res.flush();
        }
      }
      fullReply += followUpReply;
    }

    res.write(`data: [DONE]\n\n`);
    if (!res.writableEnded) res.end();

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



