import React, { useState, useEffect, useRef } from "react";
import { Send, User, Bot, X, MessageSquare, Loader2 } from "lucide-react";
import "./ChatWidget.css";

const ThinkingBrain = () => (
  <div className="brain-thinking">
    <svg
      className="brain-svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#7c3aed"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54Z" />
    </svg>
  </div>
);

const ChatWidget = ({
  endpoint = "https://portfolio-agent-five.vercel.app/api/chat",
  ownerName = "YOUR NAME",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  const initialSuggestions = [
    "Who is YOUR NAME?",
    "Show me your AI projects",
    "Send an email",
    "Schedule a Google Meet",
  ];

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem("portfolio_chat_history");
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Sync history to localStorage
  useEffect(() => {
    localStorage.setItem("portfolio_chat_history", JSON.stringify(history));
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const [typewriterQueue, setTypewriterQueue] = useState("");
  const activeAssistantId = useRef(null);

  // Organic Typewriter: Bleeds text with random delays for a natural feel
  useEffect(() => {
    if (!typewriterQueue || !activeAssistantId.current) return;

    const timeout = setTimeout(
      () => {
        const char = typewriterQueue[0];
        const remaining = typewriterQueue.slice(1);

        setHistory((currentHistory) =>
          currentHistory.map((msg) =>
            msg.id === activeAssistantId.current
              ? { ...msg, content: msg.content + char }
              : msg,
          ),
        );
        setTypewriterQueue(remaining);
      },
      Math.random() * 25 + 5,
    ); // Random 5-20ms delay

    return () => clearTimeout(timeout);
  }, [typewriterQueue]);

  const handleQuickReply = (text) => {
    setMessage(text);
    setTimeout(() => {
      handleSend(null, text);
    }, 50);
  };

  const handleSend = async (e, directText = null) => {
    if (e) e.preventDefault();
    const textToSend = directText || message;
    if (!textToSend.trim() || isLoading) return;

    const userMessage = { role: "user", content: textToSend };
    const newHistory = [...history, userMessage];
    setHistory(newHistory);
    setMessage("");
    setIsLoading(true);

    const assistantId = String(Date.now());
    activeAssistantId.current = assistantId;
    setHistory((prev) => [
      ...prev,
      { role: "assistant", content: "", id: assistantId },
    ]);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: newHistory.slice(-10),
        }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith("data:")) continue;

          const dataStr = trimmedLine.replace(/^data:\s*/, "").trim();
          if (dataStr === "[DONE]") continue;

          try {
            const data = JSON.parse(dataStr);
            if (data.chunk) {
              setTypewriterQueue((prev) => prev + data.chunk);
            }
          } catch (e) {
            console.debug("JSON parse skipped");
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setHistory((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: "Sorry, I hit a snag. Please try again." }
            : msg,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Organic Markdown + Link + Paragraph Renderer
  const renderContent = (content, isLoadingState = false) => {
    if (isLoadingState) {
      return (
        <div className="msg-bubble loading">
          <ThinkingBrain />
        </div>
      );
    }

    const parseMarkdown = (text) => {
      // 1. Handle Bold: **text** -> <strong>
      const boldRegex = /\*\*(.*?)\*\*/g;
      // 2. Handle Links: [text](url) -> <a>
      const linkRegex = /\[(.*?)\]\((.*?)\)/g;
      // 3. Handle Bare URLs
      const urlRegex = /(?<!\]\()https?:\/\/[^\s)]+/g;

      let parts = [{ type: "text", content: text }];

      // Apply Bold
      parts = parts.flatMap((p) => {
        if (p.type !== "text") return p;
        const subParts = [];
        let lastIndex = 0;
        let match;
        while ((match = boldRegex.exec(p.content)) !== null) {
          if (match.index > lastIndex)
            subParts.push({
              type: "text",
              content: p.content.slice(lastIndex, match.index),
            });
          subParts.push({ type: "bold", content: match[1] });
          lastIndex = boldRegex.lastIndex;
        }
        if (lastIndex < p.content.length)
          subParts.push({ type: "text", content: p.content.slice(lastIndex) });
        return subParts;
      });

      // Apply Links
      parts = parts.flatMap((p) => {
        if (p.type !== "text") return p;
        const subParts = [];
        let lastIndex = 0;
        let match;
        while ((match = linkRegex.exec(p.content)) !== null) {
          if (match.index > lastIndex)
            subParts.push({
              type: "text",
              content: p.content.slice(lastIndex, match.index),
            });
          subParts.push({ type: "link", text: match[1], url: match[2] });
          lastIndex = linkRegex.lastIndex;
        }
        if (lastIndex < p.content.length)
          subParts.push({ type: "text", content: p.content.slice(lastIndex) });
        return subParts;
      });

      // Apply Bare URLs
      parts = parts.flatMap((p) => {
        if (p.type !== "text") return p;
        const subParts = [];
        let lastIndex = 0;
        let match;
        while ((match = urlRegex.exec(p.content)) !== null) {
          if (match.index > lastIndex)
            subParts.push({
              type: "text",
              content: p.content.slice(lastIndex, match.index),
            });
          subParts.push({ type: "link", text: match[0], url: match[0] });
          lastIndex = urlRegex.lastIndex;
        }
        if (lastIndex < p.content.length)
          subParts.push({ type: "text", content: p.content.slice(lastIndex) });
        return subParts;
      });

      return parts.map((p, i) => {
        if (p.type === "bold") return <strong key={i}>{p.content}</strong>;
        if (p.type === "link")
          return (
            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
              {p.text}
            </a>
          );
        return p.content;
      });
    };

    // Split by double newlines to create separate balloons, but keep list items grouped
    const lines = content.split("\n");
    const groupedParagraphs = [];
    let currentParagraph = [];

    lines.forEach((line) => {
      if (line.trim() === "") {
        if (currentParagraph.length > 0) {
          groupedParagraphs.push(currentParagraph.join("\n"));
          currentParagraph = [];
        }
      } else {
        currentParagraph.push(line);
      }
    });
    if (currentParagraph.length > 0)
      groupedParagraphs.push(currentParagraph.join("\n"));

    return groupedParagraphs.map((para, pIdx) => (
      <div key={pIdx} className="msg-bubble">
        {para.split("\n").map((line, lIdx) => {
          const isBullet =
            line.trim().startsWith("- ") || line.trim().startsWith("* ");
          const isNumber = /^\d+\.\s/.test(line.trim());

          return (
            <div key={lIdx} className={isBullet || isNumber ? "list-item" : ""}>
              {isBullet ? "• " : ""}
              {parseMarkdown(line.replace(/^[-*]\s|\d+\.\s/, ""))}
            </div>
          );
        })}
      </div>
    ));
  };

  return (
    <div className={`chat-widget-container ${isOpen ? "open" : ""}`}>
      {/* Toggle Button */}
      <button className="chat-toggle" onClick={() => setIsOpen(true)}>
        <img
          src="/agent-avatar.png"
          alt="Open Chat"
          className="toggle-avatar"
        />
      </button>

      {/* Chat Window */}
      <div className="chat-window">
        <div className="chat-header">
          <div className="owner-info">
            <div className="avatar">
              <img src="/agent-avatar.png" alt={ownerName} />
            </div>
            <div>
              <h3>{ownerName}'s Assistant</h3>
              <span className="status">Online</span>
            </div>
          </div>
          <button className="close-btn" onClick={() => setIsOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="chat-messages" ref={scrollRef}>
          {history.length === 0 && (
            <>
              <div className="welcome-msg">
                Hello! I'm {ownerName}'s AI representative. How can I help you
                today?
              </div>
              <div className="quick-replies initial">
                {initialSuggestions.map((text, i) => (
                  <button
                    key={i}
                    className="quick-reply-btn"
                    onClick={() => handleQuickReply(text)}
                    disabled={isLoading}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </>
          )}
          {history.map((msg, idx) => {
            const isLastAssistant =
              idx === history.length - 1 && msg.role === "assistant";
            const showThinking = isLastAssistant && isLoading && !msg.content;

            return (
              <React.Fragment key={msg.id || idx}>
                <div className={`message ${msg.role}`}>
                  {renderContent(msg.content, showThinking)}
                </div>
                {isLastAssistant &&
                  !isLoading &&
                  !typewriterQueue &&
                  idx === history.length - 1 && (
                    <div className="quick-replies contextual">
                      <button
                        className="quick-reply-btn"
                        onClick={() => handleQuickReply("Tell me more")}
                      >
                        Tell me more
                      </button>
                      <button
                        className="quick-reply-btn"
                        onClick={() => handleQuickReply("Email YOUR NAME")}
                      >
                        Email YOUR NAME
                      </button>
                      <button
                        className="quick-reply-btn"
                        onClick={() => handleQuickReply("Schedule a meeting")}
                      >
                        Schedule a meeting
                      </button>
                    </div>
                  )}
              </React.Fragment>
            );
          })}
        </div>

        <form className="chat-input" onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !message.trim()}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWidget;
