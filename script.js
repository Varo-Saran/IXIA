// Chat History Manager
class ChatHistoryManager {
    constructor(userId) {
      this.userId = userId;
      this.chats = this.loadChats();
      this.currentChatId = null;
    }
  
    loadChats() {
      const savedChats = localStorage.getItem(`chats_${this.userId}`);
      return savedChats ? JSON.parse(savedChats) : {};
    }
  
    saveChats() {
      localStorage.setItem(`chats_${this.userId}`, JSON.stringify(this.chats));
    }
  
    createNewChat() {
      const chatId = Date.now().toString();
      this.chats[chatId] = {
        title: `Chat ${Object.keys(this.chats).length + 1}`,
        messages: []
      };
      this.currentChatId = chatId;
      this.saveChats();
      return chatId;
    }
  
    addMessage(message, isUser) {
      if (!this.currentChatId) {
        this.currentChatId = this.createNewChat();
      }
  
      const messageId = Date.now().toString();
      const newMessage = { id: messageId, text: message, isUser, timestamp: new Date().toISOString() };
      
      this.chats[this.currentChatId].messages.push(newMessage);
      this.saveChats();
      
      return newMessage;
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
      }
    }
  
    getCurrentChat() {
      return this.currentChatId ? this.chats[this.currentChatId] : null;
    }
  }
  
 // Main script
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const typingIndicator = document.getElementById('typing-indicator');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle.querySelector('i');
const savedChatsList = document.getElementById('saved-chats-list');
const newChatButton = document.getElementById('new-chat-button');
const clearChatButton = document.getElementById('clear-chat-button');
const exportChatButton = document.getElementById('export-chat-button');
const clearSavedChatsButton = document.getElementById('clear-saved-chats-button');

let chatManager;
let lastMessageId = null;
let isWaitingForResponse = false;

