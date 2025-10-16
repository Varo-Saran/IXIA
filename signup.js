let signupModalController = null;

document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signup-form');
    const errorMessage = document.getElementById('error-message');
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const customModal = document.getElementById('custom-modal');
    const modalOkBtn = document.getElementById('modal-ok-btn');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const strengthIndicator = document.querySelector('#signup-form .strength-indicator');
    const strengthBar = document.querySelector('#signup-form .strength-bar');
    const strengthText = document.getElementById('password-strength-text');
    const passwordHelperText = document.getElementById('password-helper-text');
    const confirmHelperText = document.getElementById('confirm-password-helper');

    if (customModal) {
        signupModalController = ModalController.create(customModal, {
            closeSelectors: ['.modal-overlay', '.modal-close', '[data-close-modal]'],
            initialFocus: '#modal-ok-btn',
            hooks: {
                afterClose({ context }) {
                    if (context && context.redirectTo) {
                        window.location.href = context.redirectTo;
                    } else if (context && typeof context.onClose === 'function') {
                        context.onClose();
                    }
                }
            }
        });
    }

    if (signupModalController && modalOkBtn) {
        modalOkBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            signupModalController.close({ reason: 'confirm' });
        });
    }

    // Theme toggle functionality (unchanged)
    const currentTheme = localStorage.getItem('theme') || 'light';
    body.classList.add(currentTheme === 'dark' ? 'dark-theme' : 'light-theme');

    if (themeToggle) {
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
    }

    initializePasswordToggles();

    if (passwordInput) {
        updatePasswordStrengthUI(evaluatePasswordStrength(passwordInput.value));
        passwordInput.addEventListener('input', () => {
            const feedback = evaluatePasswordStrength(passwordInput.value);
            updatePasswordStrengthUI(feedback);
            updateConfirmHelper();
            errorMessage.textContent = '';
        });
    }

    if (confirmPasswordInput) {
        updateConfirmHelper();
        confirmPasswordInput.addEventListener('input', () => {
            updateConfirmHelper();
            errorMessage.textContent = '';
        });
    }

    // Signup functionality
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = signupForm.querySelector('input[type="text"]').value.trim();
        const email = signupForm.querySelector('input[type="email"]').value.trim();
        const normalizedEmail = normalizeEmail(email);
        const password = passwordInput ? passwordInput.value : '';
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

        const strengthFeedback = evaluatePasswordStrength(password);

        if (!strengthFeedback.meetsMinimumRequirements) {
            errorMessage.textContent = strengthFeedback.feedbackMessage;
            if (passwordInput) {
                passwordInput.focus();
            }
            return;
        }

        if (password !== confirmPassword) {
            errorMessage.textContent = "Passwords do not match.";
            if (confirmPasswordInput) {
                confirmPasswordInput.focus();
            }
            return;
        }

        try {
            const response = await signupUser(username, email, normalizedEmail, password);
            if (response.success) {
                showModal('Sign Up Successful!', 'Please log in with your new account.', { redirectTo: 'login.html' });
            } else {
                errorMessage.textContent = response.message || 'Sign up failed. Please try again.';
            }
        } catch (error) {
            console.error('Sign up error:', error);
            errorMessage.textContent = 'An error occurred. Please try again later.';
        }
    });

    function updateThemeToggle(theme) {
        if (!themeToggle) {
            return;
        }

        const icon = themeToggle.querySelector('i');
        if (!icon) {
            return;
        }
        if (theme === 'dark') {
            icon.classList.replace('fa-moon', 'fa-sun');
        } else {
            icon.classList.replace('fa-sun', 'fa-moon');
        }
    }

    function initializePasswordToggles() {
        const toggleButtons = document.querySelectorAll('.password-toggle');
        toggleButtons.forEach((button) => {
            button.setAttribute('aria-pressed', 'false');
            button.addEventListener('click', () => {
                const targetId = button.getAttribute('data-target');
                const targetInput = targetId ? document.getElementById(targetId) : null;

                if (!targetInput) {
                    return;
                }

                const isPasswordHidden = targetInput.type === 'password';
                targetInput.type = isPasswordHidden ? 'text' : 'password';
                button.setAttribute('aria-pressed', String(isPasswordHidden));
                button.setAttribute('aria-label', isPasswordHidden ? 'Hide password' : 'Show password');

                const icon = button.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-eye', !isPasswordHidden);
                    icon.classList.toggle('fa-eye-slash', isPasswordHidden);
                }
            });
        });
    }

    function evaluatePasswordStrength(password) {
        const varietyChecks = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];
        const varietyCount = varietyChecks.reduce((count, regex) => (regex.test(password) ? count + 1 : count), 0);

        let score = 0;
        if (password.length >= 8) {
            score += 1;
        }
        if (password.length >= 10) {
            score += 1;
        }
        if (varietyCount >= 2) {
            score += 1;
        }
        if (varietyCount >= 4 || password.length >= 14) {
            score += 1;
        }

        const meetsMinimumRequirements = password.length >= 10 && varietyCount >= 3;

        const strengthLevels = [
            {
                label: 'Too weak',
                color: '#ff4d4d',
                helper: 'Use at least 10 characters with uppercase, lowercase, number, and symbol.'
            },
            {
                label: 'Needs improvement',
                color: '#ff944d',
                helper: 'Add uppercase letters, numbers, or symbols to strengthen it.'
            },
            {
                label: 'Almost there',
                color: '#f1c40f',
                helper: 'Consider adding more characters for extra security.'
            },
            {
                label: 'Strong password',
                color: '#2ecc71',
                helper: 'Looking good! Mix in a few more characters if possible.'
            },
            {
                label: 'Excellent password',
                color: '#27ae60',
                helper: 'Your password meets all recommendations.'
            }
        ];

        const levelIndex = Math.min(score, strengthLevels.length - 1);
        const level = strengthLevels[levelIndex];

        return {
            score,
            varietyCount,
            meetsMinimumRequirements,
            level,
            feedbackMessage: meetsMinimumRequirements
                ? ''
                : 'Password must be at least 10 characters and include uppercase, lowercase, number, and symbol.'
        };
    }

    function updatePasswordStrengthUI(feedback) {
        if (!strengthIndicator || !strengthBar || !strengthText || !passwordHelperText) {
            return;
        }

        const { score, level, meetsMinimumRequirements } = feedback;
        const progressValue = Math.min(100, Math.max(0, (score / 4) * 100));

        strengthIndicator.style.width = `${progressValue}%`;
        strengthIndicator.style.backgroundColor = level.color;
        strengthBar.setAttribute('aria-valuenow', String(score));
        strengthText.textContent = level.label;
        passwordHelperText.textContent = level.helper;

        if (!passwordInput) {
            return;
        }

        passwordHelperText.classList.toggle('is-invalid', !meetsMinimumRequirements && passwordInput.value.length > 0);
        passwordHelperText.classList.toggle('is-valid', meetsMinimumRequirements && passwordInput.value.length > 0);
    }

    function updateConfirmHelper() {
        if (!confirmHelperText || !confirmPasswordInput) {
            return;
        }

        const hasValue = confirmPasswordInput.value.length > 0;
        const matches = confirmPasswordInput.value === (passwordInput ? passwordInput.value : '');

        confirmHelperText.textContent = '';
        confirmHelperText.classList.remove('is-invalid', 'is-valid');

        if (!hasValue) {
            return;
        }

        if (matches) {
            confirmHelperText.textContent = 'Passwords match.';
            confirmHelperText.classList.add('is-valid');
        } else {
            confirmHelperText.textContent = 'Passwords do not match yet.';
            confirmHelperText.classList.add('is-invalid');
        }
    }
});

