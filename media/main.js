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
                const { local, template } = message.rules;
                const state = {
                    local: local.map(r => ({ value: r, checked: true })),
                    template: {
                        name: template.name,
                        rules: template.rules.map(r => ({ value: r, checked: true }))
                    },
                    custom: [] // Start with no custom rules on a fresh load
                };
                populateRulesList(state);
                if (state.local.length > 0 || state.template.rules.length > 0) {
                    refineSection.classList.remove('hidden');
                    generateSection.classList.remove('hidden');
                } else {
                    refineSection.classList.add('hidden');
                    generateSection.classList.add('hidden');
                }
                loadTemplateBtn.disabled = false;
                loadTemplateBtn.textContent = 'Load / Refresh Ignore Rules';
                saveState();
                break;
            }
            case 'restore-state': {
                const state = message.state;
                if (state) {
                    populateRulesList(state);
                    if (state.isVisible) {
                        refineSection.classList.remove('hidden');
                        generateSection.classList.remove('hidden');
                    } else {
                        refineSection.classList.add('hidden');
                        generateSection.classList.add('hidden');
                    }
                }
                break;
            }
        }
    });

    // --- Event Listeners ---
    loadTemplateBtn.addEventListener('click', () => {
        loadTemplateBtn.disabled = true;
        loadTemplateBtn.textContent = 'Loading templates...';
        vscode.postMessage({ type: 'load-template' });
    });

    generateBtn.addEventListener('click', () => {
        const selectedRules = [];
        const checkboxes = rulesContainer.querySelectorAll('input[type="checkbox"]:checked');
        checkboxes.forEach(cb => selectedRules.push(cb.value));
        vscode.postMessage({ type: 'generate', rules: selectedRules });
    });

    function addNewRule() {
        let newRule = newRuleInput.value.trim();
        if (newRule) {
            if (newRule.startsWith('.') && !newRule.includes('*') && !newRule.includes('/')) {
                newRule = '*' + newRule;
            }
            
            // --- FIX: Check if an element with this ID already exists ---
            if (!document.getElementById(newRule)) {
                const ruleItem = createRuleItem(newRule, true);
                // Ensure the custom list container exists
                let customList = document.getElementById('custom-rules-list');
                if (!customList) {
                    const header = document.createElement('h4');
                    header.className = 'rules-category-header';
                    header.textContent = 'Custom Rules';
                    rulesContainer.appendChild(header);
                    customList = document.createElement('div');
                    customList.id = 'custom-rules-list';
                    rulesContainer.appendChild(customList);
                }
                customList.appendChild(ruleItem);
                
                updateSelectAllState();
                saveState(); // Save state after adding a rule
            }
            // Clear the input field whether the rule was added or not
            newRuleInput.value = '';
        }
    }

    addRuleBtn.addEventListener('click', addNewRule);
    newRuleInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addNewRule();
        }
    });

    selectAllCb.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        rulesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = isChecked);
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
        checkbox.id = ruleValue; // Use the rule itself as the ID for easy lookup
        checkbox.value = ruleValue;
        checkbox.checked = isChecked;
        const label = document.createElement('label');
        label.htmlFor = ruleValue;
        label.textContent = ruleValue;
        ruleItem.appendChild(checkbox);
        ruleItem.appendChild(label);
        return ruleItem;
    }

    function populateRulesList(state) {
        rulesContainer.innerHTML = '';
        let hasContent = false;

        // Render local rules
        if (state.local && state.local.length > 0) {
            hasContent = true;
            const header = document.createElement('h4');
            header.className = 'rules-category-header';
            header.textContent = 'From .gitignore & Settings';
            const listDiv = document.createElement('div');
            listDiv.id = 'local-rules-list';
            state.local.forEach(rule => listDiv.appendChild(createRuleItem(rule.value, rule.checked)));
            rulesContainer.appendChild(header);
            rulesContainer.appendChild(listDiv);
        }
        
        // Render template rules
        if (state.template && state.template.rules.length > 0) {
            hasContent = true;
            const header = document.createElement('h4');
            header.className = 'rules-category-header';
            header.id = 'template-rules-header';
            header.textContent = `From Template (${state.template.name})`;
            header.dataset.templateName = state.template.name;
            const listDiv = document.createElement('div');
            listDiv.id = 'template-rules-list';
            state.template.rules.forEach(rule => listDiv.appendChild(createRuleItem(rule.value, rule.checked)));
            rulesContainer.appendChild(header);
            rulesContainer.appendChild(listDiv);
        }

        // Render custom rules
        if (state.custom && state.custom.length > 0) {
            hasContent = true;
            const header = document.createElement('h4');
            header.className = 'rules-category-header';
            header.textContent = 'Custom Rules';
            const listDiv = document.createElement('div');
            listDiv.id = 'custom-rules-list';
            state.custom.forEach(rule => listDiv.appendChild(createRuleItem(rule.value, rule.checked)));
            rulesContainer.appendChild(header);
            rulesContainer.appendChild(listDiv);
        }
        
        if (!hasContent) {
            selectAllCb.checked = false;
            return;
        }

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