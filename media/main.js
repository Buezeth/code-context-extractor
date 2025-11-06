// media/main.js
(function () {
    const vscode = acquireVsCodeApi();

    // --- Get references to all our UI elements ---
    const loadTemplateBtn = document.getElementById('load-template-btn');
    const rulesContainer = document.getElementById('rules-container');
    
    // Section containers
    const refineSection = document.getElementById('refine-section');
    const generateSection = document.getElementById('generate-section');

    // Interactive elements within the sections
    const selectAllCb = document.getElementById('select-all-cb');
    const newRuleInput = document.getElementById('new-rule-input');
    const addRuleBtn = document.getElementById('add-rule-btn');
    const generateBtn = document.getElementById('generate-btn');

    // --- State Management ---

    // NEW: Function to get the current state of the UI
    function getCurrentState() {
        const rules = [];
        const checkboxes = rulesContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            rules.push({
                value: cb.value,
                checked: cb.checked
            });
        });
        return {
            rules: rules,
            isVisible: !refineSection.classList.contains('hidden')
        };
    }

    // NEW: Function to send the current state to the extension to be saved
    function saveState() {
        vscode.postMessage({
            type: 'save-state',
            state: getCurrentState()
        });
    }

    // --- Handle messages FROM the extension ---
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'update-rules':
                // This is triggered by "Load/Refresh" button
                const rules = message.rules.map(rule => ({ value: rule, checked: true }));
                populateRulesList(rules);
                if (rules.length > 0) {
                    refineSection.classList.remove('hidden');
                    generateSection.classList.remove('hidden');
                } else {
                    refineSection.classList.add('hidden');
                    generateSection.classList.add('hidden');
                }
                saveState(); // Save state after loading new rules
                break;
            
            case 'restore-state':
                // This is triggered when the webview becomes visible
                const state = message.state;
                if (state && state.rules) {
                    populateRulesList(state.rules);
                }
                if (state && state.isVisible) {
                    refineSection.classList.remove('hidden');
                    generateSection.classList.remove('hidden');
                } else {
                    refineSection.classList.add('hidden');
                    generateSection.classList.add('hidden');
                }
                break;
        }
    });

    // --- Event Listeners for buttons ---
    loadTemplateBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'load-template' });
    });

    generateBtn.addEventListener('click', () => {
        const selectedRules = [];
        const checkboxes = rulesContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            if (cb.checked) {
                selectedRules.push(cb.value);
            }
        });
        vscode.postMessage({ type: 'generate', rules: selectedRules });
    });

    function addNewRule() {
        let newRule = newRuleInput.value.trim();
        if (newRule) {
            if (newRule.startsWith('.') && !newRule.includes('*') && !newRule.includes('/')) {
                newRule = '*' + newRule;
            }
            // Check if rule already exists to avoid duplicates
            if (!document.getElementById(newRule)) {
                const ruleItem = createRuleItem(newRule, true);
                rulesContainer.appendChild(ruleItem);
                newRuleInput.value = '';
                updateSelectAllState();
                saveState(); // Save state after adding a rule
            } else {
                newRuleInput.value = ''; // Clear input even if duplicate
            }
        }
    }

    addRuleBtn.addEventListener('click', addNewRule);
    newRuleInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addNewRule();
        }
    });

    // --- Event Listeners for checkboxes ---
    selectAllCb.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const checkboxes = rulesContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = isChecked);
        saveState(); // Save state after toggling all
    });

    rulesContainer.addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"]')) {
            updateSelectAllState();
            saveState(); // Save state on individual checkbox change
        }
    });

    // --- Helper Functions ---
    function createRuleItem(ruleValue, isChecked) {
        const ruleItem = document.createElement('div');
        ruleItem.className = 'rule-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = ruleValue;
        checkbox.value = ruleValue;
        checkbox.checked = isChecked;
        const label = document.createElement('label');
        label.htmlFor = ruleValue;
        label.textContent = ruleValue;
        ruleItem.appendChild(checkbox);
        ruleItem.appendChild(label);
        return ruleItem;
    }

    function populateRulesList(rules) {
        rulesContainer.innerHTML = '';
        if (!rules || rules.length === 0) {
            selectAllCb.checked = false;
            return;
        }
        rules.forEach(rule => {
            // rule is now an object { value, checked }
            const ruleItem = createRuleItem(rule.value, rule.checked);
            rulesContainer.appendChild(ruleItem);
        });
        updateSelectAllState();
    }

    function updateSelectAllState() {
        const checkboxes = rulesContainer.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length === 0) {
            selectAllCb.checked = false;
            return;
        }
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        selectAllCb.checked = allChecked;
    }
}());