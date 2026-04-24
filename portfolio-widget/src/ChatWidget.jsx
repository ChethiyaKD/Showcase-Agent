import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, X, MessageSquare, Loader2 } from 'lucide-react';
import './ChatWidget.css';

const ChatWidget = ({ endpoint = 'http://localhost:3000/api/chat', ownerName = 'Chethiya' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('portfolio_chat_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Sync history to localStorage
  useEffect(() => {
    localStorage.setItem('portfolio_chat_history', JSON.stringify(history));
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = { role: 'user', content: message };
    const newHistory = [...history, userMessage];
    setHistory(newHistory);
    setMessage('');
    setIsLoading(true);

    // Initial assistant message placeholder
    const assistantId = Date.now();
    setHistory(prev => [...prev, { role: 'assistant', content: '', id: assistantId }]);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: message,
          history: newHistory.slice(-10) // Send context window
        })
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.chunk) {
                fullContent += data.chunk;
                setHistory(prev => prev.map(msg => 
                  msg.id === assistantId ? { ...msg, content: fullContent } : msg
                ));
              }
            } catch (e) {
              console.warn('Failed to parse chunk', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setHistory(prev => prev.map(msg => 
        msg.id === assistantId ? { ...msg, content: 'Sorry, I hit a snag. Please try again.' } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`chat-widget-container ${isOpen ? 'open' : ''}`}>
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
              <div className="avatar">
                {ownerName[0]}
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
              <div className="welcome-msg">
                Hello! I'm {ownerName}'s AI representative. How can I help you today?
              </div>
            )}
            {history.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="msg-bubble">
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && history[history.length - 1]?.content === '' && (
              <div className="message assistant">
                <div className="msg-bubble loading">
                  <Loader2 className="animate-spin" size={16} />
                </div>
              </div>
            )}
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
