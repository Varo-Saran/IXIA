// Ixia.js - AI Functionality

function simpleTokenizer(input) {
    return input.toLowerCase().split(/\s+/);
}

const responseTemplates = {
  question: [
    "That's an interesting question. Have you considered {topic}?",
    "I'm curious about your thoughts on {topic}. Can you elaborate?",
    "Regarding {topic}, what specific aspects are you most interested in?",
  ],
  statement: [
    "I see your point about {topic}. Here's another perspective to consider: {perspective}",
    "Your thoughts on {topic} are intriguing. It reminds me of {related_concept}.",
    "Interesting take on {topic}. Have you also thought about its relation to {related_concept}?",
  ],
  default: [
    "I find your input fascinating. Let's explore {topic} further.",
    "That's a unique viewpoint. I'm processing the implications of {topic} now...",
    "Your ideas about {topic} are thought-provoking. Here's what comes to my mind: {perspective}",
  ]
};

const perspectives = [
  "the long-term consequences",
  "potential ethical implications",
  "how it might affect different demographics",
  "its historical context",
  "possible future developments",
];

const relatedConcepts = [
  "sustainability",
  "technological advancements",
  "social dynamics",
  "economic factors",
  "cultural influences",
];

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function analyzeInput(input) {
    const tokens = simpleTokenizer(input);
    const questionWords = ['what', 'why', 'how', 'when', 'where', 'who'];
    
    if (questionWords.some(word => tokens.includes(word))) {
        return 'question';
    }
    return 'statement';
}

function extractTopic(input) {
    const tokens = simpleTokenizer(input);
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of'];
    const contentWords = tokens.filter(word => !stopWords.includes(word));
    return contentWords.length > 0 ? getRandomElement(contentWords) : 'the topic';
}

// Expose getAIResponse as a global function
window.getAIResponse = function(userMessage, options = {}) {
  return new Promise((resolve, reject) => {
      try {
          const inputType = analyzeInput(userMessage);
          const topic = extractTopic(userMessage);
          const responseType = options.responseType || inputType;
          
          const templates = responseTemplates[responseType] || responseTemplates.default;
          let response = getRandomElement(templates);
          
          response = response.replace('{topic}', topic);
          response = response.replace('{perspective}', getRandomElement(perspectives));
          response = response.replace('{related_concept}', getRandomElement(relatedConcepts));
          
          // Calculate delay based on response length (assuming average reading speed of 200 words per minute)
          const wordCount = response.split(' ').length;
          const readingTime = (wordCount / 200) * 60 * 1000; // Convert to milliseconds
          const minDelay = 1000; // Minimum delay of 1 second
          const maxDelay = 5000; // Maximum delay of 5 seconds
          const delay = Math.min(Math.max(readingTime, minDelay), maxDelay);
          
          setTimeout(() => {
              resolve(response);
          }, delay);
      } catch (error) {
          reject(new Error(`Failed to generate AI response: ${error.message}`));
      }
  });
};