function normalizeEmail(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function loadUsersWithNormalization() {
    const storedUsers = JSON.parse(localStorage.getItem('users')) || [];
    let requiresUpdate = false;

    const normalizedUsers = storedUsers.map((user) => {
        if (!user || typeof user !== 'object') {
            return user;
        }

        const displayEmail = typeof user.email === 'string' ? user.email.trim() : user.email;
        const normalizedEmail = normalizeEmail(user.normalizedEmail || user.email || '');
        const needsUpdate = user.email !== displayEmail || user.normalizedEmail !== normalizedEmail;

        if (needsUpdate) {
            requiresUpdate = true;
            return {
                ...user,
                email: displayEmail,
                normalizedEmail
            };
        }

        return user;
    });

    if (requiresUpdate) {
        localStorage.setItem('users', JSON.stringify(normalizedUsers));
    }

    return normalizedUsers;
}

function showModal(title, message, options = {}) {
    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('signup-modal-title');
    const modalMessage = document.getElementById('signup-modal-message');

    if (modalTitle) {
        modalTitle.textContent = title;
    }

    if (modalMessage) {
        modalMessage.textContent = message;
    }

    if (signupModalController) {
        signupModalController.open({
            initialFocus: '#modal-ok-btn',
            context: {
                redirectTo: options.redirectTo || null,
                onClose: typeof options.onClose === 'function' ? options.onClose : null
            }
        });
    } else if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function signupUser(username, email, normalizedEmail, password) {
    return new Promise((resolve) => {
        setTimeout(async () => {
            try {
                let users = loadUsersWithNormalization();
                const resolvedNormalizedEmail = normalizedEmail || normalizeEmail(email);
                const displayEmail = typeof email === 'string' ? email.trim() : '';
                const existingUser = users.find((user) => {
                    const userNormalized = user ? user.normalizedEmail || normalizeEmail(user.email || '') : '';
                    return userNormalized === resolvedNormalizedEmail;
                });

                if (existingUser) {
                    resolve({
                        success: false,
                        message: 'Email already in use.'
                    });
                    return;
                }

                const timestamp = new Date().toISOString();
                const passwordCredential = await hashPassword(password);
                const newUser = {
                    username,
                    email: displayEmail,
                    normalizedEmail: resolvedNormalizedEmail,
                    password: passwordCredential,
                    passwordVersion: passwordCredential.version,
                    passwordUpdatedAt: timestamp,
                    forcePasswordReset: false,
                    registrationDate: timestamp,
                    lastActive: timestamp
                };
                users.push(newUser);
                localStorage.setItem('users', JSON.stringify(users));
                resolve({
                    success: true,
                    message: 'Sign up successful'
                });
            } catch (error) {
                console.error('Failed to create account securely:', error);
                resolve({
                    success: false,
                    message: 'Unable to create account securely. Please try again later.'
                });
            }
        }, 1000); // Simulate network delay
    });
}

const PASSWORD_HASH_VERSION = 'pbkdf2-v1';
const PBKDF2_ITERATIONS = 150000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_KEY_BYTES = 32;

async function hashPassword(password, saltBase64 = null) {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error('Secure password hashing is not supported in this environment.');
    }

    const encoder = new TextEncoder();
    const saltBytes = saltBase64 ? base64ToBuffer(saltBase64) : window.crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    const derivedBits = await window.crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        keyMaterial,
        PBKDF2_KEY_BYTES * 8
    );

    const hashArray = new Uint8Array(derivedBits);
    return {
        version: PASSWORD_HASH_VERSION,
        salt: bufferToBase64(saltBytes),
        hash: bufferToBase64(hashArray)
    };
}

function bufferToBase64(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function generateToken(email) {
    return btoa(email + ':' + new Date().getTime());
}
