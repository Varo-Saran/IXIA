let allUsers = [];
let filteredUsers = [];
let currentAdmin = null;
let currentPage = 1;
const pageSize = 10;
let adminModalController = null;
let adminModalElement = null;
let adminModalConfirmButton = null;
let adminModalCancelButton = null;
let activeStatusFilter = 'All';
const advancedFilterDefaults = {
    role: '',
    status: '',
    registrationFrom: '',
    registrationTo: ''
};
let advancedFilterState = { ...advancedFilterDefaults };
let systemStatsIntervalId = null;
const SYSTEM_STATS_REFRESH_INTERVAL = 60000;

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

function showCustomModal(title, message, callback, showCancel = false, showInput = false, inputType = 'text', formFields = null, options = null) {
    adminModalElement = adminModalElement || document.getElementById('custom-modal');
    adminModalConfirmButton = adminModalConfirmButton || document.getElementById('modal-confirm');
    adminModalCancelButton = adminModalCancelButton || document.getElementById('modal-cancel');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = adminModalElement ? adminModalElement.querySelector('.modal-content .input-group') : null;

    const config = Object.assign({
        nested: false,
        nestedType: 'info',
        nestedDuration: 4000,
        onValidate: null,
        onCancel: null,
        onToast: null,
        onCropper: null,
        beforeOpen: null,
        afterOpen: null,
        beforeClose: null,
        afterClose: null
    }, options || {});

    if (config.nested && adminModalController && adminModalController.isOpen()) {
        createNestedModalMessage({
            modal: adminModalElement,
            title,
            message,
            type: config.nestedType,
            duration: config.nestedDuration
        });
        return;
    }

    if (!adminModalElement || !modalTitle || !modalContent || !adminModalConfirmButton || !adminModalCancelButton) {
        console.warn('Modal elements not found');
        if (typeof callback === 'function') {
            callback();
        }
        return;
    }

    const safeCallback = typeof callback === 'function' ? callback : null;
    const hasForm = Array.isArray(formFields) && formFields.length > 0;
    const defaultConfirmText = adminModalConfirmButton.dataset.defaultText || adminModalConfirmButton.textContent;
    if (!adminModalConfirmButton.dataset.defaultText) {
        adminModalConfirmButton.dataset.defaultText = defaultConfirmText;
    }

    const context = {
        title,
        message,
        safeCallback,
        showInput,
        inputType,
        formFields: hasForm ? formFields : null,
        showCancel: showCancel || hasForm,
        config,
        confirmLabel: hasForm ? 'Save Changes' : defaultConfirmText,
        confirmPayload: undefined,
        onCancel: typeof config.onCancel === 'function' ? config.onCancel : null
    };

    context.setupContent = () => {
        modalTitle.textContent = title;
        if (hasForm) {
            modalContent.innerHTML = '';
            if (message) {
                const description = document.createElement('p');
                description.classList.add('modal-description');
                description.textContent = message;
                modalContent.appendChild(description);
            }

            const errorContainer = document.createElement('div');
            errorContainer.classList.add('modal-error');
            errorContainer.setAttribute('aria-live', 'polite');
            errorContainer.style.display = 'none';
            modalContent.appendChild(errorContainer);

            const form = document.createElement('form');
            form.id = 'modal-form';
            form.setAttribute('novalidate', 'novalidate');

            formFields.forEach(field => {
                const wrapper = document.createElement('div');
                wrapper.classList.add('modal-field');

                if (field.label) {
                    const label = document.createElement('label');
                    label.setAttribute('for', field.id);
                    label.textContent = field.label;
                    wrapper.appendChild(label);
                }

                let inputElement;
                if (field.type === 'select') {
                    inputElement = document.createElement('select');
                    (field.options || []).forEach(option => {
                        const optionElement = document.createElement('option');
                        if (typeof option === 'string') {
                            optionElement.value = option;
                            optionElement.textContent = option;
                        } else {
                            optionElement.value = option.value;
                            optionElement.textContent = option.label;
                        }
                        optionElement.selected = optionElement.value === field.value;
                        inputElement.appendChild(optionElement);
                    });
                } else {
                    inputElement = document.createElement('input');
                    inputElement.type = field.type || 'text';
                    inputElement.value = field.value || '';
                    if (field.placeholder) {
                        inputElement.placeholder = field.placeholder;
                    }
                }

                inputElement.id = field.id;
                inputElement.name = field.name || field.id;

                if (field.required) {
                    inputElement.required = true;
                }
                if (field.readOnly) {
                    inputElement.readOnly = true;
                }
                if (field.disabled) {
                    inputElement.disabled = true;
                }

                wrapper.appendChild(inputElement);

                if (field.helperText) {
                    const helper = document.createElement('small');
                    helper.classList.add('helper-text');
                    helper.textContent = field.helperText;
                    wrapper.appendChild(helper);
                }

                form.appendChild(wrapper);
            });

            modalContent.appendChild(form);
        } else if (showInput) {
            modalContent.innerHTML = `
                <label for="modal-input">${message}</label>
                <input type="${inputType}" id="modal-input">
            `;
        } else {
            modalContent.innerHTML = `<p>${message}</p>`;
        }

        adminModalConfirmButton.textContent = context.confirmLabel;
        if (context.showCancel) {
            adminModalCancelButton.style.display = 'inline-block';
            adminModalCancelButton.removeAttribute('hidden');
        } else {
            adminModalCancelButton.style.display = 'none';
            adminModalCancelButton.setAttribute('hidden', 'hidden');
        }
    };

    const dynamicHooks = {};

    if (hasForm) {
        dynamicHooks.validate = () => {
            const form = adminModalElement.querySelector('#modal-form');
            const errorContainer = adminModalElement.querySelector('.modal-error');
            const formValues = {};
            let hasError = false;
            const errorMessages = [];

            formFields.forEach(field => {
                const input = form ? form.querySelector(`#${field.id}`) : null;
                if (!input) {
                    return;
                }

                input.classList.remove('input-error');

                let value = input.value;
                if (typeof value === 'string') {
                    value = value.trim();
                }

                let fieldHasError = false;

                if (field.required && (!value || value.length === 0)) {
                    hasError = true;
                    fieldHasError = true;
                    errorMessages.push(`${field.label || field.name || field.id} is required.`);
                    input.classList.add('input-error');
                }

                if (!fieldHasError && field.type === 'email' && value && !/^\S+@\S+\.\S+$/.test(value)) {
                    hasError = true;
                    fieldHasError = true;
                    errorMessages.push('Please enter a valid email address.');
                    input.classList.add('input-error');
                }

                if (!fieldHasError && typeof field.validate === 'function') {
                    const validationMessage = field.validate(value, formValues);
                    if (validationMessage) {
                        hasError = true;
                        fieldHasError = true;
                        errorMessages.push(validationMessage);
                        input.classList.add('input-error');
                    }
                }

                formValues[field.name || field.id] = value;
            });

            if (hasError) {
                if (errorContainer) {
                    errorContainer.textContent = errorMessages.join(' ');
                    errorContainer.style.display = 'block';
                }
                return false;
            }

            if (errorContainer) {
                errorContainer.textContent = '';
                errorContainer.style.display = 'none';
            }

            context.confirmPayload = formValues;
            if (typeof config.onValidate === 'function') {
                const validationResult = config.onValidate(formValues);
                if (validationResult === false) {
                    return false;
                }
                if (validationResult !== undefined) {
                    context.confirmPayload = validationResult;
                    return validationResult;
                }
            }
            return formValues;
        };
    } else if (showInput) {
        dynamicHooks.validate = ({ data }) => {
            let value = data;
            if (typeof value === 'string') {
                value = value.trim();
            }
            context.confirmPayload = value;
            if (typeof config.onValidate === 'function') {
                const validationResult = config.onValidate(value);
                if (validationResult === false) {
                    return false;
                }
                if (validationResult !== undefined) {
                    context.confirmPayload = validationResult;
                    return validationResult;
                }
            }
            return value;
        };
    } else if (typeof config.onValidate === 'function') {
        dynamicHooks.validate = ({ data }) => config.onValidate(data);
    }

    if (typeof config.onToast === 'function') {
        dynamicHooks.toast = (payload) => config.onToast(payload, context);
    }

    if (typeof config.onCropper === 'function') {
        dynamicHooks.cropper = (payload) => config.onCropper(payload, context);
    }

    if (typeof config.beforeOpen === 'function') {
        dynamicHooks.beforeOpen = (payload) => config.beforeOpen(payload, context);
    }

    if (typeof config.afterOpen === 'function') {
        dynamicHooks.afterOpen = (payload) => config.afterOpen(payload, context);
    }

    if (typeof config.beforeClose === 'function') {
        dynamicHooks.beforeClose = (payload) => config.beforeClose(payload, context);
    }

    if (typeof config.afterClose === 'function') {
        dynamicHooks.afterClose = (payload) => config.afterClose(payload, context);
    }

    const initialFocusSelector = hasForm
        ? '#modal-form input:not([disabled]):not([readonly]), #modal-form select:not([disabled])'
        : (showInput ? '#modal-input' : '#modal-confirm');

    if (adminModalController) {
        adminModalController.open({
            initialFocus: initialFocusSelector,
            context,
            hooks: dynamicHooks
        });
    } else {
        context.setupContent();
        adminModalElement.style.display = 'flex';
        adminModalElement.classList.add('is-open');
        adminModalElement.setAttribute('aria-hidden', 'false');
    }
}

