// Global state and DOM Elements
let chatManager;
let lastMessageId = null;
let isWaitingForResponse = false;
let attachments = [];
let editingMessageId = null;

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
const profileButton = document.getElementById('profile-button');
const profileDropdown = document.getElementById('profile-dropdown');
const logo = document.querySelector('.top-left-logo');
const mainContent = document.querySelector('.main-content');

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

// Chat History Manager Class
class ChatHistoryManager {
  constructor(userId) {
    this.userId = userId;
    this.chats = this.loadChats();
    this.currentChatId = this.loadCurrentChatId();
    
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
      title: `Chat ${Object.keys(this.chats).length + 1}`,
      messages: []
    };
    this.setCurrentChat(chatId);
    this.saveChats();
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

    this.chats[this.currentChatId].messages.push(newMessage);
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
    return Object.entries(this.chats).map(([id, chat]) => ({
      id,
      title: chat.title,
      lastMessage: chat.messages[chat.messages.length - 1]?.text || '',
      timestamp: chat.messages[chat.messages.length - 1]?.timestamp || ''
    }));
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
        <i class="fas ${getFileTypeIcon(attachment.type)}"></i>
        <span>${attachment.name}</span>
      `;
      attachmentsContainer.appendChild(attachmentElement);
    });
    
    messageContent.appendChild(attachmentsContainer);
  }

  // Add text content
  const textElement = document.createElement('div');
  textElement.classList.add('message-text');
  textElement.textContent = message.text;
  messageContent.appendChild(textElement);

  // Add edit button for user messages
  if (message.isUser) {
    const editButton = document.createElement('button');
    editButton.classList.add('edit-message-btn');
    editButton.innerHTML = '<i class="fas fa-edit"></i>';
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
    const aiResponse = await window.getAIResponse(messageText);
    const responseText = typeof aiResponse === 'object' && aiResponse.response 
      ? aiResponse.response 
      : aiResponse;
    
    addMessage(responseText, false);
  } catch (error) {
    console.error('Error getting AI response:', error);
    hideTypingIndicator();
    addMessage("I'm sorry, I encountered an error. Please try again.", false);
  } finally {
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
      const originalText = chatManager.chats[chatManager.currentChatId]
        .messages.find(m => m.id === editingMessageId).text;
      cancelMessageEdit(editingMessageId, originalText);
    }
  }

  const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageElement || editingMessageId === messageId) return;

  editingMessageId = messageId;
  const textElement = messageElement.querySelector('.message-text');
  const originalText = textElement.textContent;

  const editContainer = document.createElement('div');
  editContainer.classList.add('edit-container');
  editContainer.innerHTML = `
    <textarea class="edit-textarea">${originalText}</textarea>
    <div class="edit-buttons">
      <button class="save-edit-btn" title="Save changes">
        <i class="fas fa-check"></i>
      </button>
      <button class="cancel-edit-btn" title="Cancel editing">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;

  textElement.replaceWith(editContainer);

  const textarea = editContainer.querySelector('.edit-textarea');
  editContainer.querySelector('.save-edit-btn').onclick = () => 
    saveMessageEdit(messageId, textarea.value.trim());
  editContainer.querySelector('.cancel-edit-btn').onclick = () => 
    cancelMessageEdit(messageId, originalText);

  textarea.focus();
}

function adjustTextareaHeight() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px'; // Max height of 150px
}

userInput.addEventListener('input', () => {
  adjustTextareaHeight();
  updateSendButtonState();
});

function saveMessageEdit(messageId, newText) {
  if (!newText) return;

  const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageElement) return;

  if (chatManager.editMessage(messageId, newText)) {
    const editContainer = messageElement.querySelector('.edit-container');
    const textElement = document.createElement('div');
    textElement.classList.add('message-text');
    textElement.textContent = newText;
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
    const aiResponse = await window.getAIResponse(editedText);
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
  textElement.textContent = originalText;
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
  const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);

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
  previewContainer.innerHTML = '';

  attachments.forEach((attachment, index) => {
    const preview = document.createElement('div');
    preview.className = 'attachment-preview';
    preview.innerHTML = `
      <i class="fas ${getFileTypeIcon(attachment.type)}"></i>
      <span>${attachment.name}</span>
      <button class="remove-attachment" data-index="${index}">
        <i class="fas fa-times"></i>
      </button>
    `;
    previewContainer.appendChild(preview);
  });

  // Add remove attachment handlers
  document.querySelectorAll('.remove-attachment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      attachments.splice(index, 1);
      updateAttachmentsPreview();
      updateSendButtonState();
    });
  });

  previewContainer.style.display = attachments.length ? 'flex' : 'none';
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
  userInput.value = '';
  userInput.style.height = 'auto';
}

