// Ixia.js - Chatbot Logic and AI Integration

const globalScope = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});

const DEFAULT_CHAT_FALLBACK = "I'm having trouble reaching the AI service right now. Let's keep chatting locally while you try again.";

function getApiConfig() {
  if (!globalScope) {
    return null;
  }

  const candidate = globalScope.apiConfig || getModel('apiConfig');
  return candidate && typeof candidate === 'object' ? candidate : null;
}

function resolveConfigValue(config, key, fallbackValue) {
  if (!config) {
    return fallbackValue;
  }

  const value = typeof config[key] === 'function' ? config[key]() : config[key];
  return value !== undefined && value !== null ? value : fallbackValue;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controllerSupported = typeof AbortController !== 'undefined';
  const controller = controllerSupported ? new AbortController() : null;
  const timeoutId = controllerSupported ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller ? controller.signal : undefined
    });
    return response;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function extractTextFromHuggingFacePayload(payload) {
  if (typeof payload === 'string') {
    return payload;
  }

  if (!payload) {
    return '';
  }

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const text = extractTextFromHuggingFacePayload(entry);
      if (text) {
        return text;
      }
    }
    return '';
  }

  if (typeof payload === 'object') {
    if (typeof payload.generated_text === 'string') {
      return payload.generated_text;
    }
    if (typeof payload.response === 'string') {
      return payload.response;
    }
    if (Array.isArray(payload.choices)) {
      for (const choice of payload.choices) {
        const text = extractTextFromHuggingFacePayload(choice);
        if (text) {
          return text;
        }
      }
    }
    if (Array.isArray(payload.data)) {
      for (const dataEntry of payload.data) {
        const text = extractTextFromHuggingFacePayload(dataEntry);
        if (text) {
          return text;
        }
      }
    }
    if (typeof payload.message === 'string') {
      return payload.message;
    }
  }

  return '';
}

function isPendingHuggingFacePayload(payload) {
  if (!payload) {
    return false;
  }

  if (typeof payload === 'string') {
    const normalized = payload.toLowerCase();
    return normalized.includes('loading') || normalized.includes('queue');
  }

  if (Array.isArray(payload)) {
    return payload.some(entry => isPendingHuggingFacePayload(entry));
  }

  if (typeof payload !== 'object') {
    return false;
  }

  if (typeof payload.estimated_time === 'number') {
    return true;
  }

  if (payload.is_generating === true) {
    return true;
  }

  const status = typeof payload.status === 'string' ? payload.status.toLowerCase() : '';
  if (status === 'queued' || status === 'loading') {
    return true;
  }

  const messageCandidates = [];
  if (typeof payload.message === 'string') {
    messageCandidates.push(payload.message);
  }
  if (typeof payload.error === 'string') {
    messageCandidates.push(payload.error);
  }
  if (Array.isArray(payload.messages)) {
    for (const entry of payload.messages) {
      if (typeof entry === 'string') {
        messageCandidates.push(entry);
      } else if (entry && typeof entry.message === 'string') {
        messageCandidates.push(entry.message);
      }
    }
  }

  return messageCandidates.some(candidate => {
    const normalized = candidate.toLowerCase();
    return normalized.includes('loading') || normalized.includes('queue');
  });
}

function describePendingPayload(payload) {
  if (!payload) {
    return 'model is pending';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const description = describePendingPayload(entry);
      if (description) {
        return description;
      }
    }
    return 'model is pending';
  }

  if (typeof payload === 'object') {
    if (typeof payload.status === 'string') {
      return payload.status;
    }
    if (typeof payload.message === 'string') {
      return payload.message;
    }
    if (typeof payload.error === 'string') {
      return payload.error;
    }
  }

  return 'model is pending';
}

async function requestHuggingFaceCompletion(prompt, activeModelName) {
  const config = getApiConfig();
  if (!config || typeof config.getAccessToken !== 'function') {
    return null;
  }

  const token = config.getAccessToken();
  if (!token) {
    return null;
  }

  const baseUrl = resolveConfigValue(config, 'baseUrl', 'https://api-inference.huggingface.co/models');
  const timeoutMs = resolveConfigValue(config, 'timeoutMs', 20000);
  const configuredModel = typeof config.getChatModelName === 'function'
    ? config.getChatModelName()
    : null;

  const modelName = typeof activeModelName === 'string' && activeModelName !== 'chat'
    ? activeModelName
    : configuredModel || activeModelName || 'chat';

  const encodedModel = modelName
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

  const url = `${String(baseUrl).replace(/\/$/, '')}/${encodedModel}`;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const body = JSON.stringify({ inputs: prompt });

  try {
    const response = await fetchWithTimeout(url, { method: 'POST', headers, body }, timeoutMs);
    if (!response.ok) {
      throw new Error(`Hugging Face API returned status ${response.status}`);
    }

    const payload = await response.json();

    if (isPendingHuggingFacePayload(payload)) {
      const description = describePendingPayload(payload);
      throw new Error(`Hugging Face model pending: ${description}`);
    }

    if (payload && payload.error) {
      throw new Error(typeof payload.error === 'string' ? payload.error : 'Unknown Hugging Face API error');
    }

    const text = extractTextFromHuggingFacePayload(payload);
    if (text) {
      return {
        response: text,
        raw: payload,
        source: 'huggingface'
      };
    }

    throw new Error('Unable to extract text from Hugging Face response');
  } catch (error) {
    console.warn('Falling back to local chat model:', error);
    return {
      error,
      fallback: true
    };
  }
}

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
      const apiResponse = await requestHuggingFaceCompletion(safeMessage, normalizedModel);
      if (apiResponse && !apiResponse.fallback && apiResponse.response) {
        return apiResponse;
      }

      if (chatModel && typeof chatModel.getChatResponse === 'function') {
        const fallbackResponse = chatModel.getChatResponse(safeMessage);
        if (apiResponse && apiResponse.error) {
          return {
            response: fallbackResponse,
            source: 'local-fallback',
            error: apiResponse.error,
            message: DEFAULT_CHAT_FALLBACK
          };
        }
        return fallbackResponse;
      }

      if (apiResponse && apiResponse.error) {
        return DEFAULT_CHAT_FALLBACK;
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