function createNestedModalMessage({ modal, title, message, type = 'info', duration = 4000 }) {
    if (!modal) {
        return;
    }

    const modalContent = modal.querySelector('.modal-content');
    const host = modalContent || modal;

    let container = host.querySelector('.nested-modal-messages');
    if (!container) {
        container = document.createElement('div');
        container.classList.add('nested-modal-messages');
        host.appendChild(container);
    }

    const messageElement = document.createElement('div');
    messageElement.classList.add('nested-modal-message');
    messageElement.classList.add(`nested-${type}`);

    const titleElement = document.createElement('strong');
    titleElement.textContent = title;
    messageElement.appendChild(titleElement);

    if (message) {
        const textElement = document.createElement('span');
        textElement.textContent = message;
        messageElement.appendChild(textElement);
    }

    container.appendChild(messageElement);

    requestAnimationFrame(() => {
        messageElement.classList.add('visible');
    });

    if (duration !== 0) {
        setTimeout(() => {
            messageElement.classList.remove('visible');
            const removeMessage = () => {
                messageElement.removeEventListener('transitionend', removeMessage);
                messageElement.remove();
                if (container.children.length === 0) {
                    container.remove();
                }
            };
            messageElement.addEventListener('transitionend', removeMessage);

            const computedStyle = typeof window !== 'undefined' && window.getComputedStyle
                ? window.getComputedStyle(messageElement)
                : null;
            if (!computedStyle || computedStyle.transitionDuration === '0s') {
                removeMessage();
            }
        }, duration);
    }
}

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
    const searchInput = document.getElementById('user-search');
    const searchButton = document.getElementById('search-btn');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfoElement = document.getElementById('page-info');
    const quickFilterChips = Array.from(document.querySelectorAll('.quick-filters .chip'));
    const advancedFiltersButton = document.getElementById('advanced-filters-btn');
    const resetAdvancedFiltersButton = document.getElementById('reset-advanced-filters');
    const advancedFilterIndicator = document.getElementById('advanced-filter-indicator');
    const inviteAdminButton = document.querySelector('#account-list .section-actions .btn.btn-primary');
    const body = document.body;
    adminModalElement = document.getElementById('custom-modal');
    adminModalConfirmButton = document.getElementById('modal-confirm');
    adminModalCancelButton = document.getElementById('modal-cancel');
    const adminModalCloseButton = document.getElementById('admin-modal-close');

    if (adminModalElement) {
        adminModalController = ModalController.create(adminModalElement, {
            closeSelectors: ['.modal-overlay', '.modal-close', '[data-close-modal]'],
            initialFocus: '#modal-confirm',
            hooks: {
                beforeOpen({ context }) {
                    if (context && typeof context.setupContent === 'function') {
                        context.setupContent();
                    }
                },
                afterOpen({ context }) {
                    if (!context) {
                        return;
                    }
                    if (context.formFields) {
                        const firstField = adminModalElement.querySelector('#modal-form input:not([disabled]):not([readonly]), #modal-form select:not([disabled])');
                        if (firstField) {
                            firstField.focus({ preventScroll: true });
                        }
                    } else if (context.showInput) {
                        const input = adminModalElement.querySelector('#modal-input');
                        if (input) {
                            input.focus({ preventScroll: true });
                            input.select();
                        }
                    }
                },
                afterClose({ reason, context }) {
                    if (adminModalConfirmButton && adminModalConfirmButton.dataset.defaultText) {
                        adminModalConfirmButton.textContent = adminModalConfirmButton.dataset.defaultText;
                    }
                    if (adminModalCancelButton) {
                        adminModalCancelButton.style.display = '';
                        adminModalCancelButton.removeAttribute('hidden');
                    }
                    if (!context) {
                        return;
                    }
                    if (reason === 'confirm') {
                        if (typeof context.safeCallback === 'function') {
                            context.safeCallback(context.confirmPayload);
                        }
                    } else if (typeof context.onCancel === 'function') {
                        context.onCancel(reason);
                    }
                    context.confirmPayload = undefined;
                }
            }
        });
    }

    if (adminModalController && adminModalConfirmButton) {
        adminModalConfirmButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const context = adminModalController.getContext();
            if (!context) {
                adminModalController.close({ reason: 'confirm' });
                return;
            }

            let payload;
            if (context.showInput) {
                const input = adminModalElement ? adminModalElement.querySelector('#modal-input') : null;
                payload = input ? input.value : '';
            }

            const validationResult = adminModalController.runHook('validate', {
                reason: 'confirm',
                data: payload
            });

            if (validationResult === false) {
                return;
            }

            if (validationResult !== undefined && validationResult !== true) {
                context.confirmPayload = validationResult;
            } else if (payload !== undefined) {
                context.confirmPayload = payload;
            }

            adminModalController.close({ reason: 'confirm' });
        });
    }

    const hasAdvancedFilters = () => Object.values(advancedFilterState).some(value => Boolean(value));

    const formatAdvancedFilterSummary = () => {
        const summaryParts = [];
        if (advancedFilterState.role) {
            summaryParts.push(`Role: ${advancedFilterState.role}`);
        }
        if (advancedFilterState.status) {
            summaryParts.push(`Status: ${advancedFilterState.status}`);
        }
        if (advancedFilterState.registrationFrom || advancedFilterState.registrationTo) {
            const from = advancedFilterState.registrationFrom ? `from ${advancedFilterState.registrationFrom}` : '';
            const to = advancedFilterState.registrationTo ? `until ${advancedFilterState.registrationTo}` : '';
            summaryParts.push(`Registered ${[from, to].filter(Boolean).join(' ')}`.trim());
        }
        return summaryParts.join(' · ');
    };

    const updateAdvancedFilterIndicator = () => {
        const active = hasAdvancedFilters();
        if (advancedFilterIndicator) {
            if (active) {
                const summary = formatAdvancedFilterSummary();
                advancedFilterIndicator.textContent = `Advanced filters active${summary ? ` — ${summary}` : ''}`;
                advancedFilterIndicator.hidden = false;
            } else {
                advancedFilterIndicator.textContent = '';
                advancedFilterIndicator.hidden = true;
            }
        }
        if (advancedFiltersButton) {
            advancedFiltersButton.setAttribute('aria-pressed', active ? 'true' : 'false');
        }
        if (resetAdvancedFiltersButton) {
            resetAdvancedFiltersButton.hidden = !active;
            resetAdvancedFiltersButton.disabled = !active;
        }
    };

    const clearAdvancedFilters = ({ shouldApply = true } = {}) => {
        advancedFilterState = { ...advancedFilterDefaults };
        updateAdvancedFilterIndicator();
        if (shouldApply) {
            applyUserFilter(false);
        }
    };

    if (advancedFiltersButton) {
        advancedFiltersButton.addEventListener('click', () => {
            const availableRoles = Array.from(new Set(allUsers
                .map(user => user && user.role ? String(user.role).trim() : '')
                .filter(Boolean)));
            const availableStatuses = Array.from(new Set(allUsers
                .map(user => user && user.status ? String(user.status).trim() : '')
                .filter(Boolean)));

            const roleValues = new Set(['']);
            if (advancedFilterState.role) {
                roleValues.add(advancedFilterState.role);
            }
            availableRoles.forEach(role => roleValues.add(role));
            const roleOptions = Array.from(roleValues).map(value => value
                ? { value, label: value }
                : { value: '', label: 'Any role' });

            const defaultStatusOptions = ['Active', 'Pending', 'Suspended', 'Deactivated'];
            const statusValues = new Set(['']);
            if (advancedFilterState.status) {
                statusValues.add(advancedFilterState.status);
            }
            [...availableStatuses, ...defaultStatusOptions].forEach(status => statusValues.add(status));
            const statusOptions = Array.from(statusValues).map(value => value
                ? { value, label: value }
                : { value: '', label: 'Any status' });

            showCustomModal(
                'Advanced filters',
                'Refine the user directory by combining role, status, and registration date criteria.',
                (formValues) => {
                    advancedFilterState = {
                        role: formValues['advanced-role'] || '',
                        status: formValues['advanced-status'] || '',
                        registrationFrom: formValues['advanced-registration-from'] || '',
                        registrationTo: formValues['advanced-registration-to'] || ''
                    };
                    updateAdvancedFilterIndicator();
                    applyUserFilter();
                },
                true,
                false,
                'text',
                [
                    {
                        id: 'advanced-role',
                        name: 'advanced-role',
                        label: 'Role',
                        type: 'select',
                        value: advancedFilterState.role,
                        options: roleOptions
                    },
                    {
                        id: 'advanced-status',
                        name: 'advanced-status',
                        label: 'Status',
                        type: 'select',
                        value: advancedFilterState.status,
                        options: statusOptions
                    },
                    {
                        id: 'advanced-registration-from',
                        name: 'advanced-registration-from',
                        label: 'Registered on or after',
                        type: 'date',
                        value: advancedFilterState.registrationFrom,
                        helperText: 'Leave blank to ignore the starting date.'
                    },
                    {
                        id: 'advanced-registration-to',
                        name: 'advanced-registration-to',
                        label: 'Registered on or before',
                        type: 'date',
                        value: advancedFilterState.registrationTo,
                        helperText: 'Leave blank to ignore the end date.'
                    }
                ],
                {
                    onValidate: (values) => {
                        const from = values['advanced-registration-from'];
                        const to = values['advanced-registration-to'];
                        if (from && to) {
                            const fromDate = parseISODate(from);
                            const toDate = parseISODate(to);
                            if (fromDate && toDate && fromDate > toDate) {
                                const errorContainer = adminModalElement ? adminModalElement.querySelector('.modal-error') : null;
                                if (errorContainer) {
                                    errorContainer.textContent = 'The start date cannot be later than the end date.';
                                    errorContainer.style.display = 'block';
                                }
                                return false;
                            }
                        }
                        return values;
                    },
                    onCancel: () => {
                        updateAdvancedFilterIndicator();
                    }
                }
            );
        });
    }

    if (resetAdvancedFiltersButton) {
        resetAdvancedFiltersButton.addEventListener('click', () => clearAdvancedFilters({ shouldApply: true }));
    }

    updateAdvancedFilterIndicator();

    if (quickFilterChips.length > 0) {
        const initiallyActiveChip = quickFilterChips.find(chip => chip.classList.contains('active'));
        if (initiallyActiveChip) {
            activeStatusFilter = initiallyActiveChip.textContent.trim() || 'All';
        }

        quickFilterChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const selectedFilter = chip.textContent.trim() || 'All';
                if (activeStatusFilter === selectedFilter) {
                    return;
                }

                activeStatusFilter = selectedFilter;
                quickFilterChips.forEach(currentChip => {
                    currentChip.classList.toggle('active', currentChip === chip);
                });
                applyUserFilter(false);
            });
        });
    }

    const cancelTargets = [adminModalCancelButton, adminModalCloseButton].filter(Boolean);
    cancelTargets.forEach((button) => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (adminModalController) {
                adminModalController.close({ reason: 'cancel' });
            }
        });
    });

    if (inviteAdminButton) {
        inviteAdminButton.addEventListener('click', openInviteAdminModal);
    }

    async function handleAdminInvitation(formValues) {
        if (!formValues) {
            return;
        }

        const fullName = (formValues.inviteAdminName || '').trim();
        const email = (formValues.inviteAdminEmail || '').trim();
        const normalizedEmail = normalizeEmail(email);
        const temporaryPassword = (formValues.inviteAdminTempPassword || '').trim();

        if (!fullName || !email) {
            showCustomModal('Error', 'Name and email are required to invite a new admin.');
            return;
        }

        let users;
        try {
            users = loadUsersWithNormalization();
        } catch (error) {
            console.error('Failed to load users while inviting admin:', error);
            showCustomModal('Error', 'We could not access the current user list. Please try again.');
            return;
        }

        const duplicateEmail = users.some(user => (user.normalizedEmail || normalizeEmail(user.email || '')) === normalizedEmail);
        if (duplicateEmail) {
            showCustomModal('Error', 'An account with this email already exists.');
            return;
        }

        const timestamp = new Date().toISOString();
        let passwordCredential = null;
        let passwordVersion = null;
        let passwordUpdatedAt = null;

        if (temporaryPassword) {
            try {
                passwordCredential = await hashPassword(temporaryPassword);
                passwordVersion = passwordCredential.version;
                passwordUpdatedAt = timestamp;
            } catch (error) {
                console.error('Failed to hash temporary password for admin invite:', error);
                showCustomModal('Error', 'We could not securely store the temporary password. Please try again.');
                return;
            }
        }

        const newAdmin = {
            username: fullName,
            email,
            normalizedEmail,
            role: 'Admin',
            status: temporaryPassword ? 'Active' : 'Pending',
            isAdmin: true,
            password: passwordCredential,
            passwordVersion,
            passwordUpdatedAt,
            forcePasswordReset: true,
            registrationDate: timestamp,
            lastActive: null
        };

        try {
            users.push(newAdmin);
            localStorage.setItem('users', JSON.stringify(users));
        } catch (error) {
            console.error('Failed to persist admin invitation:', error);
            showCustomModal('Error', 'We could not save the new admin. Please try again.');
            return;
        }

        displayAccountInfo();

        const successMessage = temporaryPassword
            ? `An admin invitation has been created for ${email}. Share the temporary password with them and remind them to update it on first login.`
            : `An admin invitation has been created for ${email}. Ask them to complete password recovery to set their credentials before signing in.`;
        showCustomModal('Success', successMessage);
    }

    function openInviteAdminModal() {
        const formFields = [
            {
                id: 'invite-admin-name',
                name: 'inviteAdminName',
                label: 'Full Name',
                type: 'text',
                required: true,
                placeholder: 'Enter the administrator\'s name'
            },
            {
                id: 'invite-admin-email',
                name: 'inviteAdminEmail',
                label: 'Email Address',
                type: 'email',
                required: true,
                placeholder: 'admin@example.com',
                validate: (value) => {
                    const trimmed = (value || '').trim();
                    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
                        return 'Please enter a valid email address.';
                    }
                    const normalized = normalizeEmail(trimmed);
                    const users = loadUsersWithNormalization();
                    const exists = users.some(user => (user.normalizedEmail || normalizeEmail(user.email || '')) === normalized);
                    return exists ? 'An account with this email already exists.' : '';
                }
            },
            {
                id: 'invite-admin-temp-password',
                name: 'inviteAdminTempPassword',
                label: 'Temporary Password (optional)',
                type: 'password',
                required: false,
                placeholder: 'Leave blank to require password recovery',
                helperText: 'Provide a temporary password or leave blank to have the invitee set their own.'
            }
        ];

        showCustomModal(
            'Invite New Admin',
            'Provide the new administrator\'s details below. They will be prompted to set a new password on first sign-in.',
            (values) => {
                handleAdminInvitation(values);
            },
            true,
            false,
            'text',
            formFields
        );
    }

    const ACTIVE_USER_THRESHOLD_DAYS = 7;
    const NEW_USER_THRESHOLD_DAYS = 30;

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
    function matchesActiveStatus(user) {
        if (!activeStatusFilter || activeStatusFilter === 'All') {
            return true;
        }

        const userStatus = (user.status || '').toLowerCase();
        return userStatus === activeStatusFilter.toLowerCase();
    }

    function getFilteredUsers(query) {
        const normalizedQuery = typeof query === 'string' ? query.trim().toLowerCase() : '';
        const roleFilter = (advancedFilterState.role || '').toLowerCase();
        const statusFilter = (advancedFilterState.status || '').toLowerCase();
        const registrationFrom = parseISODate(advancedFilterState.registrationFrom);
        const registrationTo = parseISODate(advancedFilterState.registrationTo);
        const inclusiveRegistrationTo = typeof registrationTo === 'number'
            ? registrationTo + (24 * 60 * 60 * 1000 - 1)
            : null;

        return allUsers.filter(user => {
            const username = (user.username || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            const normalizedEmail = (user.normalizedEmail || normalizeEmail(user.email || ''));
            const matchesQuery = !normalizedQuery
                || username.includes(normalizedQuery)
                || email.includes(normalizedQuery)
                || normalizedEmail.includes(normalizedQuery);

            const matchesRole = !roleFilter
                || ((user.role || '').toLowerCase() === roleFilter);

            const matchesAdvancedStatus = !statusFilter
                || ((user.status || '').toLowerCase() === statusFilter);

            let matchesRegistration = true;
            if (registrationFrom || inclusiveRegistrationTo) {
                const registrationTimestamp = parseISODate(user.registrationDate);
                if (!registrationTimestamp) {
                    matchesRegistration = false;
                } else {
                    if (registrationFrom && registrationTimestamp < registrationFrom) {
                        matchesRegistration = false;
                    }
                    if (matchesRegistration && inclusiveRegistrationTo && registrationTimestamp > inclusiveRegistrationTo) {
                        matchesRegistration = false;
                    }
                }
            }

            return matchesQuery
                && matchesActiveStatus(user)
                && matchesRole
                && matchesAdvancedStatus
                && matchesRegistration;
        });
    }

    function renderUserTable() {
        if (!userListElement) {
            return;
        }

        const totalUsers = filteredUsers.length;
        const totalPages = totalUsers > 0 ? Math.ceil(totalUsers / pageSize) : 0;

        if (totalPages > 0) {
            currentPage = Math.min(Math.max(currentPage, 1), totalPages);
        } else {
            currentPage = 0;
        }

        const startIndex = totalUsers === 0 ? 0 : (currentPage - 1) * pageSize;
        const paginatedUsers = totalUsers === 0 ? [] : filteredUsers.slice(startIndex, startIndex + pageSize);

        userListElement.innerHTML = '';

        if (totalUsers === 0) {
            const hasAnyUsers = Array.isArray(allUsers) && allUsers.length > 0;
            const emptyRow = document.createElement('tr');
            emptyRow.classList.add('empty-state-row');

            const emptyCell = document.createElement('td');
            emptyCell.colSpan = 4;

            const emptyState = document.createElement('div');
            emptyState.classList.add('empty-state');

            const icon = document.createElement('i');
            icon.classList.add('fas', 'fa-user-slash');
            icon.setAttribute('aria-hidden', 'true');

            const title = document.createElement('h3');
            title.textContent = hasAnyUsers
                ? 'No accounts match your filters'
                : 'No accounts available yet';

            const description = document.createElement('p');
            description.textContent = hasAnyUsers
                ? 'Try adjusting your search terms or clearing filters to find other accounts.'
                : 'Accounts will appear here once users sign up.';

            emptyState.appendChild(icon);
            emptyState.appendChild(title);
            emptyState.appendChild(description);

            emptyCell.appendChild(emptyState);
            emptyRow.appendChild(emptyCell);
            userListElement.appendChild(emptyRow);
        }

        paginatedUsers.forEach(user => {
            const row = document.createElement('tr');
            const normalizedUserEmail = user.normalizedEmail || normalizeEmail(user.email || '');
            const adminNormalizedEmail = currentAdmin ? currentAdmin.normalizedEmail || normalizeEmail(currentAdmin.email || '') : '';
            const isAdmin = currentAdmin && normalizedUserEmail === adminNormalizedEmail;
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
                        <button class="edit-btn" data-email="${user.email}" data-normalized-email="${normalizedUserEmail}" title="Edit profile details, role, or status">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" data-email="${user.email}" data-normalized-email="${normalizedUserEmail}" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="reset-pwd-btn" data-email="${user.email}" data-normalized-email="${normalizedUserEmail}" title="Reset Password">
                            <i class="fas fa-key"></i>
                        </button>
                    `}
                </td>
            `;
            userListElement.appendChild(row);
        });

        if (pageInfoElement) {
            pageInfoElement.textContent = totalUsers === 0
                ? 'Page 0 of 0'
                : `Page ${currentPage} of ${totalPages}`;
        }

        if (prevPageBtn) {
            prevPageBtn.disabled = currentPage <= 1 || totalUsers === 0;
        }

        if (nextPageBtn) {
            nextPageBtn.disabled = totalUsers === 0 || currentPage >= totalPages;
        }

        userListElement.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => editUser(btn.dataset.email, btn.dataset.normalizedEmail));
        });
        userListElement.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteUser(btn.dataset.email, btn.dataset.normalizedEmail));
        });
        userListElement.querySelectorAll('.reset-pwd-btn').forEach(btn => {
            btn.addEventListener('click', () => resetUserPassword(btn.dataset.email, btn.dataset.normalizedEmail));
        });
        userListElement.querySelectorAll('.edit-admin-btn').forEach(btn => {
            btn.addEventListener('click', () => editAdminInfo(btn.dataset.action));
        });
    }

    function applyUserFilter(resetPage = true) {
        const query = searchInput ? searchInput.value.trim() : '';
        filteredUsers = getFilteredUsers(query);

        if (resetPage) {
            currentPage = 1;
        }

        renderUserTable();
    }

    function parseISODate(dateString) {
        if (!dateString) {
            return null;
        }
        const timestamp = Date.parse(dateString);
        return Number.isNaN(timestamp) ? null : timestamp;
    }

    function calculateAccountMetrics(users) {
        const now = Date.now();
        const activeThreshold = now - ACTIVE_USER_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
        const newUserThreshold = now - NEW_USER_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

        let activeCount = 0;
        let newUserCount = 0;

        users.forEach(user => {
            const lastActive = parseISODate(user.lastActive);
            if (lastActive && lastActive >= activeThreshold) {
                activeCount += 1;
            }

            const registrationDate = parseISODate(user.registrationDate);
            if (registrationDate && registrationDate >= newUserThreshold) {
                newUserCount += 1;
            }
        });

        return {
            total: users.length,
            active: activeCount,
            newUsers: newUserCount
        };
    }

    function collectResponseLatencySamples(messages, windowStartTime) {
        if (!Array.isArray(messages) || messages.length === 0) {
            return [];
        }

        const normalizedMessages = messages.reduce((accumulator, message) => {
            if (!message || typeof message !== 'object') {
                return accumulator;
            }

            const timestamp = parseISODate(message.timestamp);
            if (timestamp === null) {
                return accumulator;
            }

            accumulator.push({
                timestamp,
                isUser: Boolean(message.isUser)
            });

            return accumulator;
        }, []);

        if (normalizedMessages.length === 0) {
            return [];
        }

        normalizedMessages.sort((a, b) => a.timestamp - b.timestamp);

        const windowStart = typeof windowStartTime === 'number' ? windowStartTime : -Infinity;
        const pendingUserMessages = [];
        const latencies = [];

        normalizedMessages.forEach(entry => {
            if (entry.isUser) {
                if (entry.timestamp >= windowStart) {
                    pendingUserMessages.push(entry);
                }
                return;
            }

            if (entry.timestamp < windowStart) {
                return;
            }

            if (pendingUserMessages.length === 0) {
                return;
            }

            while (pendingUserMessages.length > 0 && pendingUserMessages[pendingUserMessages.length - 1].timestamp > entry.timestamp) {
                pendingUserMessages.pop();
            }

            if (pendingUserMessages.length === 0) {
                return;
            }

            const userMessage = pendingUserMessages.pop();
            if (entry.timestamp >= userMessage.timestamp) {
                latencies.push(entry.timestamp - userMessage.timestamp);
            }
        });

        return latencies;
    }

    function collectChatTelemetry(latencyWindowMs = 24 * 60 * 60 * 1000) {
        const keys = Object.keys(localStorage);
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTodayTime = startOfToday.getTime();
        const effectiveLatencyWindow = typeof latencyWindowMs === 'number' && latencyWindowMs > 0
            ? latencyWindowMs
            : 24 * 60 * 60 * 1000;
        const latencyWindowStartTime = Date.now() - effectiveLatencyWindow;

        const totals = keys.reduce((accumulator, key) => {
            if (!key.startsWith('chats_')) {
                return accumulator;
            }

            try {
                const rawValue = localStorage.getItem(key);
                const parsedValue = rawValue ? JSON.parse(rawValue) : null;
                if (!parsedValue || typeof parsedValue !== 'object') {
                    return accumulator;
                }

                const chatIds = Object.keys(parsedValue);
                accumulator.totalChats += chatIds.length;

                chatIds.forEach(chatId => {
                    const chat = parsedValue[chatId];
                    const messages = Array.isArray(chat?.messages) ? chat.messages : [];
                    accumulator.totalMessages += messages.length;

                    const responseLatencies = collectResponseLatencySamples(messages, latencyWindowStartTime);
                    if (responseLatencies.length > 0) {
                        const latencySum = responseLatencies.reduce((sum, latency) => sum + latency, 0);
                        accumulator.totalResponseLatencyMs += latencySum;
                        accumulator.responseLatencySamples += responseLatencies.length;
                    }

                    messages.forEach(message => {
                        const messageTimestamp = parseISODate(message.timestamp);
                        if (messageTimestamp && messageTimestamp >= startOfTodayTime) {
                            accumulator.messagesToday += 1;
                        }
                    });
                });
            } catch (error) {
                console.warn('Failed to parse chat telemetry for key:', key, error);
            }

            return accumulator;
        }, {
            totalChats: 0,
            totalMessages: 0,
            messagesToday: 0,
            totalResponseLatencyMs: 0,
            responseLatencySamples: 0
        });

        const averageResponseLatencyMs = totals.responseLatencySamples > 0
            ? totals.totalResponseLatencyMs / totals.responseLatencySamples
            : null;

        return {
            totalChats: totals.totalChats,
            totalMessages: totals.totalMessages,
            messagesToday: totals.messagesToday,
            averageResponseLatencyMs,
            responseLatencySamples: totals.responseLatencySamples
        };
    }

    function formatLatency(latencyMs) {
        if (typeof latencyMs !== 'number' || !Number.isFinite(latencyMs)) {
            return null;
        }

        if (latencyMs >= 1000) {
            const seconds = latencyMs / 1000;
            const precision = seconds >= 10 ? 0 : 1;
            return `${seconds.toFixed(precision)}s`;
        }

        return `${Math.round(latencyMs)}ms`;
    }

    function updateSystemStats() {
        const totalChatsElement = document.getElementById('total-chats');
        const messagesTodayElement = document.getElementById('messages-today');
        const avgResponseElement = document.getElementById('avg-response-time');

        if (!totalChatsElement || !messagesTodayElement || !avgResponseElement) {
            return;
        }

        const telemetry = collectChatTelemetry();
        totalChatsElement.textContent = telemetry.totalChats.toString();
        messagesTodayElement.textContent = telemetry.messagesToday.toString();
        if (telemetry.averageResponseLatencyMs !== null) {
            const formattedLatency = formatLatency(telemetry.averageResponseLatencyMs);
            avgResponseElement.textContent = formattedLatency || 'Not enough data';
        } else {
            avgResponseElement.textContent = 'Not enough data';
        }
    }

    function startSystemStatsPolling() {
        if (systemStatsIntervalId !== null) {
            return;
        }

        systemStatsIntervalId = window.setInterval(() => {
            try {
                updateSystemStats();
            } catch (error) {
                console.error('Failed to update system stats:', error);
            }
        }, SYSTEM_STATS_REFRESH_INTERVAL);
    }

    function stopSystemStatsPolling() {
        if (systemStatsIntervalId === null) {
            return;
        }

        clearInterval(systemStatsIntervalId);
        systemStatsIntervalId = null;
    }

    function displayAccountInfo() {
        allUsers = loadUsersWithNormalization();
        currentAdmin = JSON.parse(localStorage.getItem('currentUser'));

        if (currentAdmin && typeof currentAdmin === 'object') {
            const displayEmail = typeof currentAdmin.email === 'string' ? currentAdmin.email.trim() : currentAdmin.email;
            const normalizedEmail = currentAdmin.normalizedEmail || normalizeEmail(displayEmail || '');
            currentAdmin = { ...currentAdmin, email: displayEmail, normalizedEmail };
            localStorage.setItem('currentUser', JSON.stringify(currentAdmin));
        }

        handleAdminPasswordResetPrompt();

        const { total, active, newUsers } = calculateAccountMetrics(allUsers);

        if (totalAccountsElement) {
            totalAccountsElement.textContent = total.toString();
        }
        if (activeUsersElement) {
            activeUsersElement.textContent = active.toString();
        }
        if (newUsersElement) {
            newUsersElement.textContent = newUsers.toString();
        }

        updateSystemStats();
        applyUserFilter(false);
    }

    displayAccountInfo();
    startSystemStatsPolling();

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopSystemStatsPolling();
        } else {
            updateSystemStats();
            startSystemStatsPolling();
        }
    });

    window.addEventListener('pagehide', stopSystemStatsPolling);
    window.addEventListener('beforeunload', stopSystemStatsPolling);

    function handleAdminPasswordResetPrompt() {
        const resetRequired = Boolean(currentAdmin && currentAdmin.forcePasswordReset);
        const loginFlag = localStorage.getItem('adminPasswordResetRequired') === 'true';

        if (!resetRequired && !loginFlag) {
            return;
        }

        // This prompt exists because of the enhanced security update.
        showCustomModal(
            'Password Update Required',
            'We\'ve enhanced admin account security. Please update your password before continuing.',
            () => {
                editAdminInfo('password');
            }
        );
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => applyUserFilter());
    }

    if (searchButton) {
        searchButton.addEventListener('click', (event) => {
            event.preventDefault();
            applyUserFilter();
        });
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage -= 1;
                renderUserTable();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = filteredUsers.length > 0 ? Math.ceil(filteredUsers.length / pageSize) : 0;
            if (totalPages && currentPage < totalPages) {
                currentPage += 1;
                renderUserTable();
            }
        });
    }

    function editUser(email, normalizedEmail) {
        const users = loadUsersWithNormalization();
        const targetNormalizedEmail = normalizedEmail || normalizeEmail(email || '');
        const userIndex = users.findIndex(user => (user.normalizedEmail || normalizeEmail(user.email || '')) === targetNormalizedEmail);

        if (userIndex === -1) {
            showCustomModal('Error', 'User not found');
            return;
        }

        const user = users[userIndex];
        const availableRoles = ['User', 'Moderator', 'Viewer'];
        const availableStatuses = ['Active', 'Suspended', 'Pending'];
        const roleOptions = [...new Set([user.role || 'User', ...availableRoles])];
        const statusOptions = [...new Set([user.status || 'Active', ...availableStatuses])];

        showCustomModal(
            'Edit User',
            'Update the selected user\'s profile information, role, and status.',
            (formValues) => {
                const updatedUsername = formValues['edit-username'] || '';
                const updatedEmail = (formValues['edit-email'] || email);
                const updatedDisplayEmail = updatedEmail.trim();
                const updatedNormalizedEmail = normalizeEmail(updatedDisplayEmail);
                const updatedRole = formValues['edit-role'] || 'User';
                const updatedStatus = formValues['edit-status'] || 'Active';

                const duplicateEmail = users.some((item, index) => index !== userIndex
                    && (item.normalizedEmail || normalizeEmail(item.email || '')) === updatedNormalizedEmail);
                if (duplicateEmail) {
                    showCustomModal('Error', 'Another user is already using this email address. Please choose a different email.');
                    return;
                }

                users[userIndex] = {
                    ...users[userIndex],
                    username: updatedUsername,
                    email: updatedDisplayEmail,
                    normalizedEmail: updatedNormalizedEmail,
                    role: updatedRole,
                    status: updatedStatus
                };

                localStorage.setItem('users', JSON.stringify(users));
                displayAccountInfo();
                showCustomModal('Success', 'User updated successfully.');
            },
            true,
            false,
            'text',
            [
                {
                    id: 'edit-username',
                    name: 'edit-username',
                    label: 'Username',
                    type: 'text',
                    value: user.username || '',
                    required: true,
                    placeholder: 'Enter username'
                },
                {
                    id: 'edit-email',
                    name: 'edit-email',
                    label: 'Email Address',
                    type: 'email',
                    value: user.email,
                    required: true,
                    validate: (value) => {
                        if (!/^\S+@\S+\.\S+$/.test(value)) {
                            return 'Please enter a valid email address.';
                        }
                        const targetNormalized = normalizeEmail(value);
                        const isDuplicate = users.some((item, index) => index !== userIndex
                            && (item.normalizedEmail || normalizeEmail(item.email || '')) === targetNormalized);
                        return isDuplicate ? 'Another user is already using this email address.' : '';
                    }
                },
                {
                    id: 'edit-role',
                    name: 'edit-role',
                    label: 'Role',
                    type: 'select',
                    value: user.role || 'User',
                    options: roleOptions.map(role => ({ value: role, label: role }))
                },
                {
                    id: 'edit-status',
                    name: 'edit-status',
                    label: 'Account Status',
                    type: 'select',
                    value: user.status || 'Active',
                    options: statusOptions.map(status => ({ value: status, label: status })),
                    helperText: 'Use status to track account health (e.g., Active, Suspended, Pending).'
                }
            ]
        );
    }

    function deleteUser(email, normalizedEmail) {
        showCustomModal('Confirm Deletion', `Are you sure you want to delete the user with email: ${email}?`, () => {
            let users = loadUsersWithNormalization();
            const targetNormalizedEmail = normalizedEmail || normalizeEmail(email || '');
            users = users.filter(user => (user.normalizedEmail || normalizeEmail(user.email || '')) !== targetNormalizedEmail);
            localStorage.setItem('users', JSON.stringify(users));
            displayAccountInfo(); // Refresh the user list
            showCustomModal('Success', 'User deleted successfully');
        }, true); // true to show both Confirm and Cancel buttons
    }

    function resetUserPassword(email, normalizedEmail) {
        showCustomModal('Reset Password', `Enter new password for user: ${email}`, async (newPassword) => {
            if (!newPassword) {
                return;
            }

            try {
                let users = loadUsersWithNormalization();
                const targetNormalizedEmail = normalizedEmail || normalizeEmail(email || '');
                const userIndex = users.findIndex(user => (user.normalizedEmail || normalizeEmail(user.email || '')) === targetNormalizedEmail);

                if (userIndex === -1) {
                    showCustomModal('Error', 'User not found');
                    return;
                }

                const passwordCredential = await hashPassword(newPassword);
                const timestamp = new Date().toISOString();
                users[userIndex] = {
                    ...users[userIndex],
                    password: passwordCredential,
                    passwordVersion: passwordCredential.version,
                    passwordUpdatedAt: timestamp,
                    forcePasswordReset: true
                };
                localStorage.setItem('users', JSON.stringify(users));
                showCustomModal('Success', 'Password reset successfully. The user will be prompted to change it on next login.');
            } catch (error) {
                console.error('Failed to reset password securely:', error);
                showCustomModal('Error', 'Unable to reset password securely. Please try again.');
            }
        }, false, true); // false for Cancel button, true for input field
    }

    // Edit admin information
    function editAdminInfo(action) {
        const currentAdmin = JSON.parse(localStorage.getItem('currentUser'));
        let users = loadUsersWithNormalization();
        const normalizedAdminEmail = currentAdmin
            ? currentAdmin.normalizedEmail || normalizeEmail(currentAdmin.email || '')
            : '';
        const adminIndex = users.findIndex(user => (user.normalizedEmail || normalizeEmail(user.email || '')) === normalizedAdminEmail);
    
        if (adminIndex === -1) {
            showCustomModal('Error', 'Admin user not found');
            return;
        }
    
        if (action === 'email') {
            showEmailChangeModal(currentAdmin.email, (newEmail) => {
                if (newEmail && newEmail !== currentAdmin.email) {
                    // Check if the new email already exists
                    const trimmedEmail = newEmail.trim();
                    const normalizedNewEmail = normalizeEmail(trimmedEmail);
                    if (users.some(user => (user.normalizedEmail || normalizeEmail(user.email || '')) === normalizedNewEmail)) {
                        showCustomModal('Error', 'This email is already in use. Please choose a different one.');
                        return;
                    }
                    users[adminIndex] = {
                        ...users[adminIndex],
                        email: trimmedEmail,
                        normalizedEmail: normalizedNewEmail
                    };
                    const updatedAdmin = {
                        ...currentAdmin,
                        email: trimmedEmail,
                        normalizedEmail: normalizedNewEmail
                    };
                    localStorage.setItem('users', JSON.stringify(users));
                    localStorage.setItem('currentUser', JSON.stringify(updatedAdmin));
                    showCustomModal('Success', 'Email updated successfully');
                    displayAccountInfo(); // Refresh the user list
                }
            });
        } else if (action === 'password') {
            showCustomModal('Change Password', 'Enter new password:', async (newPassword) => {
                if (!newPassword) {
                    return;
                }

                try {
                    const passwordCredential = await hashPassword(newPassword);
                    const timestamp = new Date().toISOString();
                    users[adminIndex] = {
                        ...users[adminIndex],
                        password: passwordCredential,
                        passwordVersion: passwordCredential.version,
                        passwordUpdatedAt: timestamp,
                        forcePasswordReset: false
                    };
                    const updatedAdmin = {
                        ...currentAdmin,
                        forcePasswordReset: false
                    };
                    localStorage.setItem('users', JSON.stringify(users));
                    localStorage.setItem('currentUser', JSON.stringify(updatedAdmin));
                    localStorage.removeItem('adminPasswordResetRequired');
                    showCustomModal('Success', 'Password updated successfully');
                } catch (error) {
                    console.error('Failed to update admin password securely:', error);
                    showCustomModal('Error', 'Unable to update password securely. Please try again.');
                }
            }, true, true, 'password'); // true for Cancel button, true for input field, 'password' for input type
        }
    }
    

    function showEmailChangeModal(currentEmail, callback) {
        const formFields = [
            {
                id: 'new-email-input',
                name: 'newEmail',
                label: 'New Email Address',
                type: 'email',
                value: currentEmail || '',
                required: true,
                helperText: 'Enter a valid email address.',
                validate: (value) => {
                    if (!/^\S+@\S+\.\S+$/.test((value || '').trim())) {
                        return 'Please enter a valid email address.';
                    }
                    return null;
                }
            }
        ];

        showCustomModal(
            'Change Email',
            'Update the email address associated with this account.',
            (values) => {
                if (typeof callback === 'function' && values) {
                    const newEmail = values.newEmail || values['new-email-input'] || '';
                    callback(newEmail.trim());
                }
            },
            true,
            false,
            'text',
            formFields
        );
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

});
