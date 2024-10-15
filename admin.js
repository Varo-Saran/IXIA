function checkAdminAuth() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser || !currentUser.isAdmin) {
        showCustomModal('Access Denied', "You don't have permission to access this page. Redirecting to login page.", () => {
            window.location.href = "login.html";
        });
    }
}

checkAdminAuth();

document.addEventListener('DOMContentLoaded', () => {
    const totalAccountsElement = document.getElementById('total-accounts');
    const activeUsersElement = document.getElementById('active-users');
    const newUsersElement = document.getElementById('new-users');
    const userListElement = document.getElementById('user-list');
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // Add logout functionality
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('userToken');
            window.location.href = 'login.html';
        });
    }

    // Theme toggle functionality
    const currentTheme = localStorage.getItem('theme') || 'light';
    body.classList.add(currentTheme === 'dark' ? 'dark-theme' : 'light-theme');
    updateThemeToggle(currentTheme);

    themeToggle.addEventListener('click', () => {
        if (body.classList.contains('dark-theme')) {
            body.classList.replace('dark-theme', 'light-theme');
            localStorage.setItem('theme', 'light');
            updateThemeToggle('light');
        } else {
            body.classList.replace('light-theme', 'dark-theme');
            localStorage.setItem('theme', 'dark');
            updateThemeToggle('dark');
        }
    });

    function updateThemeToggle(theme) {
        const icon = themeToggle.querySelector('i');
        if (theme === 'dark') {
            icon.classList.replace('fa-moon', 'fa-sun');
        } else {
            icon.classList.replace('fa-sun', 'fa-moon');
        }
    }

    // Fetch and display account information
    function displayAccountInfo() {
        const users = JSON.parse(localStorage.getItem('users')) || [];
        const currentAdmin = JSON.parse(localStorage.getItem('currentUser'));
        totalAccountsElement.textContent = users.length;
        activeUsersElement.textContent = Math.floor(users.length * 0.8); // Mock data
        newUsersElement.textContent = Math.floor(users.length * 0.2); // Mock data

        userListElement.innerHTML = '';
        users.forEach(user => {
            const row = document.createElement('tr');
            const isAdmin = user.email === currentAdmin.email;
            row.innerHTML = `
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.registrationDate || 'N/A'}</td>
                <td>
                    ${isAdmin ? `
                        <button class="edit-admin-btn" data-action="email" title="Change Email">
                            <i class="fas fa-envelope"></i>
                        </button>
                        <button class="edit-admin-btn" data-action="password" title="Change Password">
                            <i class="fas fa-key"></i>
                        </button>
                    ` : `
                        <button class="edit-btn" data-email="${user.email}" title="Edit User">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" data-email="${user.email}" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="reset-pwd-btn" data-email="${user.email}" title="Reset Password">
                            <i class="fas fa-key"></i>
                        </button>
                    `}
                </td>
            `;
            userListElement.appendChild(row);
        });

        // Add event listeners for buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => editUser(btn.dataset.email));
        });
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteUser(btn.dataset.email));
        });
        document.querySelectorAll('.reset-pwd-btn').forEach(btn => {
            btn.addEventListener('click', () => resetUserPassword(btn.dataset.email));
        });
        document.querySelectorAll('.edit-admin-btn').forEach(btn => {
            btn.addEventListener('click', () => editAdminInfo(btn.dataset.action));
        });
    }

    displayAccountInfo();

    function deleteUser(email) {
        showCustomModal('Confirm Deletion', `Are you sure you want to delete the user with email: ${email}?`, () => {
            let users = JSON.parse(localStorage.getItem('users')) || [];
            users = users.filter(user => user.email !== email);
            localStorage.setItem('users', JSON.stringify(users));
            displayAccountInfo(); // Refresh the user list
            showCustomModal('Success', 'User deleted successfully');
        }, true); // true to show both Confirm and Cancel buttons
    }
    
    function resetUserPassword(email) {
        showCustomModal('Reset Password', `Enter new password for user: ${email}`, (newPassword) => {
            if (newPassword) {
                let users = JSON.parse(localStorage.getItem('users')) || [];
                const userIndex = users.findIndex(user => user.email === email);
                if (userIndex !== -1) {
                    users[userIndex].password = hashPassword(newPassword);
                    localStorage.setItem('users', JSON.stringify(users));
                    showCustomModal('Success', 'Password reset successfully');
                } else {
                    showCustomModal('Error', 'User not found');
                }
            }
        }, false, true); // false for Cancel button, true for input field
    }

    // Edit admin information
    function editAdminInfo(action) {
        const currentAdmin = JSON.parse(localStorage.getItem('currentUser'));
        let users = JSON.parse(localStorage.getItem('users')) || [];
        const adminIndex = users.findIndex(user => user.email === currentAdmin.email);
    
        if (adminIndex === -1) {
            showCustomModal('Error', 'Admin user not found');
            return;
        }
    
        if (action === 'email') {
            showEmailChangeModal(currentAdmin.email, (newEmail) => {
                if (newEmail && newEmail !== currentAdmin.email) {
                    // Check if the new email already exists
                    if (users.some(user => user.email === newEmail)) {
                        showCustomModal('Error', 'This email is already in use. Please choose a different one.');
                        return;
                    }
                    users[adminIndex].email = newEmail;
                    currentAdmin.email = newEmail;
                    localStorage.setItem('users', JSON.stringify(users));
                    localStorage.setItem('currentUser', JSON.stringify(currentAdmin));
                    showCustomModal('Success', 'Email updated successfully');
                    displayAccountInfo(); // Refresh the user list
                }
            });
        } else if (action === 'password') {
            showCustomModal('Change Password', 'Enter new password:', (newPassword) => {
                if (newPassword) {
                    users[adminIndex].password = hashPassword(newPassword);
                    localStorage.setItem('users', JSON.stringify(users));
                    showCustomModal('Success', 'Password updated successfully');
                }
            }, true, true, 'password'); // true for Cancel button, true for input field, 'password' for input type
        }
    }
    
    function showCustomModal(title, message, callback, showCancel = false, showInput = false, inputType = 'text') {
        const modal = document.getElementById('custom-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalContent = document.querySelector('.modal-content .input-group');
        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');
    
        modalTitle.textContent = title;
        
        if (showInput) {
            modalContent.innerHTML = `
                <label for="modal-input">${message}</label>
                <input type="${inputType}" id="modal-input">
            `;
        } else {
            modalContent.innerHTML = `<p>${message}</p>`;
        }
    
        modal.classList.add('show');
    
        const handleConfirm = () => {
            modal.classList.remove('show');
            if (showInput) {
                const input = document.getElementById('modal-input');
                callback(input.value);
            } else {
                callback();
            }
            cleanup();
        };
    
        const handleCancel = () => {
            modal.classList.remove('show');
            cleanup();
        };
    
        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };
    
        confirmBtn.addEventListener('click', handleConfirm);
        
        if (showCancel) {
            cancelBtn.style.display = 'inline-block';
            cancelBtn.addEventListener('click', handleCancel);
        } else {
            cancelBtn.style.display = 'none';
        }
    
        // Close modal when clicking outside
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                handleCancel();
            }
        });
    }

    function showEmailChangeModal(currentEmail, callback) {
        const modal = document.getElementById('custom-modal');
        const modalTitle = document.getElementById('modal-title');
        const inputGroup = document.querySelector('.modal-content .input-group');
        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');
    
        if (!modal || !inputGroup || !confirmBtn || !cancelBtn) {
            console.error('One or more modal elements not found');
            return;
        }
    
        modalTitle.textContent = 'Change Email';
        inputGroup.innerHTML = `
            <label for="new-email-input">New Email Address:</label>
            <input type="email" id="new-email-input" value="${currentEmail}">
        `;
        modal.classList.add('show');
    
        const handleConfirm = (e) => {
            e.preventDefault();
            const newEmail = document.getElementById('new-email-input').value.trim();
            if (newEmail === currentEmail) {
                showCustomModal('Error', 'The new email is the same as the current one. Please enter a different email.');
                return;
            }
            modal.classList.remove('show');
            callback(newEmail);
            cleanup();
        };
    
        const handleCancel = (e) => {
            e.preventDefault();
            modal.classList.remove('show');
            cleanup();
        };
    
        const handleOutsideClick = (event) => {
            if (event.target === modal) {
                modal.classList.remove('show');
                cleanup();
            }
        };
    
        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            modal.removeEventListener('click', handleOutsideClick);
        };
    
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        modal.addEventListener('click', handleOutsideClick);
    }

    // Simple password hashing function (for demonstration purposes only)
    function hashPassword(password) {
        return btoa(password); // This is NOT secure, use proper hashing in real applications
    }

    // Populate system statistics (mock data)
    document.getElementById('total-chats').textContent = '1,234';
    document.getElementById('messages-today').textContent = '567';
    document.getElementById('avg-response-time').textContent = '1.5 s';
});