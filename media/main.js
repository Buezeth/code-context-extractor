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
            case 'update-rules': {
                const rules = message.rules.map(rule => ({ value: rule, checked: true }));
                populateRulesList(rules);

                if (rules.length > 0) {
                    refineSection.classList.remove('hidden');
                    generateSection.classList.remove('hidden');
                } else {
                    refineSection.classList.add('hidden');
                    generateSection.classList.add('hidden');
                }
                
                // --- Re-enable the button and restore its text ---
                loadTemplateBtn.disabled = false;
                loadTemplateBtn.textContent = 'Load / Refresh Ignore Rules';

                saveState();
                break;
            }
            case 'restore-state': {
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
        }
    });

    // --- Event Listeners for buttons ---
    loadTemplateBtn.addEventListener('click', () => {
        // --- Disable the button and show loading text ---
        loadTemplateBtn.disabled = true;
        loadTemplateBtn.textContent = 'Loading templates...';
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
            if (!document.getElementById(newRule)) {
                const ruleItem = createRuleItem(newRule, true);
                rulesContainer.appendChild(ruleItem);
                newRuleInput.value = '';
                updateSelectAllState();
                saveState();
            } else {
                newRuleInput.value = '';
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
        saveState();
    });

    rulesContainer.addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"]')) {
            updateSelectAllState();
            saveState();
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