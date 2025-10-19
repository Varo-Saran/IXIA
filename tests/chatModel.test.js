const assert = require('assert');
require('../models/chatModel.js');

const { getChatResponse, responses } = global.chatModel;

const romanticEntry = responses.find(entry =>
  entry.replies.includes('If I had a heart, it would skip a beat for you.')
);

if (!romanticEntry) {
  throw new Error('Romantic response entry not found in chat model responses.');
}

const romanticReplies = romanticEntry.replies;

const pizzaResponse = getChatResponse('I love pizza');
assert(
  !romanticReplies.includes(pizzaResponse),
  `Expected non-romantic reply for neutral love statement, got: ${pizzaResponse}`
);

const loveYouResponse = getChatResponse('I love you');
assert(
  romanticReplies.includes(loveYouResponse),
  `Expected romantic reply for contextual love statement, got: ${loveYouResponse}`
);

console.log('chatModel tests passed');
