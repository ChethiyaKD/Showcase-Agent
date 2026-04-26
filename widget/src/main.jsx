import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './ChatWidget';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div style={{ padding: '2rem' }}>
      <h1>Portfolio Chat Widget Preview</h1>
      <p>The widget bubble should appear in the bottom-right corner.</p>
      <ChatWidget 
        endpoint="http://localhost:3000/api/chat" 
        ownerName="Chethiya" 
      />
    </div>
  </React.StrictMode>
);
