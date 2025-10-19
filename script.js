// Global state and DOM Elements
let chatManager;
let lastMessageId = null;
let isWaitingForResponse = false;
let attachments = [];
let editingMessageId = null;
let currentUser = null;
let activeModel = 'chat';
let isModelSelectorOpen = false;
let modelOptionFocusIndex = -1;

// DOM Elements
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const uploadFileBtn = document.getElementById('upload-file-btn');
const fileInput = document.getElementById('file-input');
const typingIndicator = document.getElementById('typing-indicator');
const themeToggle = document.getElementById('theme-toggle');
const savedChatsList = document.getElementById('saved-chats-list');
const newChatButton = document.getElementById('new-chat-button');
const clearChatButton = document.getElementById('clear-chat-button');
const exportChatButton = document.getElementById('export-chat-button');
const clearSavedChatsButton = document.getElementById('clear-saved-chats-button');
const toggleSidebarButton = document.getElementById('toggle-sidebar-btn');
const sidebar = document.getElementById('sidebar');
const rootElement = document.documentElement;
const profileButton = document.getElementById('profile-button');
const profileDropdown = document.getElementById('profile-dropdown');
const profilePicture = document.getElementById('profile-picture');
const logo = document.querySelector('.top-left-logo');
const mainContent = document.querySelector('.main-content');
const modelSelector = document.querySelector('.model-selector');
const modelSelectorToggle = document.getElementById('model-selector-toggle');
const modelSelectorList = modelSelector ? modelSelector.querySelector('[role="listbox"]') : null;
const modelSelectorOptions = modelSelectorList ? Array.from(modelSelectorList.querySelectorAll('[role="option"]')) : [];

const MODEL_STORAGE_KEY = 'ixia.activeModel';
const MODEL_LABELS = {
  chat: 'Chat',
  math: 'Math',
  creative: 'Creative/Other'
};

let textareaBaselineHeight = null;
let textareaLineHeight = null;

if (window.marked) {
  window.marked.setOptions({
    breaks: true,
    gfm: true
  });
}

function renderMessageText(rawText = '') {
  const text = typeof rawText === 'string' ? rawText : String(rawText ?? '');

  if (window.marked) {
    const parsed = window.marked.parse(text);
    if (window.DOMPurify) {
      return window.DOMPurify.sanitize(parsed);
    }
    return parsed;
  }

  const fallback = document.createElement('div');
  fallback.textContent = text;
  return fallback.innerHTML.replace(/\n/g, '<br>');
}

if (modelSelectorList) {
  modelSelectorList.setAttribute('aria-hidden', 'true');
}

if (modelSelectorOptions.length) {
  modelSelectorOptions.forEach((option, index) => {
    if (!option.id) {
      option.id = `model-selector-option-${option.dataset.model || index}`;
    }
    option.tabIndex = -1;
  });
}

function loadStoredModel() {
  try {
    const stored = localStorage.getItem(MODEL_STORAGE_KEY);
    if (stored && Object.prototype.hasOwnProperty.call(MODEL_LABELS, stored)) {
      return stored;
    }
  } catch (error) {
    console.warn('Unable to read stored model preference:', error);
  }
  return 'chat';
}

function persistModelPreference(modelKey) {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, modelKey);
  } catch (error) {
    console.warn('Unable to persist model preference:', error);
  }
}

function getModelLabel(modelKey) {
  return MODEL_LABELS[modelKey] || MODEL_LABELS.chat;
}

function getOptionIndexByModel(modelKey) {
  return modelSelectorOptions.findIndex(option => option.dataset.model === modelKey);
}

function updateModelSelectorUI() {
  if (!modelSelector || !modelSelectorToggle) return;

  const labelElement = modelSelectorToggle.querySelector('.model-selector__label');
  if (labelElement) {
    labelElement.textContent = getModelLabel(activeModel);
  }

  modelSelector.setAttribute('data-active-model', activeModel);
  modelSelectorToggle.setAttribute('data-active-model', activeModel);
  modelSelectorToggle.setAttribute('aria-label', `Active model: ${getModelLabel(activeModel)}`);

  let selectedOption = null;
  modelSelectorOptions.forEach(option => {
    const isSelected = option.dataset.model === activeModel;
    option.classList.toggle('is-selected', isSelected);
    option.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    option.tabIndex = isModelSelectorOpen ? 0 : -1;
    if (isSelected) {
      selectedOption = option;
    }
  });

  if (modelSelectorList) {
    if (selectedOption) {
      modelSelectorList.setAttribute('aria-activedescendant', selectedOption.id);
    } else {
      modelSelectorList.removeAttribute('aria-activedescendant');
    }
  }
}

function setActiveModel(modelKey, { persist = true, closeDropdown = true, focusToggle = true } = {}) {
  const normalizedModel = Object.prototype.hasOwnProperty.call(MODEL_LABELS, modelKey)
    ? modelKey
    : 'chat';

  activeModel = normalizedModel;

  if (persist) {
    persistModelPreference(activeModel);
  }

  updateModelSelectorUI();

  if (closeDropdown) {
    closeModelSelector({ focusToggle });
  }
}

function focusModelOptionByOffset(offset) {
  if (!modelSelectorOptions.length) return;

  const total = modelSelectorOptions.length;
  if (modelOptionFocusIndex < 0) {
    modelOptionFocusIndex = Math.max(0, getOptionIndexByModel(activeModel));
  }

  modelOptionFocusIndex = (modelOptionFocusIndex + offset + total) % total;
  const optionToFocus = modelSelectorOptions[modelOptionFocusIndex];
  if (optionToFocus) {
    optionToFocus.focus();
    if (modelSelectorList) {
      modelSelectorList.setAttribute('aria-activedescendant', optionToFocus.id);
    }
  }
}

