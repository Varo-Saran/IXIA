document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profile-form');
    const passwordForm = document.getElementById('password-form');
    const preferencesForm = document.getElementById('preferences-form');
    const deleteAccountBtn = document.getElementById('delete-account');
    const changePictureBtn = document.getElementById('change-picture');
    const removePictureBtn = document.getElementById('remove-picture');
    const pictureUpload = document.getElementById('picture-upload');
    const profileImage = document.getElementById('profile-image');
    const themeToggle = document.getElementById('theme-toggle');
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalCancel = document.getElementById('modal-cancel');

    // Load user data
    loadUserData();

    // Event listeners
    profileForm.addEventListener('submit', updateProfile);
    passwordForm.addEventListener('submit', changePassword);
    preferencesForm.addEventListener('submit', savePreferences);
    deleteAccountBtn.addEventListener('click', confirmDeleteAccount);
    changePictureBtn.addEventListener('click', () => pictureUpload.click());
    removePictureBtn.addEventListener('click', removePicture);
    pictureUpload.addEventListener('change', changePicture);
    themeToggle.addEventListener('click', toggleTheme);

    function loadUserData() {
        // Simulate loading user data from server
        const userData = JSON.parse(localStorage.getItem('currentUser')) || {};
        document.getElementById('username').value = userData.username || '';
        document.getElementById('email').value = userData.email || '';
        document.getElementById('language').value = userData.language || 'en';
        document.getElementById('notifications').checked = userData.notifications || false;
        
        if (userData.profilePicture) {
            profileImage.src = userData.profilePicture;
        } else {
            profileImage.src = 'default-profile-icon.png';
        }
    }

    function updateProfile(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        
        // Simulate API call to update profile
        let userData = JSON.parse(localStorage.getItem('currentUser')) || {};
        userData = { ...userData, username, email };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        showNotification('Profile updated successfully!');
    }

    function changePassword(e) {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            showNotification('New passwords do not match!', 'error');
            return;
        }

        // Simulate API call to change password
        showNotification('Password changed successfully!');
        passwordForm.reset();
    }

    function savePreferences(e) {
        e.preventDefault();
        const language = document.getElementById('language').value;
        const notifications = document.getElementById('notifications').checked;

        // Simulate API call to save preferences
        let userData = JSON.parse(localStorage.getItem('currentUser')) || {};
        userData = { ...userData, language, notifications };
        localStorage.setItem('currentUser', JSON.stringify(userData));

        showNotification('Preferences saved successfully!');
    }

    function confirmDeleteAccount() {
        showModal('Are you sure you want to delete your account? This action cannot be undone.', deleteAccount);
    }

    function deleteAccount() {
        // Simulate API call to delete account
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userToken');
        showNotification('Your account has been deleted. Redirecting to home page...', 'info');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    }

    function changePicture(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                profileImage.src = e.target.result;
                // Simulate saving the profile picture
                let userData = JSON.parse(localStorage.getItem('currentUser')) || {};
                userData.profilePicture = e.target.result;
                localStorage.setItem('currentUser', JSON.stringify(userData));
                showNotification('Profile picture updated successfully!');
            };
            reader.readAsDataURL(file);
        }
    }

    function removePicture() {
        profileImage.src = 'default-profile-icon.png';
        // Simulate removing the profile picture
        let userData = JSON.parse(localStorage.getItem('currentUser')) || {};
        delete userData.profilePicture;
        localStorage.setItem('currentUser', JSON.stringify(userData));
        showNotification('Profile picture removed successfully!');
    }

    function toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const icon = themeToggle.querySelector('i');
        icon.classList.toggle('fa-moon');
        icon.classList.toggle('fa-sun');
        // Save theme preference
        localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    }

    function showModal(message, onConfirm) {
        modalMessage.textContent = message;
        confirmationModal.style.display = 'block';
        
        modalConfirm.onclick = () => {
            confirmationModal.style.display = 'none';
            onConfirm();
        };
        
        modalCancel.onclick = () => {
            confirmationModal.style.display = 'none';
        };
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

    // Initialize theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.querySelector('i').classList.replace('fa-moon', 'fa-sun');
    }
});