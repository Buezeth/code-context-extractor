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

    // --- Handle messages FROM the extension ---
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'update-rules') {
            const rules = message.rules;
            populateRulesList(rules);

            // If rules were loaded, show the next steps
            if (rules && rules.length > 0) {
                refineSection.classList.remove('hidden');
                generateSection.classList.remove('hidden');
            } else {
                // If no rules (e.g., user cancelled), hide the sections
                refineSection.classList.add('hidden');
                generateSection.classList.add('hidden');
            }
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

    addRuleBtn.addEventListener('click', () => {
        const newRule = newRuleInput.value.trim();
        if (newRule) {
            const ruleItem = createRuleItem(newRule, true);
            rulesContainer.appendChild(ruleItem);
            newRuleInput.value = '';
            updateSelectAllState();
        }
    });

    // --- Event Listeners for checkboxes ---
    selectAllCb.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const checkboxes = rulesContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = isChecked);
    });

    rulesContainer.addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"]')) {
            updateSelectAllState();
        }
    });

    // --- Helper Functions ---
    function createRuleItem(rule, isChecked) {
        const ruleItem = document.createElement('div');
        ruleItem.className = 'rule-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = rule;
        checkbox.value = rule;
        checkbox.checked = isChecked;
        const label = document.createElement('label');
        label.htmlFor = rule;
        label.textContent = rule;
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
            const ruleItem = createRuleItem(rule, true);
            rulesContainer.appendChild(ruleItem);
        });
        selectAllCb.checked = true;
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