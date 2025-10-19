// Ixia.js - Chatbot Logic and AI Integration

const globalScope = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});

function getModel(modelName) {
  if (!globalScope) {
    return undefined;
  }

  const candidate = globalScope[modelName];
  return candidate && typeof candidate === 'object' ? candidate : undefined;
}

// Simulating an AI response for the chat function
async function getAIResponse(userMessage, model = 'chat') {
  const safeMessage = typeof userMessage === 'string' ? userMessage : String(userMessage ?? '');

  // Simulate a delay to mimic AI thinking process
  await new Promise(resolve => setTimeout(resolve, 1000));

  const normalizedModel = typeof model === 'string' ? model.toLowerCase() : 'chat';
  const mathModel = getModel('mathModel');
  const chatModel = getModel('chatModel');
  const creativeModel = getModel('creativeModel');

  switch (normalizedModel) {
    case 'math':
      if (mathModel && typeof mathModel.getMathResponse === 'function') {
        return mathModel.getMathResponse(safeMessage);
      }
      return "Math model is currently unavailable.";
    case 'creative':
    case 'other':
    case 'creative/other':
      if (creativeModel && typeof creativeModel.getCreativeResponse === 'function') {
        return creativeModel.getCreativeResponse(safeMessage);
      }
      return "Creative model is currently unavailable.";
    case 'chat':
    default:
      if (chatModel && typeof chatModel.getChatResponse === 'function') {
        return chatModel.getChatResponse(safeMessage);
      }
      return "Chat model is currently unavailable.";
  }
}

// Simple sentiment analysis to categorize response
function simpleSentimentAnalysis(response) {
  const sentiments = {
    positive: ["help", "great", "welcome", "good", "hi", "thanks", "happy", "assist", "cheer", "support"],
    negative: ["sad", "sorry", "unhappy", "depressed", "upset", "miserable", "gloomy"],
    neutral: ["okay", "fine", "alright", "maybe", "perhaps", "possibly"]
  };

  const lowerResponse = response.toLowerCase();

  for (const [sentiment, words] of Object.entries(sentiments)) {
    if (words.some(word => lowerResponse.includes(word))) {
      return sentiment;
    }
  }

  return 'neutral';
}

// Make functions globally accessible
if (globalScope) {
  globalScope.getAIResponse = getAIResponse;
  globalScope.simpleSentimentAnalysis = simpleSentimentAnalysis;
  globalScope.solveMathProblem = function solveMathProblemProxy(message) {
    const mathModel = getModel('mathModel');
    if (mathModel && typeof mathModel.solveMathProblem === 'function') {
      return mathModel.solveMathProblem(message);
    }
    return null;
  };
}

// Example usage (for testing purposes)
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  (async () => {
    const testMessages = [
      "hi fuck",
      "What's 5 + 3?",
      "Calculate 10 - 7",
      "Solve 8 * 4",
      "Compute 15 / 3",
      "What's the result of 2.5 + 3.7?",
      "Can you help me with 100 / 0?",
      "I need to calculate something",
      "What's 2 + 2 * 2?",
      "Hello, how are you?",
      "I'm feeling sad today",
      "What can you do?",
      "Tell me a joke",
      "Goodbye"
    ];

    for (const message of testMessages) {
      const response = await getAIResponse(message);
      console.log(`User: ${message}`);
      console.log(`iXiA: ${response}`);
      console.log(`Sentiment: ${simpleSentimentAnalysis(response)}`);
      console.log('---');
    }
  })();
}
