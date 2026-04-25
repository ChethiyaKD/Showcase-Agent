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
  endpoint = "http://localhost:3000/api/chat",
  ownerName = "Chethiya",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = { role: "user", content: message };
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
          message: message,
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
              // Feed the organic queue
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

  // Helper to make links clickable and split into separate balloons
  const renderContent = (content, isLoadingState = false) => {
    if (isLoadingState) {
      return (
        <div className="msg-bubble loading">
          <ThinkingBrain />
        </div>
      );
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;

    // Split by double newlines to create separate balloons
    const paragraphs = content.split("\n\n").filter((p) => p.trim() !== "");

    return paragraphs.map((para, pIdx) => (
      <div key={pIdx} className="msg-bubble">
        {para.split(urlRegex).map((part, i) => {
          if (part.match(urlRegex)) {
            return (
              <a key={i} href={part} target="_blank" rel="noopener noreferrer">
                {part}
              </a>
            );
          }
          return part;
        })}
      </div>
    ));
  };

  return (
    <div className={`chat-widget-container ${isOpen ? "open" : ""}`}>
      {/* Toggle Button */}
      {!isOpen && (
        <button className="chat-toggle" onClick={() => setIsOpen(true)}>
          <MessageSquare size={24} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <div className="owner-info">
              <div className="avatar">{ownerName[0]}</div>
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
              <div className="welcome-msg">
                Hello! I'm {ownerName}'s AI representative. How can I help you
                today?
              </div>
            )}
            {history.map((msg, idx) => {
              const isLastAssistant =
                idx === history.length - 1 && msg.role === "assistant";
              const showThinking = isLastAssistant && isLoading && !msg.content;

              return (
                <div key={msg.id || idx} className={`message ${msg.role}`}>
                  {renderContent(msg.content, showThinking)}
                </div>
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
      )}
    </div>
  );
};

export default ChatWidget;
