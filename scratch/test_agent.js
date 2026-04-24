async function testChat(message, sessionId = 'test-session') {
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    console.log(`\nUser: ${message}`);
    process.stdout.write('Assistant: ');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') break;
          try {
            const data = JSON.parse(dataStr);
            if (data.chunk) {
              process.stdout.write(data.chunk);
            } else if (data.error) {
              console.error(`\nError: ${data.error}`);
            }
          } catch (e) {
            // Partial JSON handle or other issues
          }
        }
      }
    }
    console.log('\n');
  } catch (error) {
    console.error(`\nError: ${error.message}`);
  }
}

async function runTests() {
  console.log("--- TEST 1: SSE Streaming & Brevity ---");
  await testChat("I need a Chrome extension developer. What's your process?");

  console.log("\n--- TEST 2: Intent & Memory (Client) ---");
  await testChat("Can we build it for $5k in a month?");
}

runTests();