function scrollToBottom(force = false) {
  const chatContainer = document.querySelector('.messages-container');
  const isScrolledToBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + 1;
  
  if (force || isScrolledToBottom) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// Modal handling
function showModal(title, message, onConfirm, onCancel, showInput = false, inputType = 'text', initialValue = '') {
  const modal = document.getElementById('custom-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.querySelector('.modal-body');
  const confirmBtn = document.getElementById('modal-confirm');
  const cancelBtn = document.getElementById('modal-cancel');

  modalTitle.textContent = title;
  
  if (showInput) {
      modalBody.innerHTML = `
          <label for="modal-input">${message}</label>
          <input type="${inputType}" id="modal-input" value="${initialValue}">
      `;
  } else {
      modalBody.innerHTML = `<p>${message}</p>`;
  }
  
  modal.style.display = 'flex';

  const handleConfirm = () => {
      hideModal();
      if (showInput) {
          const input = document.getElementById('modal-input');
          if (onConfirm) onConfirm(input.value);
      } else {
          if (onConfirm) onConfirm();
      }
  };

  const handleCancel = () => {
      hideModal();
      if (onCancel) onCancel();
  };

  confirmBtn.onclick = handleConfirm;
  cancelBtn.onclick = handleCancel;

  window.onclick = (event) => {
      if (event.target === modal) {
          handleCancel();
      }
  };
}

function hideModal() {
  const modal = document.getElementById('custom-modal');
  modal.style.display = 'none';
}

// Theme handling
function setTheme(isDark) {
  if (isDark) {
      document.body.classList.add('dark-theme');
      themeToggle.querySelector('i').classList.replace('fa-moon', 'fa-sun');
      themeToggle.title = "Switch to Light Mode";
  } else {
      document.body.classList.remove('dark-theme');
      themeToggle.querySelector('i').classList.replace('fa-sun', 'fa-moon');
      themeToggle.title = "Switch to Dark Mode";
  }
  localStorage.setItem('darkTheme', isDark);
}

function loadSavedTheme() {
  const isDarkTheme = localStorage.getItem('darkTheme') === 'true';
  setTheme(isDarkTheme);
}

// Sidebar handling
function toggleSidebar() {
  sidebar.classList.toggle('show');
  mainContent.classList.toggle('sidebar-open');
  logo.classList.toggle('sidebar-open');
  
  if (sidebar.classList.contains('show')) {
      toggleSidebarButton.style.left = '250px';
      toggleSidebarButton.innerHTML = '&times;';
  } else {
      toggleSidebarButton.style.left = '0';
      toggleSidebarButton.innerHTML = '&#9776;';
  }
}

function closeSidebar() {
  sidebar.classList.remove('show');
  mainContent.classList.remove('sidebar-open');
  logo.classList.remove('sidebar-open');
  toggleSidebarButton.style.left = '0';
  toggleSidebarButton.innerHTML = '&#9776;';
}  

// Chat operations
function clearSavedChats() {
  showModal(
      "Clear All Saved Chats",
      "Are you sure you want to clear all saved chats? This action cannot be undone.",
      () => {
          chatManager.chats = {};
          chatManager.currentChatId = null;
          chatManager.saveChats();
          chatWindow.innerHTML = '';
          updateSavedChatsList();
          createNewChat();
      }
  );
}

function clearChat() {
  showModal(
      "Clear Current Chat",
      "Are you sure you want to clear this chat? This action cannot be undone.",
      () => {
          chatWindow.innerHTML = '';
          chatManager.chats[chatManager.currentChatId].messages = [];
          chatManager.saveChats();
          addMessage("Chat cleared. How can I assist you?", false);
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
      const span = document.createElement('span');
      span.textContent = chat.title;
      li.appendChild(span);
      
      li.onclick = (e) => {
          e.stopPropagation();
          loadChat(chat.id);
          if (window.innerWidth <= 767) {
              closeSidebar();
          }
      };
      
      if (chat.id === chatManager.currentChatId) {
          li.classList.add('selected');
      }

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'chat-actions';

      const renameButton = document.createElement('button');
      renameButton.innerHTML = '<i class="fas fa-edit"></i>';
      renameButton.onclick = (e) => {
          e.stopPropagation();
          renameChat(chat.id);
      };

      const deleteButton = document.createElement('button');
      deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
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

  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  chatManager = new ChatHistoryManager(currentUser.email);

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

userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = userInput.scrollHeight + 'px';
  updateSendButtonState();
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
themeToggle.addEventListener('click', () => {
  const isDarkTheme = document.body.classList.toggle('dark-theme');
  setTheme(isDarkTheme);
  themeToggle.querySelector('i').classList.toggle('fa-moon');
  themeToggle.querySelector('i').classList.toggle('fa-sun');
});

// Sidebar handling
toggleSidebarButton.addEventListener('click', toggleSidebar);

document.addEventListener('click', (event) => {
  if (window.innerWidth <= 767 && 
      !sidebar.contains(event.target) && 
      !toggleSidebarButton.contains(event.target) && 
      sidebar.classList.contains('show')) {
      closeSidebar();
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 767) {
      sidebar.classList.remove('show');
      mainContent.classList.remove('sidebar-open');
      toggleSidebarButton.style.display = 'none';
  } else {
      toggleSidebarButton.style.display = 'flex';
      if (!sidebar.classList.contains('show')) {
          toggleSidebarButton.style.left = '0';
      }
  }
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
  profileDropdown.classList.toggle('show');
});

document.addEventListener('click', (event) => {
  if (!profileButton.contains(event.target) && !profileDropdown.contains(event.target)) {
      profileDropdown.classList.remove('show');
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
