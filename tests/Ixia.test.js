const assert = require('assert');

const pendingPayload = {
  estimated_time: 12.5,
  status: 'queued',
  message: 'Model is loading, please try again later.'
};

const fetchCalls = [];

global.apiConfig = {
  getAccessToken: () => 'fake-token',
  baseUrl: 'https://example.com',
  timeoutMs: 500,
  getChatModelName: () => 'test/model'
};

global.chatModel = {
  getChatResponse: () => 'local fallback response'
};

global.fetch = async (url, options) => {
  fetchCalls.push({ url, options });
  return {
    ok: true,
    async json() {
      return pendingPayload;
    }
  };
};

require('../Ixia.js');

(async () => {
  const result = await global.getAIResponse('Hello there!');

  assert.strictEqual(fetchCalls.length, 1, 'Expected Hugging Face fetch to be invoked once');
  assert(result && typeof result === 'object', 'Expected fallback result to be an object');
  assert.strictEqual(result.source, 'local-fallback', 'Expected local fallback source');
  assert.strictEqual(result.response, 'local fallback response', 'Expected fallback chat response');
  assert(result.message.includes('trouble reaching the AI service'), 'Expected fallback message to mention service issue');

  console.log('Ixia pending Hugging Face fallback test passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
