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

document.addEventListener('DOMContentLoaded', () => {
    let currentUser = JSON.parse(localStorage.getItem('currentUser'));

    if (currentUser && typeof currentUser === 'object') {
        const displayEmail = typeof currentUser.email === 'string' ? currentUser.email.trim() : currentUser.email;
        const normalizedEmail = currentUser.normalizedEmail || normalizeEmail(displayEmail || '');
        if (currentUser.email !== displayEmail || currentUser.normalizedEmail !== normalizedEmail) {
            currentUser = { ...currentUser, email: displayEmail, normalizedEmail };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }
    }

    if (currentUser?.isAdmin) {
        if (currentUser.forcePasswordReset) {
            const updatedAdminUser = { ...currentUser, forcePasswordReset: false };
            localStorage.setItem('currentUser', JSON.stringify(updatedAdminUser));
        }
        window.location.href = 'admin.html';
        return;
    }

    const profileForm = document.getElementById('profile-form');
    const passwordForm = document.getElementById('password-form');
    const preferencesForm = document.getElementById('preferences-form');
    const deleteAccountBtn = document.getElementById('delete-account');
    const changePictureBtn = document.getElementById('change-picture');
    const removePictureBtn = document.getElementById('remove-picture');
    const pictureUpload = document.getElementById('picture-upload');
    const profileImage = document.getElementById('profile-image');
    const cropModal = document.getElementById('picture-crop-modal');
    const cropCanvas = document.getElementById('crop-canvas');
    const cropContext = cropCanvas ? cropCanvas.getContext('2d') : null;
    const cropPreview = document.getElementById('crop-preview');
    const cropZoom = document.getElementById('crop-zoom');
    const cropConfirm = document.getElementById('crop-confirm');
    const cropCancel = document.getElementById('crop-cancel');
    const cropCloseBtn = document.getElementById('crop-close-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalCancel = document.getElementById('modal-cancel');
    const DEFAULT_PROFILE_ICON_LIGHT = 'assets/images/default-profile-icon-light.png';
    const DEFAULT_PROFILE_ICON_DARK = 'assets/images/default-profile-icon-dark.png';

    function getDefaultProfileIcon(theme) {
        return theme === 'dark' ? DEFAULT_PROFILE_ICON_DARK : DEFAULT_PROFILE_ICON_LIGHT;
    }

    function getCurrentTheme() {
        return document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    }

    let cropState = null;
    let isDragging = false;
    let lastPointerPosition = null;
    let activePointerId = null;

    function setAvatarSources(profilePicture, defaultIcon) {
        const source = profilePicture || defaultIcon;

        if (profileImage) {
            profileImage.src = source;
        }

        if (cropPreview && !cropState) {
            cropPreview.src = source;
        }
    }

    function applyTheme(theme) {
        const isDark = theme === 'dark';
        document.body.classList.toggle('dark-theme', isDark);

        const icon = themeToggle?.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-sun', isDark);
            icon.classList.toggle('fa-moon', !isDark);
        }

        const defaultIcon = getDefaultProfileIcon(theme);
        const currentUserData = JSON.parse(localStorage.getItem('currentUser')) || {};
        setAvatarSources(currentUserData.profilePicture, defaultIcon);
    }

    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
        applyTheme(savedTheme);
    }

    let cropModalController = null;
    let confirmationModalController = null;

    if (cropModal) {
        cropModalController = ModalController.create(cropModal, {
            closeSelectors: ['.modal-overlay', '#crop-cancel', '#crop-close-btn'],
            initialFocus: '#crop-cancel',
            hooks: {
                beforeOpen() {
                    cropModal.hidden = false;
                },
                afterOpen() {
                    document.body.classList.add('modal-open');
                },
                afterClose({ context }) {
                    document.body.classList.remove('modal-open');
                    cropModal.hidden = true;
                    resetCropper();
                    if (context && context.resetInput) {
                        pictureUpload.value = '';
                    }
                },
                cropper({ stage }) {
                    if (stage === 'open') {
                        document.addEventListener('keydown', handleCropperKeydown);
                    } else if (stage === 'closed') {
                        document.removeEventListener('keydown', handleCropperKeydown);
                    }
                }
            }
        });
    }

    if (confirmationModal) {
        confirmationModalController = ModalController.create(confirmationModal, {
            closeSelectors: ['.modal-overlay', '#confirmation-close-btn', '#modal-cancel'],
            initialFocus: '#modal-confirm',
            hooks: {
                beforeOpen({ context }) {
                    if (context && typeof context.setupContent === 'function') {
                        context.setupContent();
                    }
                },
                afterClose({ reason, context }) {
                    if (!context) {
                        return;
                    }
                    if (reason === 'confirm') {
                        if (typeof context.onConfirm === 'function') {
                            context.onConfirm();
                        }
                    } else if (typeof context.onCancel === 'function') {
                        context.onCancel(reason);
                    }
                }
            }
        });
    }

    if (confirmationModalController && modalConfirm) {
        modalConfirm.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            confirmationModalController.close({ reason: 'confirm' });
        });
    }

    initializeTheme();

    // Load user data
    loadUserData();

    // Event listeners
    profileForm.addEventListener('submit', updateProfile);
    passwordForm.addEventListener('submit', changePassword);
    preferencesForm.addEventListener('submit', savePreferences);
    deleteAccountBtn.addEventListener('click', confirmDeleteAccount);
    changePictureBtn.addEventListener('click', () => pictureUpload.click());
    removePictureBtn.addEventListener('click', removePicture);
    pictureUpload.addEventListener('change', handlePictureSelection);
    themeToggle.addEventListener('click', toggleTheme);

    if (cropZoom) {
        cropZoom.addEventListener('input', handleZoomChange);
    }

    if (cropCanvas) {
        cropCanvas.addEventListener('pointerdown', handleCanvasPointerDown);
        cropCanvas.addEventListener('pointermove', handleCanvasPointerMove);
        cropCanvas.addEventListener('pointerup', handleCanvasPointerUp);
        cropCanvas.addEventListener('pointerleave', handleCanvasPointerUp);
        cropCanvas.addEventListener('pointercancel', handleCanvasPointerUp);
    }

    if (cropConfirm) {
        cropConfirm.addEventListener('click', saveCroppedImage);
    }

    if (cropCancel) {
        cropCancel.addEventListener('click', (event) => {
            event.preventDefault();
            closeCropModal({ resetInput: true });
        });
    }

    if (cropCloseBtn) {
        cropCloseBtn.addEventListener('click', (event) => {
            event.preventDefault();
            closeCropModal({ resetInput: true });
        });
    }

    function loadUserData() {
        // Simulate loading user data from server
        const userData = JSON.parse(localStorage.getItem('currentUser')) || {};
        document.getElementById('username').value = userData.username || '';
        document.getElementById('email').value = userData.email || '';
        document.getElementById('language').value = userData.language || 'en';
        document.getElementById('notifications').checked = userData.notifications || false;

        if (userData.forcePasswordReset) {
            showNotification('For security, please update your password to complete the recent upgrade.', 'info');
        }
        
        const defaultIcon = getDefaultProfileIcon(getCurrentTheme());
        setAvatarSources(userData.profilePicture, defaultIcon);
    }

    function updateProfile(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const rawEmail = document.getElementById('email').value;
        const trimmedEmail = rawEmail.trim();
        const normalizedEmail = normalizeEmail(trimmedEmail);

        // Simulate API call to update profile
        const storedCurrentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
        const previousEmail = storedCurrentUser.email;
        const previousEmailNormalized = storedCurrentUser.normalizedEmail || normalizeEmail(previousEmail || '');

        const users = loadUsersWithNormalization();
        const emailChanged = normalizedEmail !== previousEmailNormalized;
        const emailInUse = users.some(user => {
            const userEmailNormalized = user ? user.normalizedEmail || normalizeEmail(user.email || '') : '';
            return userEmailNormalized === normalizedEmail && userEmailNormalized !== previousEmailNormalized;
        });

        if (emailInUse) {
            showNotification('That email address is already associated with another account.', 'error');
            return;
        }

        const updates = { username, email: trimmedEmail, normalizedEmail };

        const persistedUser = updateStoredUser(previousEmail || previousEmailNormalized, updates);

        if (!persistedUser) {
            showNotification('Unable to update profile. Please try again.', 'error');
            return;
        }

        if (emailChanged && previousEmail) {
            migrateChatDataForEmailChange(previousEmail, normalizedEmail);
        }

        currentUser = { ...storedCurrentUser, ...updates };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        if (emailChanged) {
            showNotification('Profile updated successfully! Reloading to sync your chats...');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification('Profile updated successfully!');
        }
    }

    function migrateChatDataForEmailChange(oldEmail, newEmail) {
        if (!oldEmail || !newEmail || oldEmail === newEmail) {
            return;
        }

        const oldChatsKey = `chats_${oldEmail}`;
        const newChatsKey = `chats_${newEmail}`;
        const oldCurrentChatKey = `currentChatId_${oldEmail}`;
        const newCurrentChatKey = `currentChatId_${newEmail}`;

        const chatsData = localStorage.getItem(oldChatsKey);
        const currentChatId = localStorage.getItem(oldCurrentChatKey);

        if (chatsData !== null) {
            localStorage.setItem(newChatsKey, chatsData);
        }

        if (currentChatId !== null) {
            localStorage.setItem(newCurrentChatKey, currentChatId);
        }

        if (oldChatsKey !== newChatsKey) {
            localStorage.removeItem(oldChatsKey);
        }

        if (oldCurrentChatKey !== newCurrentChatKey) {
            localStorage.removeItem(oldCurrentChatKey);
        }
    }

    async function changePassword(e) {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            showNotification('New passwords do not match!', 'error');
            return;
        }
    
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) {
            showNotification('No user found.', 'error');
            return;
        }

        let users = loadUsersWithNormalization();
        const targetNormalizedEmail = currentUser.normalizedEmail || normalizeEmail(currentUser.email || '');
        const userIndex = users.findIndex(user => (user.normalizedEmail || normalizeEmail(user.email || '')) === targetNormalizedEmail);

        if (userIndex === -1) {
            showNotification('Current password is incorrect!', 'error');
            return;
        }

        try {
            const verification = await verifyPassword(users[userIndex].password, currentPassword);

            if (!verification.verified) {
                showNotification('Current password is incorrect!', 'error');
                return;
            }

            const passwordCredential = await hashPassword(newPassword);
            const timestamp = new Date().toISOString();
            users[userIndex] = {
                ...users[userIndex],
                password: passwordCredential,
                passwordVersion: passwordCredential.version,
                passwordUpdatedAt: timestamp,
                forcePasswordReset: false
            };
            localStorage.setItem('users', JSON.stringify(users));

            const updatedCurrentUser = {
                ...currentUser,
                forcePasswordReset: false
            };
            localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));

            showNotification('Password changed successfully!', 'success');
            passwordForm.reset();
        } catch (error) {
            console.error('Failed to change password securely:', error);
            showNotification('Unable to change password securely. Please try again.', 'error');
        }
    }
    

    function savePreferences(e) {
        e.preventDefault();
        const language = document.getElementById('language').value;
        const notifications = document.getElementById('notifications').checked;

        // Simulate API call to save preferences
        const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
        const updates = { language, notifications };

        const persistedUser = updateStoredUser(currentUser.normalizedEmail || currentUser.email, updates);

        if (!persistedUser) {
            showNotification('Unable to save preferences. Please try again.', 'error');
            return;
        }

        const updatedCurrentUser = { ...currentUser, ...updates };
        localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));

        showNotification('Preferences saved successfully!');
    }

    function confirmDeleteAccount() {
        showModal('Are you sure you want to delete your account? This action cannot be undone.', deleteAccount);
    }

    function deleteAccount() {
        // Get the current user's email
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        
        if (!currentUser) {
            showNotification('No user found to delete.', 'error');
            return;
        }
    
        // Retrieve the users list from localStorage
        let users = loadUsersWithNormalization();
        const normalizedTarget = currentUser.normalizedEmail || normalizeEmail(currentUser.email || '');

        // Filter out the current user from the users list
        users = users.filter(user => (user.normalizedEmail || normalizeEmail(user.email || '')) !== normalizedTarget);
    
        // Save the updated users list back to localStorage
        localStorage.setItem('users', JSON.stringify(users));
    
        // Remove the currentUser and userToken from localStorage
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userToken');
    
        // Show a success notification
        showNotification('Your account has been deleted. Redirecting to home page...', 'info');
    
        // Redirect to home page after a short delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    }
    

    function handlePictureSelection(event) {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            showNotification('Please select a valid image file.', 'error');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = ({ target }) => {
            if (!target?.result) {
                showNotification('Unable to read the selected file.', 'error');
                pictureUpload.value = '';
                return;
            }
            initializeCropper(target.result);
        };
        reader.onerror = () => {
            showNotification('Unable to read the selected file.', 'error');
            pictureUpload.value = '';
        };
        reader.readAsDataURL(file);
    }

    function initializeCropper(imageSrc) {
        if (!cropCanvas || !cropContext) {
            return;
        }

        const image = new Image();
        image.onload = () => {
            const canvasSize = cropCanvas.width;
            const minScale = Math.max(canvasSize / image.width, canvasSize / image.height);
            const maxScale = minScale * 4;

            cropState = {
                image,
                scale: minScale,
                minScale,
                maxScale,
                offsetX: 0,
                offsetY: 0
            };

            if (cropZoom) {
                cropZoom.min = minScale;
                cropZoom.max = maxScale;
                cropZoom.step = Math.max(minScale / 60, 0.01);
                cropZoom.value = minScale;
            }

            openCropModal();
            drawCrop();
        };

        image.onerror = () => {
            showNotification('Unable to load the selected image. Please try again.', 'error');
            pictureUpload.value = '';
        };

        image.src = imageSrc;
    }

    function openCropModal(options = {}) {
        if (cropModalController) {
            cropModalController.open({
                initialFocus: '#crop-cancel',
                context: {
                    resetInput: Boolean(options.resetInput)
                }
            });
            return;
        }

        if (!cropModal) {
            return;
        }

        cropModal.hidden = false;
        cropModal.classList.add('is-open');
        cropModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        document.addEventListener('keydown', handleCropperKeydown);
    }

    function closeCropModal(options = {}) {
        if (cropModalController) {
            const context = cropModalController.getContext();
            if (context) {
                context.resetInput = Boolean(options.resetInput);
            }
            cropModalController.close({ reason: options.reason || 'cancel' });
            return;
        }

        if (!cropModal) {
            return;
        }

        cropModal.classList.remove('is-open');
        cropModal.setAttribute('aria-hidden', 'true');
        cropModal.hidden = true;
        document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', handleCropperKeydown);
        resetCropper();

        if (options.resetInput) {
            pictureUpload.value = '';
        }
    }

    function resetCropper() {
        if (cropCanvas && cropContext) {
            cropContext.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
        }

        if (cropZoom) {
            cropZoom.value = cropZoom.defaultValue || 1;
            cropZoom.min = 1;
            cropZoom.max = 3;
            cropZoom.step = 0.01;
        }

        if (cropPreview) {
            cropPreview.src = profileImage.src;
        }

        if (activePointerId !== null && cropCanvas && cropCanvas.hasPointerCapture(activePointerId)) {
            cropCanvas.releasePointerCapture(activePointerId);
        }

        cropState = null;
        isDragging = false;
        lastPointerPosition = null;
        activePointerId = null;
    }

    function drawCrop() {
        if (!cropState || !cropCanvas || !cropContext) {
            return;
        }

        const { image, scale } = cropState;
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;

        clampOffsets(drawWidth, drawHeight);

        cropContext.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
        cropContext.save();
        cropContext.beginPath();
        cropContext.arc(cropCanvas.width / 2, cropCanvas.height / 2, cropCanvas.width / 2, 0, Math.PI * 2);
        cropContext.closePath();
        cropContext.clip();

        const drawX = (cropCanvas.width - drawWidth) / 2 + cropState.offsetX;
        const drawY = (cropCanvas.height - drawHeight) / 2 + cropState.offsetY;
        cropContext.drawImage(image, drawX, drawY, drawWidth, drawHeight);
        cropContext.restore();

        if (cropPreview) {
            cropPreview.src = cropCanvas.toDataURL('image/png');
        }
    }

    function clampOffsets(drawWidth, drawHeight) {
        if (!cropState || !cropCanvas) {
            return;
        }

        const maxOffsetX = Math.max(0, (drawWidth - cropCanvas.width) / 2);
        const maxOffsetY = Math.max(0, (drawHeight - cropCanvas.height) / 2);

        cropState.offsetX = Math.min(Math.max(cropState.offsetX, -maxOffsetX), maxOffsetX);
        cropState.offsetY = Math.min(Math.max(cropState.offsetY, -maxOffsetY), maxOffsetY);
    }

    function handleZoomChange(event) {
        if (!cropState) {
            return;
        }

        const newScale = Number(event.target.value);

        if (Number.isNaN(newScale)) {
            return;
        }

        cropState.scale = Math.min(Math.max(newScale, cropState.minScale), cropState.maxScale);
        drawCrop();
    }

    function handleCanvasPointerDown(event) {
        if (!cropState || !cropCanvas) {
            return;
        }

        isDragging = true;
        activePointerId = event.pointerId;
        lastPointerPosition = { x: event.clientX, y: event.clientY };
        cropCanvas.setPointerCapture(event.pointerId);
    }

    function handleCanvasPointerMove(event) {
        if (!isDragging || !cropState || !cropCanvas || event.pointerId !== activePointerId) {
            return;
        }

        const rect = cropCanvas.getBoundingClientRect();
        const scaleX = cropCanvas.width / rect.width;
        const scaleY = cropCanvas.height / rect.height;
        const deltaX = (event.clientX - lastPointerPosition.x) * scaleX;
        const deltaY = (event.clientY - lastPointerPosition.y) * scaleY;

        cropState.offsetX += deltaX;
        cropState.offsetY += deltaY;
        lastPointerPosition = { x: event.clientX, y: event.clientY };

        drawCrop();
    }

    function handleCanvasPointerUp(event) {
        if (cropCanvas && event.pointerId === activePointerId && cropCanvas.hasPointerCapture(event.pointerId)) {
            cropCanvas.releasePointerCapture(event.pointerId);
        }

        isDragging = false;
        activePointerId = null;
        lastPointerPosition = null;
    }

    function handleCropperKeydown(event) {
        if (event.key !== 'Escape') {
            return;
        }

        if (cropModalController?.isOpen()) {
            event.preventDefault();
            const context = cropModalController.getContext();
            if (context) {
                context.resetInput = true;
            }
            cropModalController.close({ reason: 'cancel' });
            return;
        }

        if (cropModal && cropModal.classList.contains('is-open')) {
            event.preventDefault();
            closeCropModal({ resetInput: true });
        }
    }

    function saveCroppedImage() {
        if (!cropState || !cropCanvas) {
            closeCropModal({ resetInput: true });
            return;
        }

        const croppedDataUrl = cropCanvas.toDataURL('image/png');
        const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};

        if (!currentUser.email) {
            showNotification('Unable to update profile picture. Please try again.', 'error');
            return;
        }

        const persistedUser = updateStoredUser(currentUser.normalizedEmail || currentUser.email, { profilePicture: croppedDataUrl });

        if (!persistedUser) {
            showNotification('Unable to update profile picture. Please try again.', 'error');
            return;
        }

        const updatedCurrentUser = { ...currentUser, profilePicture: croppedDataUrl };
        localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));
        profileImage.src = croppedDataUrl;

        if (cropPreview) {
            cropPreview.src = croppedDataUrl;
        }

        showNotification('Profile picture updated successfully!');
        closeCropModal({ resetInput: true });
    }

    function removePicture() {
        const defaultIcon = getDefaultProfileIcon(getCurrentTheme());
        setAvatarSources(null, defaultIcon);

        const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
        const persistedUser = updateStoredUser(currentUser.normalizedEmail || currentUser.email, {}, { removeFields: ['profilePicture'] });

        if (!persistedUser) {
            setAvatarSources(currentUser.profilePicture, defaultIcon);
            showNotification('Unable to remove profile picture. Please try again.', 'error');
            return;
        }

        const updatedCurrentUser = { ...currentUser };
        delete updatedCurrentUser.profilePicture;
        localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));
        showNotification('Profile picture removed successfully!');
    }

    function toggleTheme() {
        const newTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    }

    function showModal(message, onConfirm) {
        if (confirmationModalController) {
            confirmationModalController.open({
                initialFocus: '#modal-confirm',
                context: {
                    onConfirm,
                    setupContent: () => {
                        if (modalMessage) {
                            modalMessage.textContent = message;
                        }
                    }
                }
            });
            return;
        }

        if (!confirmationModal) {
            return;
        }

        if (modalMessage) {
            modalMessage.textContent = message;
        }
        confirmationModal.style.display = 'flex';
        confirmationModal.classList.add('is-open');
        confirmationModal.setAttribute('aria-hidden', 'false');

        if (modalConfirm) {
            modalConfirm.onclick = () => {
                hideConfirmationModal();
                if (typeof onConfirm === 'function') {
                    onConfirm();
                }
            };
        }

        if (modalCancel) {
            modalCancel.onclick = () => {
                hideConfirmationModal();
            };
        }
    }

    function hideConfirmationModal() {
        if (confirmationModalController) {
            confirmationModalController.close({ reason: 'cancel' });
            return;
        }

        if (!confirmationModal) {
            return;
        }

        confirmationModal.classList.remove('is-open');
        confirmationModal.setAttribute('aria-hidden', 'true');
        confirmationModal.style.display = 'none';
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

    function showNotification(message, type = 'success') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        // Add notification to the page
        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    function updateStoredUser(email, updates = {}, options = {}) {
        if (!email) {
            return null;
        }

        let users = loadUsersWithNormalization();
        const userIndex = findUserIndexByEmail(users, email);

        if (userIndex === -1) {
            return null;
        }

        const mergedUser = { ...users[userIndex], ...updates };

        if (Array.isArray(options.removeFields)) {
            options.removeFields.forEach(field => {
                delete mergedUser[field];
            });
        }

        const displayEmail = typeof mergedUser.email === 'string' ? mergedUser.email.trim() : mergedUser.email;
        const normalizedEmail = mergedUser.normalizedEmail || normalizeEmail(displayEmail || '');

        users[userIndex] = {
            ...mergedUser,
            email: displayEmail,
            normalizedEmail
        };

        localStorage.setItem('users', JSON.stringify(users));
        return users[userIndex];
    }

});
