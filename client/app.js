class ProfessionalChat {
    constructor() {
        this.socket = io('http://localhost:5000'); // Change to your backend URL
        this.currentUser = null;
        this.selectedContact = null;
        this.messages = [];
        
        this.initializeEventListeners();
        this.loadFromLocalStorage();
    }

    initializeEventListeners() {
        // Message input events
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            } else {
                this.socket.emit('typing', {
                    from: this.currentUser.email,
                    to: this.selectedContact?.email
                });
            }
        });

        // Socket events
        this.socket.on('new-message', (message) => {
            this.displayMessage(message);
            this.scrollToBottom();
        });

        this.socket.on('online-users', (users) => {
            this.updateContactsList(users);
        });

        this.socket.on('user-typing', (data) => {
            this.showTypingIndicator(data.from);
        });

        this.socket.on('message-read-update', (messageId) => {
            this.updateMessageReadStatus(messageId);
        });

        // Image upload
        document.getElementById('imageUpload').addEventListener('change', (e) => {
            this.handleImageUpload(e.target.files[0]);
        });
    }

    // Authentication
    googleLogin() {
        // Simulate Google OAuth - In real app, use Firebase Auth or similar
        const user = {
            email: 'user@gmail.com',
            name: 'Google User',
            avatar: 'https://via.placeholder.com/150'
        };
        this.handleLogin(user);
    }

    emailLogin() {
        const email = document.getElementById('emailInput').value;
        const name = document.getElementById('nameInput').value;
        
        if (!email || !name) {
            alert('Please enter both email and name');
            return;
        }

        const user = {
            email: email,
            name: name,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
        };
        this.handleLogin(user);
    }

    handleLogin(user) {
        this.currentUser = user;
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('chatScreen').classList.remove('hidden');
        
        // Update UI
        document.getElementById('userName').textContent = user.name;
        document.getElementById('userAvatar').src = user.avatar;
        
        // Notify server
        this.socket.emit('user-login', user);
    }

    // Messages
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 140);
        textarea.style.height = newHeight + 'px';
    }

    sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        
        if (!text || !this.selectedContact) return;

        const message = {
            from: this.currentUser.email,
            to: this.selectedContact.email,
            text: text,
            type: 'text',
            timestamp: new Date()
        };

        this.socket.emit('send-message', message);
        input.value = '';
        this.autoResizeTextarea(input);
    }

    displayMessage(message) {
        const messagesContainer = document.getElementById('messagesContainer');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.from === this.currentUser.email ? 'sent' : 'received'}`;
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        
        if (message.image) {
            const img = document.createElement('img');
            img.src = message.image;
            img.className = 'message-image';
            img.onclick = () => this.viewImage(message.image);
            bubbleDiv.appendChild(img);
        }
        
        if (message.text) {
            const textDiv = document.createElement('div');
            textDiv.className = 'message-text';
            textDiv.textContent = message.text;
            bubbleDiv.appendChild(textDiv);
        }
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.formatTime(message.timestamp);
        bubbleDiv.appendChild(timeDiv);

        // Right-click context menu
        bubbleDiv.oncontextmenu = (e) => {
            e.preventDefault();
            this.showMessageContextMenu(e, message);
        };

        messageDiv.appendChild(bubbleDiv);
        messagesContainer.appendChild(messageDiv);
        
        // Mark as read if it's our message
        if (message.from !== this.currentUser.email) {
            this.socket.emit('message-read', message._id);
        }
    }

    // Image handling
    triggerImageUpload() {
        document.getElementById('imageUpload').click();
    }

    handleImageUpload(file) {
        if (!file || !this.selectedContact) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const message = {
                from: this.currentUser.email,
                to: this.selectedContact.email,
                image: e.target.result,
                type: 'image',
                timestamp: new Date()
            };
            
            this.socket.emit('send-message', message);
        };
        reader.readAsDataURL(file);
    }

    viewImage(imageSrc) {
        window.open(imageSrc, '_blank');
    }

    // Contacts
    updateContactsList(users) {
        const contactsList = document.getElementById('contactsList');
        contactsList.innerHTML = '';
        
        users.forEach(user => {
            if (user.email !== this.currentUser.email) {
                const contactDiv = document.createElement('div');
                contactDiv.className = 'contact-item';
                contactDiv.onclick = () => this.selectContact(user);
                
                contactDiv.innerHTML = `
                    <img class="contact-avatar" src="${user.avatar}" alt="${user.name}">
                    <div class="contact-info">
                        <div class="contact-name">${user.name}</div>
                        <div class="contact-status ${user.online ? 'online' : ''}">
                            ${user.online ? 'Online' : 'Offline'}
                        </div>
                    </div>
                `;
                
                contactsList.appendChild(contactDiv);
            }
        });
    }

    selectContact(contact) {
        this.selectedContact = contact;
        
        // Update UI
        document.querySelectorAll('.contact-item').forEach(item => {
            item.classList.remove('active');
        });
        event.currentTarget.classList.add('active');
        
        document.getElementById('chatUserName').textContent = contact.name;
        document.getElementById('chatUserAvatar').src = contact.avatar;
        document.getElementById('userStatus').textContent = contact.online ? 'Online' : 'Offline';
        document.getElementById('userStatus').className = `user-status ${contact.online ? 'online' : ''}`;
        
        // Load messages for this contact
        this.loadMessages(contact.email);
    }

    // Message actions
    showMessageContextMenu(event, message) {
        const menu = document.getElementById('messageContextMenu');
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';
        menu.classList.remove('hidden');
        menu.dataset.messageId = message._id;
        
        // Hide menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', () => {
                menu.classList.add('hidden');
            }, { once: true });
        });
    }

    copyMessage() {
        const menu = document.getElementById('messageContextMenu');
        const messageId = menu.dataset.messageId;
        const message = this.messages.find(m => m._id === messageId);
        
        if (message) {
            navigator.clipboard.writeText(message.text).then(() => {
                alert('Message copied to clipboard!');
            });
        }
    }

    deleteMessage() {
        const menu = document.getElementById('messageContextMenu');
        const messageId = menu.dataset.messageId;
        
        if (confirm('Are you sure you want to delete this message?')) {
            // In real app, emit socket event to delete message
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                messageElement.remove();
            }
        }
    }

    // Utilities
    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showTypingIndicator(fromUser) {
        const indicator = document.getElementById('typingIndicator');
        indicator.classList.remove('hidden');
        
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            indicator.classList.add('hidden');
        }, 3000);
    }

    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        container.scrollTop = container.scrollHeight;
    }

    loadFromLocalStorage() {
        const savedUser = localStorage.getItem('chatUser');
        if (savedUser) {
            this.handleLogin(JSON.parse(savedUser));
        }
    }

    saveToLocalStorage() {
        if (this.currentUser) {
            localStorage.setItem('chatUser', JSON.stringify(this.currentUser));
        }
    }
}

// Emoji functions
function toggleEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    picker.classList.toggle('hidden');
}

function addEmoji(emoji) {
    const input = document.getElementById('messageInput');
    input.value += emoji;
    input.focus();
    document.getElementById('emojiPicker').classList.add('hidden');
}

// Global functions for HTML onclick
let chatApp;

window.onload = () => {
    chatApp = new ProfessionalChat();
};

function googleLogin() {
    chatApp.googleLogin();
}

function emailLogin() {
    chatApp.emailLogin();
}

function sendMessage() {
    chatApp.sendMessage();
}

function triggerImageUpload() {
    chatApp.triggerImageUpload();
}

function autoResizeTextarea(textarea) {
    chatApp.autoResizeTextarea(textarea);
}
