document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signup-form');
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

    // Signup functionality
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = signupForm.querySelector('input[type="text"]').value;
        const email = signupForm.querySelector('input[type="email"]').value;
        const password = signupForm.querySelectorAll('input[type="password"]')[0].value;
        const confirmPassword = signupForm.querySelectorAll('input[type="password"]')[1].value;

        if (password !== confirmPassword) {
            errorMessage.textContent = "Passwords do not match.";
            return;
        }

        try {
            const response = await signupUser(username, email, password);
            if (response.success) {
                showModal('Sign Up Successful!', 'Please log in with your new account.');
            } else {
                errorMessage.textContent = response.message || 'Sign up failed. Please try again.';
            }
        } catch (error) {
            console.error('Sign up error:', error);
            errorMessage.textContent = 'An error occurred. Please try again later.';
        }
    });

    // Modal functionality
    modalOkBtn.addEventListener('click', () => {
        customModal.style.display = 'none';
        window.location.href = 'login.html';
    });

    window.addEventListener('click', (event) => {
        if (event.target === customModal) {
            customModal.style.display = 'none';
            window.location.href = 'login.html';
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

function signupUser(username, email, password) {
    return new Promise((resolve) => {
        setTimeout(() => {
            let users = JSON.parse(localStorage.getItem('users')) || [];
            const existingUser = users.find(user => user.email === email);
            
            if (existingUser) {
                resolve({
                    success: false,
                    message: 'Email already in use.'
                });
            } else {
                const newUser = { username, email, password: hashPassword(password) };
                users.push(newUser);
                localStorage.setItem('users', JSON.stringify(users));
                resolve({
                    success: true,
                    message: 'Sign up successful'
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