function openModelSelector({ focusOption = true } = {}) {
  if (!modelSelector || !modelSelectorToggle || !modelSelectorList || isModelSelectorOpen) {
    return;
  }

  isModelSelectorOpen = true;
  modelSelector.classList.add('is-open');
  modelSelectorToggle.setAttribute('aria-expanded', 'true');
  modelSelectorList.setAttribute('aria-hidden', 'false');

  modelSelectorOptions.forEach(option => {
    option.tabIndex = 0;
  });

  updateModelSelectorUI();

  const selectedIndex = Math.max(0, getOptionIndexByModel(activeModel));
  modelOptionFocusIndex = selectedIndex;

  document.addEventListener('pointerdown', handlePointerDownOutside);
  document.addEventListener('keydown', handleModelSelectorKeydown);
  document.addEventListener('focusin', handleModelSelectorFocusChange, true);

  if (focusOption) {
    const optionToFocus = modelSelectorOptions[selectedIndex] || modelSelectorOptions[0];
    optionToFocus?.focus();
  }
}

function closeModelSelector({ focusToggle = false } = {}) {
  if (!modelSelector || !modelSelectorToggle || !isModelSelectorOpen) {
    return;
  }

  isModelSelectorOpen = false;
  modelSelector.classList.remove('is-open');
  modelSelectorToggle.setAttribute('aria-expanded', 'false');
  if (modelSelectorList) {
    modelSelectorList.setAttribute('aria-hidden', 'true');
  }

  document.removeEventListener('pointerdown', handlePointerDownOutside);
  document.removeEventListener('keydown', handleModelSelectorKeydown);
  document.removeEventListener('focusin', handleModelSelectorFocusChange, true);

  modelOptionFocusIndex = -1;

  updateModelSelectorUI();

  if (focusToggle) {
    modelSelectorToggle?.focus();
  }
}

function handlePointerDownOutside(event) {
  if (!modelSelector) return;
  if (!modelSelector.contains(event.target) && event.target !== modelSelectorToggle) {
    closeModelSelector();
  }
}

function handleModelSelectorKeydown(event) {
  if (!isModelSelectorOpen) return;

  const targetIsToggle = event.target === modelSelectorToggle;
  const targetInsideList = modelSelector?.contains(event.target);
  if (!targetIsToggle && !targetInsideList) {
    return;
  }

  switch (event.key) {
    case 'Escape':
      event.preventDefault();
      closeModelSelector({ focusToggle: true });
      break;
    case 'ArrowDown':
      event.preventDefault();
      focusModelOptionByOffset(1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      focusModelOptionByOffset(-1);
      break;
    default:
      break;
  }
}

function handleModelSelectorFocusChange(event) {
  if (!isModelSelectorOpen || !modelSelector) return;
  if (!modelSelector.contains(event.target) && event.target !== modelSelectorToggle) {
    closeModelSelector();
  }
}

function handleModelSelection(option) {
  if (!option) return;
  const modelKey = option.dataset.model;
  setActiveModel(modelKey, { persist: true, closeDropdown: true, focusToggle: true });
}

function initializeModelSelector() {
  if (!modelSelector || !modelSelectorToggle || !modelSelectorList) {
    activeModel = 'chat';
    return;
  }

  modelSelectorToggle.setAttribute('aria-expanded', 'false');
  modelSelector.classList.remove('is-open');

  activeModel = loadStoredModel();
  updateModelSelectorUI();

  modelSelectorToggle.addEventListener('click', () => {
    if (isModelSelectorOpen) {
      closeModelSelector();
    } else {
      openModelSelector({ focusOption: false });
    }
  });

  modelSelectorToggle.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isModelSelectorOpen) {
        closeModelSelector({ focusToggle: false });
      } else {
        openModelSelector();
      }
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !isModelSelectorOpen) {
      event.preventDefault();
      openModelSelector();
    } else if (event.key === 'Escape' && isModelSelectorOpen) {
      event.preventDefault();
      closeModelSelector({ focusToggle: true });
    }
  });

  modelSelectorOptions.forEach(option => {
    option.addEventListener('click', () => handleModelSelection(option));
    option.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleModelSelection(option);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeModelSelector({ focusToggle: true });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusModelOptionByOffset(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusModelOptionByOffset(-1);
      }
    });
  });

  window.addEventListener('resize', () => {
    if (isModelSelectorOpen) {
      closeModelSelector();
    }
  });
}

initializeModelSelector();

function debounce(fn, wait = 150) {
  let timeoutId;
  return (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      fn.apply(null, args);
    }, wait);
  };
}

function captureTextareaMetrics() {
  if (!userInput) return;

  const computed = window.getComputedStyle(userInput);
  let lineHeight = parseFloat(computed.lineHeight);
  if (Number.isNaN(lineHeight)) {
    const fontSize = parseFloat(computed.fontSize);
    lineHeight = Number.isNaN(fontSize) ? 16 : fontSize * 1.2;
  }

  let baseline = parseFloat(computed.height);
  if (Number.isNaN(baseline)) {
    baseline = userInput.scrollHeight || lineHeight;
  }

  textareaLineHeight = lineHeight;
  textareaBaselineHeight = baseline;

  userInput.style.height = `${textareaBaselineHeight}px`;
  userInput.style.overflowY = 'hidden';
  userInput.classList.remove('is-scrollable');
}

function ensureTextareaMetrics() {
  if (textareaBaselineHeight === null || textareaLineHeight === null) {
    captureTextareaMetrics();
  }
}

function updateTextareaSize() {
  if (!userInput) return;

  ensureTextareaMetrics();
  if (textareaBaselineHeight === null || textareaLineHeight === null) {
    return;
  }

  const maxExpandedHeight = textareaBaselineHeight + textareaLineHeight * 2;

  userInput.style.overflowY = 'hidden';
  userInput.classList.remove('is-scrollable');
  userInput.style.height = 'auto';

  const scrollHeight = userInput.scrollHeight;
  const heightDifferenceThreshold = 1;
  const targetHeight =
    scrollHeight > textareaBaselineHeight + heightDifferenceThreshold
      ? Math.min(scrollHeight, maxExpandedHeight)
      : textareaBaselineHeight;

  userInput.style.height = `${targetHeight}px`;

  if (scrollHeight > maxExpandedHeight + heightDifferenceThreshold) {
    userInput.style.overflowY = 'auto';
    userInput.classList.add('is-scrollable');
  }
}

