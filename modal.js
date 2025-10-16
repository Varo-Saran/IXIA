(function (global) {
    'use strict';

    const FOCUSABLE_SELECTORS = [
        'a[href]',
        'area[href]',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'button:not([disabled])',
        'iframe',
        'object',
        'embed',
        '[contenteditable]',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const controllers = new WeakMap();
    const defaults = {
        display: 'flex',
        closeSelectors: ['.modal-overlay', '.modal-close', '[data-modal-dismiss]'],
        initialFocus: null,
        returnFocus: true,
        focusTrap: true,
        escapeCloses: true,
        animationDuration: null,
        hooks: {}
    };

    function toMilliseconds(value) {
        if (!value) {
            return 0;
        }
        return value
            .split(',')
            .map(part => part.trim())
            .reduce((max, part) => {
                if (!part) {
                    return max;
                }
                let numeric = parseFloat(part);
                if (Number.isNaN(numeric)) {
                    return max;
                }
                if (part.endsWith('ms')) {
                    return Math.max(max, numeric);
                }
                if (part.endsWith('s')) {
                    return Math.max(max, numeric * 1000);
                }
                return max;
            }, 0);
    }

    function getAnimationDuration(modal, fallback) {
        const computed = window.getComputedStyle(modal);
        const transition = toMilliseconds(computed.transitionDuration || '');
        const animation = toMilliseconds(computed.animationDuration || '');
        const fromVar = toMilliseconds(getComputedStyle(document.documentElement).getPropertyValue('--modal-transition-duration') || '');
        const maxDuration = Math.max(transition, animation, fromVar);
        if (maxDuration > 0) {
            return maxDuration;
        }
        return typeof fallback === 'number' ? fallback : 240;
    }

    function isFocusable(element) {
        if (!(element instanceof HTMLElement)) {
            return false;
        }
        if (element.matches('[disabled]')) {
            return false;
        }
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
            return false;
        }
        return element.tabIndex !== -1;
    }

    function getFocusableElements(modal) {
        return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTORS)).filter(isFocusable);
    }

    function runHook(state, name, payload) {
        const hooks = state.hooks || {};
        const hook = hooks[name];
        if (typeof hook === 'function') {
            return hook({
                controller: state.api,
                modal: state.modal,
                context: state.context,
                reason: payload ? payload.reason : undefined,
                stage: payload ? payload.stage : undefined,
                event: payload ? payload.event : undefined,
                data: payload ? payload.data : undefined,
                options: payload ? payload.options : undefined
            });
        }
        return undefined;
    }

    function disableScroll(state) {
        if (state.scrollLocked) {
            return;
        }
        state.scrollLocked = true;
        state.lastScroll = window.scrollY || document.documentElement.scrollTop || 0;
        state.previousBodyStyles = {
            position: document.body.style.position,
            top: document.body.style.top,
            width: document.body.style.width,
            overflowY: document.body.style.overflowY
        };
        document.body.style.position = 'fixed';
        document.body.style.top = `-${state.lastScroll}px`;
        document.body.style.width = '100%';
        document.body.style.overflowY = 'hidden';
        document.body.classList.add('modal-scroll-locked');
        document.body.classList.add('modal-open');

        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
            document.documentElement.style.setProperty('--modal-scrollbar-width', `${scrollbarWidth}px`);
        }
    }

    function enableScroll(state) {
        if (!state.scrollLocked) {
            return;
        }
        state.scrollLocked = false;
        const styles = state.previousBodyStyles || {};
        document.body.style.position = styles.position || '';
        document.body.style.top = styles.top || '';
        document.body.style.width = styles.width || '';
        document.body.style.overflowY = styles.overflowY || '';
        document.body.classList.remove('modal-scroll-locked');
        document.body.classList.remove('modal-open');
        document.documentElement.style.removeProperty('--modal-scrollbar-width');
        window.scrollTo(0, state.lastScroll || 0);
    }

    function resolveInitialFocus(modal, initialFocus) {
        if (!initialFocus) {
            const focusable = getFocusableElements(modal);
            return focusable[0] || null;
        }
        if (typeof initialFocus === 'string') {
            return modal.querySelector(initialFocus);
        }
        if (initialFocus instanceof HTMLElement) {
            return initialFocus;
        }
        return null;
    }

    function create(modal, options) {
        if (!modal) {
            throw new Error('Modal element is required to create a controller.');
        }

        if (controllers.has(modal)) {
            return controllers.get(modal);
        }

        const config = Object.assign({}, defaults, options || {});
        const state = {
            modal,
            config,
            hooks: Object.assign({}, config.hooks),
            context: {},
            active: false,
            scrollLocked: false,
            lastScroll: 0,
            previousBodyStyles: null,
            previouslyFocused: null,
            api: null
        };

        function handleKeydown(event) {
            if (!state.active || !state.config.focusTrap) {
                if (state.config.escapeCloses && event.key === 'Escape' && state.active) {
                    event.preventDefault();
                    state.api.close({ reason: 'escape', event });
                }
                return;
            }

            if (event.key === 'Escape' && state.config.escapeCloses) {
                event.preventDefault();
                state.api.close({ reason: 'escape', event });
                return;
            }

            if (event.key !== 'Tab') {
                return;
            }

            const focusable = getFocusableElements(modal);
            if (focusable.length === 0) {
                event.preventDefault();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const activeElement = document.activeElement;

            if (event.shiftKey) {
                if (activeElement === first || !modal.contains(activeElement)) {
                    event.preventDefault();
                    last.focus({ preventScroll: true });
                }
            } else if (activeElement === last) {
                event.preventDefault();
                first.focus({ preventScroll: true });
            }
        }

        function handleFocusIn(event) {
            if (!state.active || !state.config.focusTrap) {
                return;
            }
            if (!modal.contains(event.target)) {
                const focusTarget = resolveInitialFocus(modal, state.currentOptions && state.currentOptions.initialFocus);
                if (focusTarget) {
                    focusTarget.focus({ preventScroll: true });
                } else if (state.previouslyFocused instanceof HTMLElement) {
                    state.previouslyFocused.focus({ preventScroll: true });
                }
            }
        }

        function handlePointer(event) {
            if (!state.active) {
                return;
            }
            const selectors = state.config.closeSelectors || [];
            if (selectors.length === 0) {
                return;
            }
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }
            const shouldClose = selectors.some(selector => {
                try {
                    return target.matches(selector) || Boolean(target.closest(selector));
                } catch (error) {
                    console.warn('Invalid close selector provided to ModalController:', selector, error);
                    return false;
                }
            });
            if (shouldClose) {
                if (event.type === 'click') {
                    event.preventDefault();
                }
                state.api.close({ reason: 'dismiss', event, trigger: target });
            }
        }

        const api = {
            open(openOptions) {
                const mergedOptions = Object.assign({
                    initialFocus: config.initialFocus,
                    returnFocus: config.returnFocus,
                    context: {},
                    hooks: {}
                }, openOptions || {});

                state.currentOptions = mergedOptions;
                state.hooks = Object.assign({}, config.hooks, mergedOptions.hooks || {});
                state.context = Object.assign({}, mergedOptions.context || {});

                const beforeOpenResult = runHook(state, 'beforeOpen', { options: mergedOptions });
                if (beforeOpenResult === false) {
                    state.context = {};
                    return api;
                }

                if (state.active) {
                    return api;
                }

                state.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                disableScroll(state);

                const display = mergedOptions.display || config.display;
                modal.style.display = display;
                modal.setAttribute('aria-hidden', 'false');
                modal.classList.add('is-open');
                modal.classList.remove('is-closing');
                modal.removeAttribute('data-modal-exit');
                modal.dataset.modalState = 'opening';

                requestAnimationFrame(() => {
                    modal.classList.add('is-active');
                    modal.dataset.modalState = 'open';
                });

                state.active = true;
                document.addEventListener('keydown', handleKeydown, true);
                document.addEventListener('focusin', handleFocusIn, true);
                modal.addEventListener('click', handlePointer, true);

                const focusTarget = resolveInitialFocus(modal, mergedOptions.initialFocus);
                if (focusTarget) {
                    focusTarget.focus({ preventScroll: true });
                }

                runHook(state, 'afterOpen', { options: mergedOptions, stage: 'open' });
                runHook(state, 'toast', { stage: 'open' });
                runHook(state, 'cropper', { stage: 'open' });
                modal.dispatchEvent(new CustomEvent('modal:opened', {
                    detail: {
                        controller: api,
                        context: state.context
                    }
                }));
                return api;
            },
            close(detail) {
                if (!state.active) {
                    return api;
                }

                const closeDetail = Object.assign({ reason: 'dismiss' }, detail || {});
                const beforeCloseResult = runHook(state, 'beforeClose', closeDetail);
                if (beforeCloseResult === false) {
                    return api;
                }

                document.removeEventListener('keydown', handleKeydown, true);
                document.removeEventListener('focusin', handleFocusIn, true);
                modal.removeEventListener('click', handlePointer, true);

                modal.classList.add('is-closing');
                modal.classList.remove('is-open');
                modal.dataset.modalState = 'closing';
                modal.setAttribute('aria-hidden', 'true');
                modal.dataset.modalExitReason = closeDetail.reason;
                runHook(state, 'toast', { stage: 'beforeClose', reason: closeDetail.reason });
                runHook(state, 'cropper', { stage: 'beforeClose', reason: closeDetail.reason });

                const duration = getAnimationDuration(modal, config.animationDuration);
                window.setTimeout(() => {
                    modal.style.display = 'none';
                    modal.classList.remove('is-active');
                    modal.removeAttribute('data-modal-state');
                    modal.removeAttribute('data-modal-exit');
                    modal.classList.remove('is-closing');
                    enableScroll(state);
                    state.active = false;
                    const shouldReturnFocus = closeDetail.returnFocus !== false && (state.currentOptions ? state.currentOptions.returnFocus : config.returnFocus);
                    if (shouldReturnFocus && state.previouslyFocused instanceof HTMLElement) {
                        state.previouslyFocused.focus({ preventScroll: true });
                    }
                    const payload = Object.assign({}, closeDetail, {
                        controller: api,
                        context: state.context
                    });
                    runHook(state, 'afterClose', payload);
                    runHook(state, 'toast', { stage: 'closed', reason: closeDetail.reason });
                    runHook(state, 'cropper', { stage: 'closed', reason: closeDetail.reason });
                    modal.dispatchEvent(new CustomEvent('modal:closed', { detail: payload }));
                    state.context = {};
                    state.hooks = Object.assign({}, config.hooks);
                    state.currentOptions = null;
                }, duration);

                return api;
            },
            isOpen() {
                return state.active;
            },
            getContext() {
                return state.context;
            },
            setHooks(newHooks) {
                state.hooks = Object.assign({}, state.hooks, newHooks || {});
                return api;
            },
            runHook(name, payload) {
                return runHook(state, name, payload || {});
            },
            destroy() {
                api.close({ reason: 'destroy', returnFocus: false });
                document.removeEventListener('keydown', handleKeydown, true);
                document.removeEventListener('focusin', handleFocusIn, true);
                modal.removeEventListener('click', handlePointer, true);
                controllers.delete(modal);
            }
        };

        state.api = api;
        controllers.set(modal, api);
        return api;
    }

    function getController(modal) {
        if (!modal) {
            return null;
        }
        return controllers.get(modal) || null;
    }

    global.ModalController = {
        create,
        getController
    };

})(typeof window !== 'undefined' ? window : this);