// Function to show modal
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

    // Close modal when clicking outside
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
            addMessage("Chat cleared. How can I assist you?", false, false);
        }
    );
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
  
  function exportChat() {
    const currentChat = chatManager.getCurrentChat();
    if (currentChat && currentChat.messages.length > 0) {
        const chatTitle = currentChat.title;
        let exportContent = `${chatTitle}\n\n`;
        currentChat.messages.forEach(msg => {
            const role = msg.isUser ? "User" : "AI";
            exportContent += `${role}: ${msg.text}\n\n`;
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
        alert("There's no chat to export or the current chat is empty.");
    }
}

function addMessage(message, isUser = false, save = true, sentiment = 'neutral') {
    let newMessage;
    if (save) {
      newMessage = chatManager.addMessage(message, isUser);
    } else {
      newMessage = { id: Date.now().toString(), text: message, isUser, timestamp: new Date().toISOString() };
    }
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', isUser ? 'user-message' : 'ai-message');
    if (!isUser) {
      messageElement.classList.add(sentiment); // Add sentiment class for AI messages
    }
    messageElement.dataset.messageId = newMessage.id;
    chatWindow.appendChild(messageElement);
  
    if (!isUser) {
      hideTypingIndicator();
    }
  
    new Typed(messageElement, {
      strings: [message],
      typeSpeed: 20,
      showCursor: false,
      onBegin: () => {
        messageElement.classList.add('visible');
      },
      onComplete: () => {
        chatWindow.scrollTop = chatWindow.scrollHeight;
      }
    });
  
    lastMessageId = newMessage.id;
    
    console.log('Message added:', newMessage);
  }
  
function showTypingIndicator() {
    if (!typingIndicator.classList.contains('visible')) {
        chatWindow.appendChild(typingIndicator);
        typingIndicator.classList.add('visible');
        chatWindow.scrollTop = chatWindow.scrollHeight;
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
}

function disableSendButton() {
    sendButton.disabled = true;
    sendButton.classList.add('disabled');
}

function enableSendButton() {
    sendButton.disabled = false;
    sendButton.classList.remove('disabled');
}

async function handleUserInput() {
    const message = userInput.value.trim();
    if (message && !isWaitingForResponse) {
      isWaitingForResponse = true;
      disableSendButton();
      addMessage(message, true);
      clearUserInput();
  
      showTypingIndicator();
      try {
        // Use the getAIResponse function from Ixia.js
        const aiResponse = await window.getAIResponse(message);
        const sentiment = simpleSentimentAnalysis(aiResponse); // You'll need to import this function from Ixia.js
        addMessage(aiResponse, false, true, sentiment);
      } catch (error) {
        console.error('Error getting AI response:', error);
        hideTypingIndicator();
        addMessage("I'm sorry, I encountered an error. Please try again.");
      } finally {
        isWaitingForResponse = false;
        enableSendButton();
      }
    }
  }
  
  function updateSavedChatsList() {
    savedChatsList.innerHTML = '';
    chatManager.getAllChats().forEach(chat => {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = chat.title;
        li.appendChild(span);
        li.onclick = () => loadChat(chat.id);
        
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
  
  function loadChat(chatId) {
    if (chatManager.currentChatId === chatId) {
        console.log('Already on this chat. No need to reload.');
        return; // Exit the function if we're already on this chat
    }

    chatManager.setCurrentChat(chatId);
    chatWindow.innerHTML = ''; // Clear the chat window
    lastMessageId = null; // Reset the last message ID

    const chat = chatManager.getCurrentChat();
    if (chat && chat.messages && chat.messages.length > 0) {
        // Sort messages by timestamp to ensure correct order
        const sortedMessages = chat.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        sortedMessages.forEach(msg => {
            addMessage(msg.text, msg.isUser, false); // false means don't save to storage
        });
    } else {
        addMessage("Hello, I'm Ixia. How can I assist you today?", false, false);
    }

    updateSavedChatsList(); // Update the list to reflect the new selection
    console.log('Chat loaded:', chat);
}
  
  function createNewChat() {
      const chatId = chatManager.createNewChat();
      chatWindow.innerHTML = '';
      lastMessageId = null;
      updateSavedChatsList();
      loadChat(chatId);
  }
  
  function renameChat(chatId) {
    const chat = chatManager.chats[chatId];
    showModal(
        "Rename Chat",
        `Enter new chat title:`,
        (newTitle) => {
            if (newTitle && newTitle.trim() !== "") {
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
  
  // Event listeners
sendButton.addEventListener('click', handleUserInput);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isWaitingForResponse) handleUserInput();
});

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    themeIcon.classList.toggle('fa-moon');
    themeIcon.classList.toggle('fa-sun');
});

newChatButton.addEventListener('click', createNewChat);
clearChatButton.addEventListener('click', clearChat);
exportChatButton.addEventListener('click', exportChat);
clearSavedChatsButton.addEventListener('click', clearSavedChats);

// Profile menu functionality
const profileButton = document.getElementById('profile-button');
const profileDropdown = document.getElementById('profile-dropdown');

profileButton.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown.style.display = profileDropdown.style.display === 'block' ? 'none' : 'block';
});

window.addEventListener('click', (event) => {
    if (!event.target.closest('.profile-menu')) {
        profileDropdown.style.display = 'none';
    }
});

// Profile menu item event listeners
document.getElementById('logout').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('userToken');
    window.location.href = 'login.html';
});

document.getElementById('my-account').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'account.html';
});

document.getElementById('chat-history').addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Chat History clicked');
});

document.getElementById('settings').addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Settings clicked');
});

document.getElementById('help').addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Help & FAQ clicked');
});

document.getElementById('about-ixia').addEventListener('click', (e) => {
    e.preventDefault();
    console.log('About Ixia AI clicked');
});

// Function to check if user is authenticated
function isUserAuthenticated() {
    return localStorage.getItem('userToken') !== null;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!isUserAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    chatManager = new ChatHistoryManager(currentUser.email);

    updateSavedChatsList();
    const chats = chatManager.getAllChats();
    if (chats.length === 0) {
        createNewChat();
    } else {
        loadChat(chats[0].id);
    }

    console.log('Initial chats:', chatManager.chats);
});