function recalculateTextareaMetrics() {
  if (!userInput) return;

  captureTextareaMetrics();
  updateTextareaSize();
}

const debouncedTextareaMetrics = debounce(recalculateTextareaMetrics);

if (userInput) {
  const initializeTextarea = () => {
    captureTextareaMetrics();
    updateTextareaSize();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTextarea);
  } else {
    initializeTextarea();
  }

  userInput.addEventListener('input', () => {
    updateTextareaSize();
    updateSendButtonState();
  });
}

const DEFAULT_PROFILE_IMAGES = {
  light: 'assets/images/default-profile-icon-light.png',
  dark: 'assets/images/default-profile-icon-dark.png'
};

// Message Class
class Message {
  constructor(text, isUser, attachments = []) {
    this.id = Date.now().toString();
    this.text = text;
    this.isUser = Boolean(isUser); // Ensure isUser is always a boolean
    this.attachments = attachments;
    this.timestamp = new Date().toISOString();
    this.edited = false;
  }
}

const DEFAULT_CHAT_PLACEHOLDER = 'New Chat';

function generateChatTitle(text, timestamp = new Date()) {
  const normalizedText = (text || '').replace(/\s+/g, ' ').trim();
  if (normalizedText) {
    const snippet = normalizedText.slice(0, 40);
    return normalizedText.length > 40
      ? `${snippet.trimEnd()}…`
      : snippet;
  }

  const dateString = new Date(timestamp).toISOString().split('T')[0];
  return `Chat on ${dateString}`;
}

// Chat History Manager Class
class ChatHistoryManager {
  constructor(userId) {
    this.userId = userId;
    this.chats = this.loadChats();
    this.currentChatId = this.loadCurrentChatId();
    this.nextChatNumber = this.loadNextChatNumber();

    // Ensure the counter is stored for future sessions
    this.saveChatCounter();
    
    // If no currentChatId but chats exist, set to first chat
    if (!this.currentChatId && Object.keys(this.chats).length > 0) {
      this.currentChatId = Object.keys(this.chats)[0];
      this.saveCurrentChatId();
    }
  }

  loadChats() {
    const savedChats = localStorage.getItem(`chats_${this.userId}`);
    return savedChats ? JSON.parse(savedChats) : {};
  }

  saveChats() {
    localStorage.setItem(`chats_${this.userId}`, JSON.stringify(this.chats));
  }

  loadNextChatNumber() {
    const storedCounter = parseInt(localStorage.getItem(`chatCounter_${this.userId}`), 10);
    if (!Number.isNaN(storedCounter) && storedCounter > 0) {
      return storedCounter;
    }

    const highestSuffix = Object.values(this.chats).reduce((max, chat) => {
      const match = chat.title?.match(/(\d+)\s*$/);
      if (match) {
        const number = parseInt(match[1], 10);
        if (!Number.isNaN(number)) {
          return Math.max(max, number);
        }
      }
      return max;
    }, 0);

    return highestSuffix + 1;
  }

  saveChatCounter() {
    localStorage.setItem(`chatCounter_${this.userId}`, String(this.nextChatNumber));
  }

  resetChatCounter() {
    this.nextChatNumber = 1;
    localStorage.removeItem(`chatCounter_${this.userId}`);
    this.saveChatCounter();
  }

  loadCurrentChatId() {
    const savedId = localStorage.getItem(`currentChatId_${this.userId}`);
    // Verify the ID exists in chats
    return savedId && this.chats[savedId] ? savedId : null;
  }

  saveCurrentChatId() {
    if (this.currentChatId) {
      localStorage.setItem(`currentChatId_${this.userId}`, this.currentChatId);
    } else {
      localStorage.removeItem(`currentChatId_${this.userId}`);
    }
  }

  createNewChat() {
    const chatId = Date.now().toString();
    this.chats[chatId] = {
      title: `Chat ${this.nextChatNumber}`,
      messages: []
    };
    this.nextChatNumber += 1;
    this.setCurrentChat(chatId);
    this.saveChats();
    this.saveChatCounter();
    return chatId;
  }

  addMessage(message, isUser) {
    if (!this.currentChatId) {
      this.currentChatId = this.createNewChat();
    }

    let newMessage;
    if (typeof message === 'string') {
      newMessage = new Message(message, isUser);
    } else {
      newMessage = new Message(message.text, isUser, message.attachments);
    }

    const currentChat = this.chats[this.currentChatId];
    currentChat.messages.push(newMessage);

    const isDefaultTitle = /^Chat \d+$/.test(currentChat.title) || currentChat.title === DEFAULT_CHAT_PLACEHOLDER;
    if (isUser && isDefaultTitle) {
      currentChat.title = generateChatTitle(newMessage.text, newMessage.timestamp);
    }

    this.saveChats();
    return newMessage;
  }

  editMessage(messageId, newText) {
    if (this.currentChatId && this.chats[this.currentChatId]) {
      const message = this.chats[this.currentChatId].messages.find(m => m.id === messageId);
      if (message && message.isUser) {
        message.text = newText;
        message.edited = true;
        this.saveChats();
        return true;
      }
    }
    return false;
  }

  getChatMessages(chatId) {
    return this.chats[chatId]?.messages || [];
  }

  renameChat(chatId, newTitle) {
    if (this.chats[chatId]) {
      this.chats[chatId].title = newTitle;
      this.saveChats();
    }
  }

  deleteChat(chatId) {
    if (this.chats[chatId]) {
      delete this.chats[chatId];
      if (this.currentChatId === chatId) {
        this.currentChatId = Object.keys(this.chats)[0] || null;
      }
      this.saveChats();
    }
  }

