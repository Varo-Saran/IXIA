let loginMessageModalController = null;
let loginRecoveryModalController = null;

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

function findUserIndexByEmail(users, email) {
    const normalizedTarget = normalizeEmail(email);
    return users.findIndex((user) => normalizeEmail(user.normalizedEmail || user.email || '') === normalizedTarget);
}

// Add this function at the beginning of your login.js file
async function initializeAdminUser() {
    const users = loadUsersWithNormalization();
    const adminExists = users.some(user => user.isAdmin);

    if (!adminExists) {
        const timestamp = new Date().toISOString();

        let passwordCredential = null;
        let passwordVersion = null;

        try {
            passwordCredential = await hashPassword('adminpassword');
            passwordVersion = passwordCredential.version;
        } catch (error) {
            console.warn('Falling back to legacy admin credential due to limited crypto support:', error);
            passwordCredential = btoa('adminpassword');
            passwordVersion = 'legacy';
        }

        const adminEmail = 'admin@ixiaai.com';
        const adminUser = {
            username: 'admin',
            email: adminEmail,
            normalizedEmail: normalizeEmail(adminEmail),
            password: passwordCredential,
            passwordVersion,
            passwordUpdatedAt: timestamp,
            forcePasswordReset: true,
            isAdmin: true,
            registrationDate: timestamp,
            lastActive: timestamp
        };
        const updatedUsers = [...users, adminUser];
        localStorage.setItem('users', JSON.stringify(updatedUsers));
        console.log('Admin user created');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeAdminUser().catch(error => console.error('Admin initialization error:', error));
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const customModal = document.getElementById('custom-modal');
    const modalOkBtn = document.getElementById('modal-ok-btn');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const recoveryModal = document.getElementById('password-recovery-modal');
    const recoveryCloseBtn = document.getElementById('recovery-close-btn');
    const recoveryForm = document.getElementById('password-recovery-form');
    const resetForm = document.getElementById('password-reset-form');
    const recoveryEmailInput = document.getElementById('recovery-email');
    const recoveryMessage = document.getElementById('recovery-message');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const recoveryDescription = document.getElementById('recovery-description');
    const initialRecoveryDescription = recoveryDescription ? recoveryDescription.textContent : '';
    const resetPasswordHelper = document.getElementById('reset-password-helper');
    const resetConfirmHelper = document.getElementById('reset-confirm-helper');
    const heroIllustrationContainer = document.querySelector('.auth-hero-illustration');

    if (customModal) {
        loginMessageModalController = ModalController.create(customModal, {
            closeSelectors: ['.modal-overlay', '.modal-close', '[data-close-modal]'],
            initialFocus: '#modal-ok-btn',
            hooks: {
                afterClose({ context, reason }) {
                    if (context && typeof context.onClose === 'function') {
                        context.onClose(reason);
                    }
                }
            }
        });
    }

    if (loginMessageModalController && modalOkBtn) {
        modalOkBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            loginMessageModalController.close({ reason: 'confirm' });
        });
    }

    if (recoveryModal) {
        loginRecoveryModalController = ModalController.create(recoveryModal, {
            closeSelectors: ['.modal-overlay', '.modal-close', '[data-close-modal]'],
            initialFocus: '#recovery-email',
            hooks: {
                afterClose() {
                    resetRecoveryDialog();
                }
            }
        });
    }

    // Theme toggle functionality (unchanged)
    const currentTheme = localStorage.getItem('theme') || 'light';
    body.classList.add(currentTheme === 'dark' ? 'dark-theme' : 'light-theme');
    updateHeroIllustration(currentTheme);

    if (themeToggle) {
        updateThemeToggle(currentTheme);

        themeToggle.addEventListener('click', () => {
            if (body.classList.contains('dark-theme')) {
                body.classList.replace('dark-theme', 'light-theme');
                localStorage.setItem('theme', 'light');
                updateThemeToggle('light');
                updateHeroIllustration('light');
            } else {
                body.classList.replace('light-theme', 'dark-theme');
                localStorage.setItem('theme', 'dark');
                updateThemeToggle('dark');
                updateHeroIllustration('dark');
            }
        });
    }

    initializePasswordToggles();

    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', () => {
            updateResetPasswordHelper();
            updateResetConfirmHelper();
        });
        updateResetPasswordHelper();
    }

    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', updateResetConfirmHelper);
    }

    if (forgotPasswordLink && loginRecoveryModalController && recoveryEmailInput) {
        forgotPasswordLink.addEventListener('click', () => {
            resetRecoveryDialog();
            loginRecoveryModalController.open({
                initialFocus: '#recovery-email'
            });
        });
    }

    if (recoveryCloseBtn && loginRecoveryModalController) {
        recoveryCloseBtn.addEventListener('click', () => {
            loginRecoveryModalController.close({ reason: 'cancel' });
        });
    }

    if (recoveryForm && recoveryEmailInput) {
        recoveryForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const email = recoveryEmailInput.value.trim();
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailPattern.test(email)) {
                setRecoveryMessage('Please enter a valid email address.', 'error');
                recoveryEmailInput.focus();
                return;
            }

            try {
                const normalizedEmail = normalizeEmail(email);
                const users = loadUsersWithNormalization();
                const userIndex = users.findIndex(user => (user.normalizedEmail || normalizeEmail(user.email || '')) === normalizedEmail);

                if (userIndex === -1) {
                    setRecoveryMessage('We couldn’t find an account with that email. Double-check and try again.', 'error');
                    return;
                }

                users[userIndex].forcePasswordReset = true;
                localStorage.setItem('users', JSON.stringify(users));

                const storedEmail = users[userIndex].email;
                const storedNormalizedEmail = users[userIndex].normalizedEmail;
                setRecoveryMessage('We found your account. Set a new password below to regain access.', 'success');
                showResetStep(storedEmail, storedNormalizedEmail);
            } catch (error) {
                console.error('Password recovery lookup failed:', error);
                setRecoveryMessage('We couldn’t start the recovery process. Please try again.', 'error');
            }
        });
    }

    if (resetForm && newPasswordInput && confirmPasswordInput) {
        resetForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (!recoveryModal || !recoveryModal.dataset.email) {
                setRecoveryMessage('Please restart the recovery process.', 'error');
                resetRecoveryDialog();
                return;
            }

            const newPassword = newPasswordInput.value.trim();
            const confirmPassword = confirmPasswordInput.value.trim();

            if (!passwordMeetsMinimumRequirements(newPassword)) {
                setRecoveryMessage('Passwords must be at least 10 characters and include uppercase, lowercase, number, and symbol.', 'error');
                updateResetPasswordHelper();
                newPasswordInput.focus();
                return;
            }

            if (newPassword !== confirmPassword) {
                setRecoveryMessage('Your passwords do not match. Please try again.', 'error');
                updateResetConfirmHelper();
                confirmPasswordInput.focus();
                return;
            }

            setRecoveryMessage('Updating your password...', 'info');

            try {
                const users = loadUsersWithNormalization();
                const targetEmail = recoveryModal.dataset.normalizedEmail
                    || normalizeEmail(recoveryModal.dataset.email || '');
                const userIndex = users.findIndex(user => (user.normalizedEmail || normalizeEmail(user.email || '')) === targetEmail);

                if (userIndex === -1) {
                    setRecoveryMessage('We couldn’t locate your account. Please restart recovery.', 'error');
                    resetRecoveryDialog();
                    return;
                }

                const hashedPassword = await hashPassword(newPassword);
                const timestamp = new Date().toISOString();

                users[userIndex] = {
                    ...users[userIndex],
                    password: hashedPassword,
                    passwordVersion: hashedPassword.version,
                    passwordUpdatedAt: timestamp,
                    forcePasswordReset: false
                };

                localStorage.setItem('users', JSON.stringify(users));
                setRecoveryMessage('Your password has been updated. You can now log in with your new credentials.', 'success');
                resetForm.reset();
                delete recoveryModal.dataset.email;

                if (recoveryDescription) {
                    recoveryDescription.textContent = 'All set! Use the close button to return to the login form.';
                }

                if (recoveryCloseBtn) {
                    recoveryCloseBtn.focus();
                }
            } catch (error) {
                console.error('Password reset error:', error);
                setRecoveryMessage('We couldn’t update your password. Please try again.', 'error');
            }
        });
    }

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

    function updateHeroIllustration(theme) {
        if (!heroIllustrationContainer) {
            return;
        }

        const lightImage = heroIllustrationContainer.querySelector('.hero-illustration--light');
        const darkImage = heroIllustrationContainer.querySelector('.hero-illustration--dark');

        if (lightImage) {
            const lightSource = lightImage.getAttribute('data-src');
            if (theme === 'dark') {
                lightImage.removeAttribute('src');
            } else if (lightSource && lightImage.getAttribute('src') !== lightSource) {
                lightImage.setAttribute('src', lightSource);
            }
        }

        if (darkImage) {
            const darkSource = darkImage.getAttribute('data-src');
            if (theme === 'dark') {
                if (darkSource && darkImage.getAttribute('src') !== darkSource) {
                    darkImage.setAttribute('src', darkSource);
                }
            } else {
                darkImage.removeAttribute('src');
            }
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

    function passwordMeetsMinimumRequirements(password) {
        const varietyChecks = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];
        const varietyCount = varietyChecks.reduce((count, regex) => (regex.test(password) ? count + 1 : count), 0);
        return password.length >= 10 && varietyCount >= 3;
    }

    function updateResetPasswordHelper() {
        if (!resetPasswordHelper || !newPasswordInput) {
            return;
        }

        const passwordValue = newPasswordInput.value.trim();
        const meetsRequirements = passwordMeetsMinimumRequirements(passwordValue);

        resetPasswordHelper.classList.remove('is-invalid', 'is-valid');

        if (passwordValue.length === 0) {
            resetPasswordHelper.textContent = 'Use at least 10 characters with a mix of letters, numbers, and symbols.';
            return;
        }

        if (meetsRequirements) {
            resetPasswordHelper.textContent = 'Great! This password meets the security guidelines.';
            resetPasswordHelper.classList.add('is-valid');
        } else {
            resetPasswordHelper.textContent = 'Password must include uppercase, lowercase, number, and symbol, and be at least 10 characters.';
            resetPasswordHelper.classList.add('is-invalid');
        }
    }

    function updateResetConfirmHelper() {
        if (!resetConfirmHelper || !confirmPasswordInput || !newPasswordInput) {
            return;
        }

        const confirmValue = confirmPasswordInput.value.trim();
        const matches = confirmValue.length > 0 && confirmValue === newPasswordInput.value.trim();

        resetConfirmHelper.textContent = '';
        resetConfirmHelper.classList.remove('is-invalid', 'is-valid');

        if (confirmValue.length === 0) {
            return;
        }

        if (matches) {
            resetConfirmHelper.textContent = 'Passwords match.';
            resetConfirmHelper.classList.add('is-valid');
        } else {
            resetConfirmHelper.textContent = 'Passwords do not match yet.';
            resetConfirmHelper.classList.add('is-invalid');
        }
    }

    function setRecoveryMessage(message, type = 'info') {
        if (!recoveryMessage) {
            return;
        }

        recoveryMessage.textContent = message;
        recoveryMessage.classList.remove('success', 'error', 'info');
        recoveryMessage.classList.add(type);
    }

    function resetRecoveryDialog() {
        if (recoveryForm) {
            recoveryForm.hidden = false;
            recoveryForm.reset();
        }

        if (resetForm) {
            resetForm.hidden = true;
            resetForm.reset();
        }

        if (recoveryMessage) {
            recoveryMessage.textContent = '';
            recoveryMessage.classList.remove('success', 'error', 'info');
        }

        if (recoveryModal && recoveryModal.dataset) {
            delete recoveryModal.dataset.email;
            delete recoveryModal.dataset.normalizedEmail;
        }

        if (recoveryDescription) {
            recoveryDescription.textContent = initialRecoveryDescription;
        }
    }

    function showResetStep(email, normalizedEmail) {
        if (recoveryModal && recoveryModal.dataset) {
            recoveryModal.dataset.email = email || '';
            recoveryModal.dataset.normalizedEmail = normalizedEmail || normalizeEmail(email || '');
        }

        if (recoveryForm) {
            recoveryForm.hidden = true;
        }

        if (resetForm) {
            resetForm.hidden = false;
        }

        if (recoveryDescription) {
            recoveryDescription.textContent = 'Create a new password to secure your account.';
        }

        if (newPasswordInput) {
            newPasswordInput.focus();
        }
    }

    // Login functionality
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailInput = loginForm.querySelector('input[type="email"]');
        const passwordInput = loginForm.querySelector('input[type="password"]');
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        try {
            const response = await loginUser(email, password);
            if (response.success) {
                localStorage.setItem('userToken', response.token);
                localStorage.setItem('currentUser', JSON.stringify(response.user));

                if (response.user.isAdmin) {
                    if (response.forcePasswordReset) {
                        localStorage.setItem('adminPasswordResetRequired', 'true');
                        showModal('Admin Password Update Required', 'Please reset your password to continue to the admin dashboard.');
                    } else {
                        localStorage.removeItem('adminPasswordResetRequired');
                        showModal('Admin Login Successful!', 'Redirecting to admin dashboard...');
                    }

                    setTimeout(() => {
                        window.location.href = 'admin.html';
                    }, 2000);
                } else if (response.forcePasswordReset) {
                    showModal('Password Update Required', 'We\'ve enhanced account security. Please reset your password now.');
                    setTimeout(() => {
                        window.location.href = 'account.html';
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

});

function showModal(title, message, options = {}) {
    const modalElement = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');

    if (modalTitle) {
        modalTitle.textContent = title;
    }

    if (modalMessage) {
        modalMessage.textContent = message;
    }

    if (loginMessageModalController) {
        loginMessageModalController.open({
            initialFocus: '#modal-ok-btn',
            context: {
                onClose: typeof options.onClose === 'function' ? options.onClose : null
            }
        });
    } else if (modalElement) {
        modalElement.style.display = 'flex';
        modalElement.classList.add('is-open');
        modalElement.setAttribute('aria-hidden', 'false');
    }
}

function loginUser(email, password) {
    return new Promise((resolve) => {
        setTimeout(async () => {
            try {
                const normalizedEmail = normalizeEmail(email);
                let users = loadUsersWithNormalization();
                const userIndex = users.findIndex(u => (u.normalizedEmail || normalizeEmail(u.email || '')) === normalizedEmail);

                if (userIndex === -1) {
                    resolve({
                        success: false,
                        message: 'Invalid email or password'
                    });
                    return;
                }

                const user = users[userIndex];
                const verification = await verifyPassword(user.password, password);

                if (!verification.verified) {
                    resolve({
                        success: false,
                        message: 'Invalid email or password'
                    });
                    return;
                }

                const lastActiveTimestamp = new Date().toISOString();
                const requiresPasswordReset = verification.migratedCredential
                    ? true
                    : verification.isLegacy
                        ? true
                        : Boolean(user.forcePasswordReset);

                if (verification.migratedCredential) {
                    users[userIndex].password = verification.migratedCredential;
                    users[userIndex].passwordVersion = verification.migratedCredential.version;
                    users[userIndex].passwordUpdatedAt = lastActiveTimestamp;
                }

                users[userIndex] = {
                    ...users[userIndex],
                    lastActive: lastActiveTimestamp,
                    forcePasswordReset: requiresPasswordReset
                };

                localStorage.setItem('users', JSON.stringify(users));

                const sanitizedUser = {
                    username: users[userIndex].username,
                    email: users[userIndex].email,
                    normalizedEmail: users[userIndex].normalizedEmail,
                    isAdmin: Boolean(users[userIndex].isAdmin),
                    registrationDate: users[userIndex].registrationDate,
                    lastActive: users[userIndex].lastActive,
                    forcePasswordReset: Boolean(users[userIndex].forcePasswordReset),
                    language: users[userIndex].language,
                    notifications: Boolean(users[userIndex].notifications),
                    profilePicture: users[userIndex].profilePicture || null
                };

                const token = generateToken(normalizedEmail);
                resolve({
                    success: true,
                    token: token,
                    user: sanitizedUser,
                    message: sanitizedUser.forcePasswordReset ? 'Login successful - password reset required' : 'Login successful',
                    forcePasswordReset: sanitizedUser.forcePasswordReset
                });
            } catch (error) {
                console.error('Login processing error:', error);
                resolve({
                    success: false,
                    message: 'An unexpected error occurred. Please try again.'
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

async function verifyPassword(storedPassword, password) {
    if (!storedPassword) {
        return { verified: false, migratedCredential: null, isLegacy: false };
    }

    if (typeof storedPassword === 'string') {
        const legacyMatch = storedPassword === btoa(password);
        let migratedCredential = null;

        if (legacyMatch) {
            try {
                migratedCredential = await hashPassword(password);
            } catch (error) {
                console.warn('Unable to migrate legacy password securely:', error);
            }
        }

        return {
            verified: legacyMatch,
            migratedCredential,
            isLegacy: true
        };
    }

    if (storedPassword.version === PASSWORD_HASH_VERSION && storedPassword.hash && storedPassword.salt) {
        const derived = await hashPassword(password, storedPassword.salt);
        return {
            verified: storedPassword.hash === derived.hash,
            migratedCredential: null,
            isLegacy: false
        };
    }

    return { verified: false, migratedCredential: null, isLegacy: false };
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
