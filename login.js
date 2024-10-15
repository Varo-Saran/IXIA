// Add this function at the beginning of your login.js file
function initializeAdminUser() {
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const adminExists = users.some(user => user.isAdmin);
    
    if (!adminExists) {
        const adminUser = {
            username: 'admin',
            email: 'admin@ixiaai.com',
            password: hashPassword('adminpassword'),
            isAdmin: true
        };
        users.push(adminUser);
        localStorage.setItem('users', JSON.stringify(users));
        console.log('Admin user created');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeAdminUser();
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const customModal = document.getElementById('custom-modal');
    const modalOkBtn = document.getElementById('modal-ok-btn');

    // Theme toggle functionality (unchanged)
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

    // Login functionality
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = loginForm.querySelector('input[type="email"]').value;
        const password = loginForm.querySelector('input[type="password"]').value;

        try {
            const response = await loginUser(email, password);
            if (response.success) {
                localStorage.setItem('userToken', response.token);
                localStorage.setItem('currentUser', JSON.stringify(response.user));
                if (response.user.isAdmin) {
                    showModal('Admin Login Successful!', 'Redirecting to admin dashboard...');
                    setTimeout(() => {
                        window.location.href = 'admin.html';
                    }, 2000);
                } else {
                    showModal('Login Successful!', 'Redirecting to your dashboard...');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);
                }
            } else {
                errorMessage.textContent = response.message || 'Login failed. Please try again.';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMessage.textContent = 'An error occurred. Please try again later.';
        }
    });

    // Modal functionality
    modalOkBtn.addEventListener('click', () => {
        customModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === customModal) {
            customModal.style.display = 'none';
        }
    });
});

function showModal(title, message) {
    const modalTitle = document.querySelector('#custom-modal h2');
    const modalMessage = document.querySelector('#custom-modal p');
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    document.getElementById('custom-modal').style.display = 'block';
}

function loginUser(email, password) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const users = JSON.parse(localStorage.getItem('users')) || [];
            const user = users.find(u => u.email === email && u.password === hashPassword(password));
            
            if (user) {
                const token = generateToken(email);
                resolve({
                    success: true,
                    token: token,
                    user: { username: user.username, email: user.email, isAdmin: user.isAdmin },
                    message: 'Login successful'
                });
            } else {
                resolve({
                    success: false,
                    message: 'Invalid email or password'
                });
            }
        }, 1000); // Simulate network delay
    });
}

function hashPassword(password) {
    return btoa(password); // This is NOT secure, use proper hashing in real applications
}

function generateToken(email) {
    return btoa(email + ':' + new Date().getTime());
}