  getAllChats() {
    return Object.entries(this.chats)
      .map(([id, chat]) => ({
        id,
        title: chat.title,
        lastMessage: chat.messages[chat.messages.length - 1]?.text || '',
        timestamp: chat.messages[chat.messages.length - 1]?.timestamp || ''
      }))
      .sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      });
  }

  setCurrentChat(chatId) {
    if (this.chats[chatId]) {
      this.currentChatId = chatId;
      this.saveCurrentChatId();
    }
  }

  getCurrentChat() {
    return this.currentChatId ? this.chats[this.currentChatId] : null;
  }
}

// Message handling functions
function addMessage(message, isUser = false) {
  try {
    let newMessage;
    if (typeof message === 'string') {
      newMessage = chatManager.addMessage(message, isUser);
    } else if (message.id) {
      // If it's an existing message with an ID, use it directly
      newMessage = message;
    } else {
      // If it's a new message object without an ID
      newMessage = chatManager.addMessage({
        text: message.text,
        attachments: message.attachments || []
      }, isUser);
    }
    
    const messageElement = createMessageElement({
      ...newMessage,
      isUser: isUser || newMessage.isUser // Ensure isUser is properly set
    });
    chatWindow.appendChild(messageElement);

    if (!isUser) {
      hideTypingIndicator();
    }

    scrollToBottom(!isUser);
    lastMessageId = newMessage.id;
  } catch (error) {
    console.error('Error adding message:', error);
    showModal(
      "Error",
      "Failed to add message. Please try again."
    );
  }
}

function createMessageElement(message) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', message.isUser ? 'user-message' : 'ai-message');
  messageElement.dataset.messageId = message.id;

  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');
  
  // Add attachments if present
  if (message.attachments && message.attachments.length > 0) {
    const attachmentsContainer = document.createElement('div');
    attachmentsContainer.classList.add('message-attachments');
    
    message.attachments.forEach(attachment => {
      const attachmentElement = document.createElement('div');
      attachmentElement.classList.add('message-attachment');
      attachmentElement.innerHTML = `
        <i class="fa-solid ${getFileTypeIcon(attachment.type)}"></i>
        <span>${attachment.name}</span>
      `;
      attachmentsContainer.appendChild(attachmentElement);
    });
    
    messageContent.appendChild(attachmentsContainer);
  }

  // Add text content
  const textElement = document.createElement('div');
  textElement.classList.add('message-text');
  textElement.innerHTML = renderMessageText(message.text);
  messageContent.appendChild(textElement);

  // Add edit button for user messages
  if (message.isUser) {
    const editButton = document.createElement('button');
    editButton.classList.add('edit-message-btn');
    editButton.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
    editButton.onclick = () => startEditingMessage(message.id);
    messageContent.appendChild(editButton);

    // Add edited indicator if message was edited
    if (message.edited) {
      const editedIndicator = document.createElement('span');
      editedIndicator.classList.add('edited-indicator');
      editedIndicator.textContent = '(edited)';
      messageContent.appendChild(editedIndicator);
    }
  }

  messageElement.appendChild(messageContent);
  return messageElement;
}

async function handleUserInput() {
  const messageText = userInput.value.trim();
  if ((!messageText && !attachments.length) || isWaitingForResponse) {
    return;
  }

  if (messageText.length > 4000) { // Add character limit
    showModal(
      "Message Too Long",
      "Please keep your message under 4000 characters."
    );
    return;
  }

  isWaitingForResponse = true;
  updateSendButtonState();

  // Create message with attachments
  const messageObj = {
    text: messageText,
    attachments: [...attachments]
  };

  // Add user message
  addMessage(messageObj, true);
  
  // Clear input and attachments
  clearUserInput();
  clearAttachments();

  showTypingIndicator();
  scrollToBottom(true);

  try {
    const aiResponse = await window.getAIResponse(messageText, activeModel);
    const responseText = typeof aiResponse === 'object' && aiResponse.response 
      ? aiResponse.response 
      : aiResponse;
    
    addMessage(responseText, false);
  } catch (error) {
    console.error('Error getting AI response:', error);
    hideTypingIndicator();
    addMessage("I'm sorry, I encountered an error. Please try again.", false);
  } finally {
    hideTypingIndicator();
    isWaitingForResponse = false;
    updateSendButtonState();
    scrollToBottom(true);
  }
}

