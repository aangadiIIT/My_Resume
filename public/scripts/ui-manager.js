/**
 * UIManager (Staff+ v1)
 * Central Hub for Floating UI State & Mutual Exclusion
 */
const UIManager = {
    // List of component IDs for mutual exclusion
    components: {
        chat: { id: 'chatWindow', close: () => typeof toggleChat === 'function' && document.getElementById('chatWindow')?.classList.contains('active') && toggleChat() },
        palette: { id: 'cmdPaletteBackdrop', close: () => typeof CommandPalette !== 'undefined' && CommandPalette.active && CommandPalette.close() },
        metrics: { id: 'metricsDashboard', close: () => typeof toggleDashboard === 'function' && document.getElementById('metricsDashboard')?.classList.contains('active') && toggleDashboard() },
        hiring: { id: 'hiringPopup', close: () => typeof closeHiringPopup === 'function' && document.getElementById('hiringPopup')?.classList.contains('active') && closeHiringPopup() },
        fab: { id: 'recruiterFab', close: () => document.getElementById('recruiterFab')?.classList.remove('active') },
        feedback: { id: 'feedbackPopup', close: () => typeof closeFeedbackPopup === 'function' && document.getElementById('feedbackPopup')?.classList.contains('active') && closeFeedbackPopup() }
    },

    // Elements that should NOT trigger a "close all" when clicked (toggles)
    toggles: new Set([
        'chatToggle', 'closeChatBtn', 'maximizeChatBtn',
        'metricsToggle', 'metricsDashboard',
        'recruiterFabMainBtn', 'fabWhyBtn', 'fabContactBtn',
        'theme-toggle', 'closeFeedbackBtn', 'maybeLaterBtn', 'closeHiringBtn'
    ]),

    init() {
        this.bindEvents();
    },

    /**
     * Closes all floating components except the one specified
     * @param {string} except - The key from this.components to skip
     */
    closeAll(except = null) {
        Object.keys(this.components).forEach(key => {
            if (key !== except) {
                try {
                    this.components[key].close();
                } catch (e) {
                    console.warn(`UIManager: Failed to close ${key}`, e);
                }
            }
        });
    },

    bindEvents() {
        // Global Escape Key listener
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAll();
        });

        // Global Click Outside listener
        document.addEventListener('click', (e) => {
            // If the palette is active, it handles its own backdrop click
            if (typeof CommandPalette !== 'undefined' && CommandPalette.active) return;

            // Check if click is on a toggle or inside an active component
            const target = e.target;
            const isToggle = Array.from(this.toggles).some(id => {
                const el = document.getElementById(id);
                return el && (el === target || el.contains(target));
            });

            const isInsideComponent = Object.values(this.components).some(comp => {
                const el = document.getElementById(comp.id);
                return el && el.contains(target);
            });

            if (!isToggle && !isInsideComponent) {
                this.closeAll();
            }
        }, true); // Use capture phase to ensure it runs before specific listeners if needed
    }
};

document.addEventListener('DOMContentLoaded', () => UIManager.init());
