// media/main.js
(function () {
    const vscode = acquireVsCodeApi();

    const loadTemplateBtn = document.getElementById('load-template-btn');
    const generateBtn = document.getElementById('generate-btn');
    const rulesContainer = document.getElementById('rules-container');

    // Handle messages FROM the extension
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'update-rules') {
            updateRulesList(message.rules);
        }
    });

    // Tell the extension to load templates
    loadTemplateBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'load-template' });
    });

    // Tell the extension to generate the context file with the selected rules
    generateBtn.addEventListener('click', () => {
        const selectedRules = [];
        const checkboxes = rulesContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            if (cb.checked) {
                selectedRules.push(cb.value);
            }
        });

        vscode.postMessage({
            type: 'generate',
            rules: selectedRules
        });
    });

    // Function to build the checkbox list
    function updateRulesList(rules) {
        rulesContainer.innerHTML = ''; // Clear existing rules

        if (!rules || rules.length === 0) {
            return;
        }

        const heading = document.createElement('h4');
        heading.textContent = 'Select rules to apply:';
        rulesContainer.appendChild(heading);

        rules.forEach(rule => {
            const ruleItem = document.createElement('div');
            ruleItem.className = 'rule-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = rule;
            checkbox.value = rule;
            checkbox.checked = true; // Default to checked

            const label = document.createElement('label');
            label.htmlFor = rule;
            label.textContent = rule;

            ruleItem.appendChild(checkbox);
            ruleItem.appendChild(label);
            rulesContainer.appendChild(ruleItem);
        });
    }
}());