// Message editing functions
function startEditingMessage(messageId) {
  // If already editing a different message, cancel the previous edit
  if (editingMessageId && editingMessageId !== messageId) {
    const previousMessageElement = document.querySelector(`[data-message-id="${editingMessageId}"]`);
    if (previousMessageElement) {
      const previousChat = chatManager.chats[chatManager.currentChatId];
      const previousMessage = previousChat?.messages.find(m => m.id === editingMessageId);
      cancelMessageEdit(editingMessageId, previousMessage?.text || '');
    }
  }

  const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageElement || editingMessageId === messageId) return;

  editingMessageId = messageId;
  const textElement = messageElement.querySelector('.message-text');
  if (!textElement) return;
  const currentChat = chatManager.chats[chatManager.currentChatId];
  const messageData = currentChat?.messages.find(m => m.id === messageId);
  const originalText = messageData?.text || '';

  const editContainer = document.createElement('div');
  editContainer.classList.add('edit-container');
  editContainer.innerHTML = `
    <textarea class="edit-textarea"></textarea>
    <div class="edit-buttons">
      <button class="save-edit-btn" title="Save changes">
        <i class="fa-solid fa-check"></i>
      </button>
      <button class="cancel-edit-btn" title="Cancel editing">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;

  textElement.replaceWith(editContainer);

  const textarea = editContainer.querySelector('.edit-textarea');
  textarea.value = originalText;
  editContainer.querySelector('.save-edit-btn').onclick = () =>
    saveMessageEdit(messageId, textarea.value.trim());
  editContainer.querySelector('.cancel-edit-btn').onclick = () => 
    cancelMessageEdit(messageId, originalText);

  textarea.focus();
}



function saveMessageEdit(messageId, newText) {
  if (!newText) return;

  const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageElement) return;

  if (chatManager.editMessage(messageId, newText)) {
    const editContainer = messageElement.querySelector('.edit-container');
    const textElement = document.createElement('div');
    textElement.classList.add('message-text');
    textElement.innerHTML = renderMessageText(newText);
    editContainer.replaceWith(textElement);

    if (!messageElement.querySelector('.edited-indicator')) {
      const editedIndicator = document.createElement('span');
      editedIndicator.classList.add('edited-indicator');
      editedIndicator.textContent = '(edited)';
      messageElement.querySelector('.message-content').appendChild(editedIndicator);
    }

    // Remove all messages after the edited message
    const chat = chatManager.getCurrentChat();
    const messageIndex = chat.messages.findIndex(m => m.id === messageId);
    if (messageIndex !== -1) {
      // Remove messages from storage
      chat.messages = chat.messages.slice(0, messageIndex + 1);
      chatManager.saveChats();

      // Remove messages from UI
      const allMessages = Array.from(chatWindow.children);
      const currentMessageIndex = allMessages.findIndex(m => m.dataset.messageId === messageId);
      if (currentMessageIndex !== -1) {
        allMessages.slice(currentMessageIndex + 1).forEach(msg => msg.remove());
      }

      // Get AI response for the edited message
      handleEditedMessage(newText);
    }
  }

  editingMessageId = null;
}

// Add new function to handle AI response after edit
async function handleEditedMessage(editedText) {
  showTypingIndicator();
  scrollToBottom(true);

  try {
    const aiResponse = await window.getAIResponse(editedText, activeModel);
    const responseText = typeof aiResponse === 'object' && aiResponse.response 
      ? aiResponse.response 
      : aiResponse;
    
    addMessage(responseText, false);
  } catch (error) {
    console.error('Error getting AI response:', error);
    hideTypingIndicator();
    addMessage("I'm sorry, I encountered an error. Please try again.", false);
  } finally {
    hideTypingIndicator();
    scrollToBottom(true);
  }
}

function cancelMessageEdit(messageId, originalText) {
  const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageElement) return;

  const editContainer = messageElement.querySelector('.edit-container');
  const textElement = document.createElement('div');
  textElement.classList.add('message-text');
  textElement.innerHTML = renderMessageText(originalText);
  editContainer.replaceWith(textElement);

  editingMessageId = null;
}

// File handling functions
function handleFileUpload(files) {
  if (!files || files.length === 0) return;
  
  const allowedTypes = {
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'text/plain': 'text',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
  };

  const maxSize = 5 * 1024 * 1024; // 5MB
  const existingSize = attachments.reduce((sum, attachment) => {
    if (typeof attachment.size === 'number') {
      return sum + attachment.size;
    }
    if (attachment.file && typeof attachment.file.size === 'number') {
      return sum + attachment.file.size;
    }
    return sum;
  }, 0);
  const newFilesSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
  const totalSize = existingSize + newFilesSize;

  if (totalSize > maxSize) {
    showModal(
      "Files Too Large",
      "Total file size must be smaller than 5MB."
    );
    return;
  }

  Array.from(files).forEach(file => {
    if (!allowedTypes[file.type]) {
      showModal(
        "Invalid File Type",
        "Please upload only images (JPG, PNG, GIF), text files, or documents (PDF, DOC, DOCX)."
      );
      return;
    }

    attachments.push({
      file,
      type: allowedTypes[file.type],
      name: file.name,
      size: file.size
    });
  });

  updateAttachmentsPreview();
  updateSendButtonState();
}

function updateAttachmentsPreview() {
  const previewContainer = document.querySelector('.attachments-preview');
  if (!previewContainer) return;

  const track = previewContainer.querySelector('.attachments-track');
  if (!track) return;

  track.innerHTML = '';

  attachments.forEach((attachment, index) => {
    const card = document.createElement('div');
    card.className = 'attachment-card';
    card.innerHTML = `
      <button class="remove-attachment" data-index="${index}" aria-label="Remove attachment">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="attachment-card__icon">
        <i class="fa-solid ${getFileTypeIcon(attachment.type)}"></i>
      </div>
      <span class="attachment-card__name" title="${attachment.name}">${attachment.name}</span>
    `;
    track.appendChild(card);
  });

  previewContainer.classList.toggle('is-visible', attachments.length > 0);

  // Add remove attachment handlers
  document.querySelectorAll('.remove-attachment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      attachments.splice(index, 1);
      updateAttachmentsPreview();
      updateSendButtonState();
    });
  });
}

function getFileTypeIcon(type) {
  const icons = {
    'image': 'fa-image',
    'text': 'fa-file-alt',
    'pdf': 'fa-file-pdf',
    'doc': 'fa-file-word',
    'docx': 'fa-file-word'
  };
  return icons[type] || 'fa-file';
}

function clearAttachments() {
  attachments.forEach(attachment => {
    if (attachment.file instanceof File) {
      URL.revokeObjectURL(URL.createObjectURL(attachment.file));
    }
  });
  attachments = [];
  updateAttachmentsPreview();
  updateSendButtonState();
}

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
  clearAttachments();
});

function updateSendButtonState() {
  const messageText = userInput.value.trim();
  const hasAttachments = attachments.length > 0;
  const isDisabled = (!messageText && !hasAttachments) || isWaitingForResponse;
  
  sendMessageBtn.disabled = isDisabled;
  sendMessageBtn.style.opacity = isDisabled ? '0.5' : '1';
  sendMessageBtn.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
}  

// UI utility functions
function showTypingIndicator() {
  if (!typingIndicator.classList.contains('visible')) {
      chatWindow.appendChild(typingIndicator);
      typingIndicator.classList.add('visible');
      scrollToBottom(true);
  }
}

function hideTypingIndicator() {
  typingIndicator.classList.remove('visible');
  if (typingIndicator.parentNode === chatWindow) {
      chatWindow.removeChild(typingIndicator);
  }
}

function clearUserInput() {
  if (!userInput) return;
  userInput.value = '';
  updateTextareaSize();
  updateSendButtonState();
}

function scrollToBottom(force = false) {
  const chatContainer = document.querySelector('.messages-container');
  const isScrolledToBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + 1;
  
  if (force || isScrolledToBottom) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// Modal handling
const appModalElement = document.getElementById('custom-modal');
const appModalTitle = document.getElementById('modal-title');
const appModalBody = appModalElement ? appModalElement.querySelector('.modal-body') : null;
const appModalConfirm = document.getElementById('modal-confirm');
const appModalCancel = document.getElementById('modal-cancel');
const appModalClose = document.getElementById('modal-close');

const appModalController = appModalElement
  ? ModalController.create(appModalElement, {
      closeSelectors: ['.modal-overlay', '.modal-close'],
      initialFocus: '#modal-confirm',
      hooks: {
        beforeOpen({ context }) {
          if (!appModalTitle || !appModalBody) {
            return false;
          }
          if (context && typeof context.setupContent === 'function') {
            context.setupContent();
          }
          return true;
        },
        afterOpen({ context }) {
          if (context && context.selectInput) {
            const input = appModalElement.querySelector('#modal-input');
            if (input) {
              input.focus({ preventScroll: true });
              input.select();
            }
          }
        },
        afterClose({ reason, context }) {
          if (context) {
            if (reason === 'confirm') {
              if (typeof context.onConfirm === 'function') {
                const input = context.showInput
                  ? appModalElement.querySelector('#modal-input')
                  : null;
                context.onConfirm(context.showInput && input ? input.value : undefined);
              }
            } else if (typeof context.onCancel === 'function') {
              context.onCancel(reason);
            }
          }
        }
      }
    })
  : null;

if (appModalController && appModalConfirm) {
  appModalConfirm.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const context = appModalController.getContext();
    const validationResult = appModalController.runHook('validate', {
      reason: 'confirm',
      data: context && context.showInput
        ? (appModalElement.querySelector('#modal-input') || {}).value
        : undefined
    });
    if (validationResult === false) {
      return;
    }
    appModalController.close({ reason: 'confirm' });
  });
}

const cancelTargets = [appModalCancel, appModalClose].filter(Boolean);
cancelTargets.forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (appModalController) {
      appModalController.close({ reason: 'cancel' });
    }
  });
});

function showModal(title, message, onConfirm, onCancel, showInput = false, inputType = 'text', initialValue = '', hooks = {}) {
  if (!appModalController || !appModalElement || !appModalTitle || !appModalBody) {
      return;
  }

  const setupContent = () => {
      appModalTitle.textContent = title;
      if (showInput) {
          appModalBody.innerHTML = `
              <label for="modal-input">${message}</label>
              <input type="${inputType}" id="modal-input" value="${initialValue}">
          `;
      } else {
          appModalBody.innerHTML = `<p>${message}</p>`;
      }
  };

  const dynamicHooks = {};
  if (typeof hooks.onValidate === 'function') {
      dynamicHooks.validate = hooks.onValidate;
  }
  if (typeof hooks.onToast === 'function') {
      dynamicHooks.toast = hooks.onToast;
  }
  if (typeof hooks.onCropper === 'function') {
      dynamicHooks.cropper = hooks.onCropper;
  }
  if (typeof hooks.afterOpen === 'function') {
      dynamicHooks.afterOpen = hooks.afterOpen;
  }
  if (typeof hooks.afterClose === 'function') {
      dynamicHooks.afterClose = hooks.afterClose;
  }
  if (typeof hooks.beforeOpen === 'function') {
      dynamicHooks.beforeOpen = hooks.beforeOpen;
  }
  if (typeof hooks.beforeClose === 'function') {
      dynamicHooks.beforeClose = hooks.beforeClose;
  }

  appModalController.open({
      initialFocus: showInput ? '#modal-input' : '#modal-confirm',
      context: {
          onConfirm,
          onCancel,
          showInput,
          setupContent,
          selectInput: showInput
      },
      hooks: dynamicHooks
  });
}

function hideModal() {
  if (appModalController) {
      appModalController.close({ reason: 'manual' });
  }
}

function resolveThemeValue(value) {
  return value === 'dark' || value === 'light'
      ? value
      : value
          ? 'dark'
          : 'light';
}

function getActiveTheme() {
  return document.body.classList.contains('dark-theme') ? 'dark' : 'light';
}

function getProfileImageSource(theme = getActiveTheme()) {
  const normalizedTheme = resolveThemeValue(theme);
  if (currentUser?.profilePicture) {
      return currentUser.profilePicture;
  }
  return normalizedTheme === 'dark'
      ? DEFAULT_PROFILE_IMAGES.dark
      : DEFAULT_PROFILE_IMAGES.light;
}

function updateProfilePicture(theme = getActiveTheme()) {
  if (!profilePicture) {
      return;
  }
  const normalizedTheme = resolveThemeValue(theme);
  const source = getProfileImageSource(normalizedTheme);
  if (profilePicture.getAttribute('src') !== source) {
      profilePicture.setAttribute('src', source);
  }
}

// Theme handling
function setTheme(preferredTheme) {
  const normalizedTheme = resolveThemeValue(preferredTheme);
  const isDark = normalizedTheme === 'dark';

  document.body.classList.toggle('dark-theme', isDark);

  const icon = themeToggle?.querySelector('i');
  if (icon) {
      icon.classList.toggle('fa-sun', isDark);
      icon.classList.toggle('fa-moon', !isDark);
  }

  if (themeToggle) {
      themeToggle.title = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";
  }

  localStorage.setItem('theme', normalizedTheme);
  localStorage.removeItem('darkTheme');

  updateProfilePicture(normalizedTheme);
}

function loadSavedTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
      return;
  }

  const legacyDarkTheme = localStorage.getItem('darkTheme');
  if (legacyDarkTheme !== null) {
      setTheme(legacyDarkTheme === 'true' ? 'dark' : 'light');
      return;
  }

  setTheme('light');
}

// Sidebar handling
function calculateSidebarToggleOffset() {
  if (!sidebar) {
      return '0px';
  }

  const offset = `${sidebar.offsetWidth}px`;

  if (rootElement) {
      rootElement.style.setProperty('--sidebar-toggle-offset', offset);
  }

  return offset;
}

function updateSidebarToggleState(isOpen) {
  if (!toggleSidebarButton) {
      return;
  }

  calculateSidebarToggleOffset();

  toggleSidebarButton.classList.toggle('is-open', isOpen);
  if (isOpen) {
      toggleSidebarButton.style.removeProperty('left');
  } else {
      toggleSidebarButton.style.left = '0px';
  }
  toggleSidebarButton.setAttribute('aria-label', isOpen ? 'Close sidebar' : 'Open sidebar');
  toggleSidebarButton.setAttribute('aria-pressed', String(isOpen));
  toggleSidebarButton.setAttribute('aria-expanded', String(isOpen));
}

function toggleSidebar() {
  const isOpen = sidebar.classList.toggle('show');
  mainContent.classList.toggle('sidebar-open', isOpen);
  logo.classList.toggle('sidebar-open', isOpen);

  updateSidebarToggleState(isOpen);
}

function closeSidebar() {
  sidebar.classList.remove('show');
  mainContent.classList.remove('sidebar-open');
  logo.classList.remove('sidebar-open');
  updateSidebarToggleState(false);
}

// Chat operations
function clearSavedChats() {
  showModal(
      "Clear All Saved Chats",
      "Are you sure you want to clear all saved chats? This action cannot be undone.",
      () => {
          chatManager.chats = {};
          chatManager.currentChatId = null;
          chatManager.resetChatCounter();
          chatManager.saveChats();
          chatWindow.innerHTML = '';
          updateSavedChatsList();
          createNewChat();
      }
  );
}

// Function to create a typing animation effect
function addWelcomeMessageWithTyping() {
  showTypingIndicator();
  
  // Short delay before starting to type
  setTimeout(() => {
    hideTypingIndicator();
    addMessage("Hello, I'm Ixia. How can I assist you today?", false);
  }, 1500); // 1.5 second delay
}

// Create new chat function
function createNewChat() {
  const chatId = chatManager.createNewChat();
  chatWindow.innerHTML = '';
  lastMessageId = null;
  chatManager.setCurrentChat(chatId);
  updateSavedChatsList();
  
  // Add welcome message with typing animation
  addWelcomeMessageWithTyping();
  
  if (window.innerWidth <= 767) {
    closeSidebar();
  }
}

function clearChat() {
  showModal(
    "Clear Current Chat",
    "Are you sure you want to clear this chat? This action cannot be undone.",
    () => {
      chatWindow.innerHTML = '';
      chatManager.chats[chatManager.currentChatId].messages = [];
      chatManager.saveChats();
      
      // Add welcome message with typing animation
      addWelcomeMessageWithTyping();
    }
  );
}

function loadChat(chatId, isInitialLoad = false) {
  if (!chatId) {
    chatId = chatManager.currentChatId;
    if (!chatId) return;
  }

  if (!isInitialLoad && chatManager.currentChatId === chatId) {
    return;
  }

  chatManager.setCurrentChat(chatId);
  chatWindow.innerHTML = '';
  lastMessageId = null;

  const chat = chatManager.getCurrentChat();
  if (chat?.messages?.length > 0) {
    const sortedMessages = chat.messages.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    sortedMessages.forEach(msg => {
      const messageObj = {
        id: msg.id,
        text: msg.text,
        isUser: msg.isUser,
        attachments: msg.attachments || [],
        edited: msg.edited,
        timestamp: msg.timestamp
      };
      
      addMessage(messageObj, messageObj.isUser);
    });
  } else {
    // Add welcome message with typing animation for empty chats
    addWelcomeMessageWithTyping();
  }

  updateSavedChatsList();
  scrollToBottom(true);
}

function deleteChat(chatId) {
  showModal(
      "Delete Chat",
      "Are you sure you want to delete this chat?",
      () => {
          chatManager.deleteChat(chatId);
          if (chatManager.currentChatId === chatId) {
              const chats = chatManager.getAllChats();
              if (chats.length > 0) {
                  loadChat(chats[0].id);
              } else {
                  createNewChat();
              }
          }
          updateSavedChatsList();
      }
  );
}

function renameChat(chatId) {
  const chat = chatManager.chats[chatId];
  showModal(
      "Rename Chat",
      "Enter new chat title:",
      (newTitle) => {
          if (newTitle?.trim()) {
              chatManager.renameChat(chatId, newTitle.trim());
              updateSavedChatsList();
          }
      },
      null,
      true,
      "text",
      chat.title
  );
}

function exportChat() {
  const currentChat = chatManager.getCurrentChat();
  if (currentChat?.messages?.length > 0) {
      const chatTitle = currentChat.title;
      let exportContent = `${chatTitle}\n\n`;
      
      currentChat.messages.forEach(msg => {
          const role = msg.isUser ? "User" : "AI";
          let messageContent = `${role}: ${msg.text}`;
          
          if (msg.attachments?.length > 0) {
              const attachmentsList = msg.attachments
                  .map(att => att.name)
                  .join(', ');
              messageContent += `\nAttachments: ${attachmentsList}`;
          }
          
          if (msg.edited) {
              messageContent += ' (edited)';
          }
          
          exportContent += messageContent + '\n\n';
      });
      
      const blob = new Blob([exportContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${chatTitle.replace(/\s+/g, '_')}_export.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  } else {
      showModal(
          "Export Error",
          "There's no chat to export or the current chat is empty."
      );
  }
}

function updateSavedChatsList() {
  savedChatsList.innerHTML = '';
  chatManager.getAllChats().forEach(chat => {
      const li = document.createElement('li');
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      const span = document.createElement('span');
      span.textContent = chat.title;
      li.appendChild(span);

      const handleSelection = () => {
          loadChat(chat.id);
          if (window.innerWidth <= 767) {
              closeSidebar();
          }
      };

      li.addEventListener('click', (e) => {
          e.stopPropagation();
          handleSelection();
      });

      li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelection();
          }
      });

      if (chat.id === chatManager.currentChatId) {
          li.classList.add('selected');
          li.setAttribute('aria-current', 'true');
      } else {
          li.removeAttribute('aria-current');
      }

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'chat-actions';

      const renameButton = document.createElement('button');
      const chatTitle = chat.title || 'chat';
      renameButton.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
      const renameLabel = `Rename ${chatTitle}`;
      renameButton.setAttribute('aria-label', renameLabel);
      renameButton.setAttribute('title', renameLabel);
      renameButton.onclick = (e) => {
          e.stopPropagation();
          renameChat(chat.id);
      };

      const deleteButton = document.createElement('button');
      deleteButton.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
      const deleteLabel = `Delete ${chatTitle}`;
      deleteButton.setAttribute('aria-label', deleteLabel);
      deleteButton.setAttribute('title', deleteLabel);
      deleteButton.onclick = (e) => {
          e.stopPropagation();
          deleteChat(chat.id);
      };

      actionsDiv.appendChild(renameButton);
      actionsDiv.appendChild(deleteButton);
      li.appendChild(actionsDiv);
      savedChatsList.appendChild(li);
  });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadSavedTheme();
  if (!isUserAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

  if (currentUser?.isAdmin) {
    if (currentUser.forcePasswordReset) {
      const updatedAdminUser = { ...currentUser, forcePasswordReset: false };
      localStorage.setItem('currentUser', JSON.stringify(updatedAdminUser));
      currentUser = updatedAdminUser;
    }
    window.location.href = 'admin.html';
    return;
  }

  updateProfilePicture();

  const chatUserId = currentUser.normalizedEmail || currentUser.email;
  chatManager = new ChatHistoryManager(chatUserId);

  // Load the current chat with isInitialLoad flag
  const currentChatId = chatManager.loadCurrentChatId();
  if (currentChatId) {
    loadChat(currentChatId, true);
  } else {
    // If no current chat, create new one or load first available
    const chats = chatManager.getAllChats();
    if (chats.length > 0) {
      loadChat(chats[0].id, true);
    } else {
      createNewChat();
    }
  }

  updateSavedChatsList();
  scrollToBottom(true);

  if (window.innerWidth <= 767) {
    closeSidebar();
  }
});  

// Message input handlers
sendMessageBtn.addEventListener('click', handleUserInput);

userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !isWaitingForResponse) {
      e.preventDefault();
      handleUserInput();
  }
});

// File handling
uploadFileBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  handleFileUpload(e.target.files);
  fileInput.value = '';
});

// Theme toggle
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
      const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(nextTheme);
      recalculateTextareaMetrics();
  });
}

// Sidebar handling
if (toggleSidebarButton) {
  updateSidebarToggleState(sidebar.classList.contains('show'));
  toggleSidebarButton.addEventListener('click', toggleSidebar);
}

document.addEventListener('click', (event) => {
  if (window.innerWidth <= 767 &&
      !sidebar.contains(event.target) &&
      toggleSidebarButton &&
      !toggleSidebarButton.contains(event.target) &&
      sidebar.classList.contains('show')) {
      closeSidebar();
  }
});

window.addEventListener('resize', () => {
  calculateSidebarToggleOffset();

  if (window.innerWidth > 767) {
      sidebar.classList.remove('show');
      mainContent.classList.remove('sidebar-open');
      if (toggleSidebarButton) {
          toggleSidebarButton.style.display = 'none';
          updateSidebarToggleState(false);
      }
  } else {
      if (toggleSidebarButton) {
          toggleSidebarButton.style.display = 'flex';
          updateSidebarToggleState(sidebar.classList.contains('show'));
      }
  }

  debouncedTextareaMetrics();
});

// Message editing
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && editingMessageId) {
      const messageElement = document.querySelector(`[data-message-id="${editingMessageId}"]`);
      if (messageElement) {
          const originalText = chatManager.chats[chatManager.currentChatId]
              .messages.find(m => m.id === editingMessageId).text;
          cancelMessageEdit(editingMessageId, originalText);
      }
  }
});

// Chat operation buttons
newChatButton.addEventListener('click', createNewChat);
clearChatButton.addEventListener('click', clearChat);
exportChatButton.addEventListener('click', exportChat);
clearSavedChatsButton.addEventListener('click', clearSavedChats);

// Profile menu
profileButton.addEventListener('click', (e) => {
  e.stopPropagation();
  const isExpanded = profileDropdown.classList.toggle('show');
  profileButton.setAttribute('aria-expanded', String(isExpanded));
});

document.addEventListener('click', (event) => {
  if (!profileButton.contains(event.target) && !profileDropdown.contains(event.target)) {
      profileDropdown.classList.remove('show');
      profileButton.setAttribute('aria-expanded', 'false');
  }
});

// Profile menu items
document.getElementById('logout').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem('userToken');
  window.location.href = 'login.html';
});

document.getElementById('my-account').addEventListener('click', (e) => {
  e.preventDefault();
  window.location.href = 'account.html';
});

['chat-history', 'settings', 'help', 'about-ixia'].forEach(id => {
  document.getElementById(id).addEventListener('click', (e) => {
      e.preventDefault();
      console.log(`${id} clicked`);
  });
});

// Utility function
function isUserAuthenticated() {
  return localStorage.getItem('userToken') !== null;
}
