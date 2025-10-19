// config/apiConfig.js - Hugging Face API configuration
const globalScope = typeof window !== 'undefined'
  ? window
  : (typeof globalThis !== 'undefined' ? globalThis : {});

const DEFAULT_BASE_URL = 'https://api-inference.huggingface.co/models';
const DEFAULT_CHAT_MODEL = 'tiiuae/falcon-7b-instruct';
const DEFAULT_TIMEOUT_MS = 20000;

function readRuntimeSetting(key) {
  if (!key) {
    return null;
  }

  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return String(process.env[key]);
    }
  } catch (error) {
    // Accessing process.env may throw in certain sandboxed environments.
  }

  if (globalScope && typeof globalScope[key] === 'string' && globalScope[key].trim()) {
    return globalScope[key].trim();
  }

  const runtimeConfigSources = [
    globalScope && globalScope.__IXIA_CONFIG__,
    globalScope && globalScope.__ENV__
  ];

  for (const source of runtimeConfigSources) {
    if (source && typeof source === 'object' && typeof source[key] === 'string' && source[key].trim()) {
      return source[key].trim();
    }
  }

  return null;
}

function getHuggingFaceToken() {
  const token = readRuntimeSetting('HUGGINGFACE_TOKEN');

  if (!token) {
    console.warn(
      'Hugging Face access token missing. Add HUGGINGFACE_TOKEN to your .env file or set window.HUGGINGFACE_TOKEN at runtime.'
    );
  }

  return token;
}

function getChatModelName() {
  return readRuntimeSetting('HUGGINGFACE_MODEL') || DEFAULT_CHAT_MODEL;
}

function getBaseUrl() {
  return readRuntimeSetting('HUGGINGFACE_BASE_URL') || DEFAULT_BASE_URL;
}

function getTimeout() {
  const rawTimeout = readRuntimeSetting('HUGGINGFACE_TIMEOUT_MS');
  const parsed = rawTimeout ? Number(rawTimeout) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

const apiConfig = {
  get baseUrl() {
    return getBaseUrl();
  },
  get timeoutMs() {
    return getTimeout();
  },
  getAccessToken: getHuggingFaceToken,
  getChatModelName
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = apiConfig;
}

if (globalScope && typeof globalScope === 'object') {
  globalScope.apiConfig = apiConfig;
}
