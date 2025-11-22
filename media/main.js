// media/main.js
(function () {
    const vscode = acquireVsCodeApi();

    // --- INTERNAL STATE ---
    let appState = {
        mode: 'exclude', 
        excludeRules: [], 
        includeRules: []  
    };

    // --- UI REFERENCES ---
    const btnExclude = document.getElementById('btn-mode-exclude');
    const btnInclude = document.getElementById('btn-mode-include');
    const modeDesc = document.getElementById('mode-description');
    
    const excludeControls = document.getElementById('exclude-controls');
    const includeControls = document.getElementById('include-controls');
    
    const rulesSection = document.getElementById('rules-section');
    const listHeader = document.getElementById('list-header');
    const rulesContainer = document.getElementById('rules-container');
    
    const loadTemplateBtn = document.getElementById('load-template-btn');
    const newRuleInput = document.getElementById('new-rule-input');
    const addRuleBtn = document.getElementById('add-rule-btn');
    const selectAllCb = document.getElementById('select-all-cb');
    const generateBtn = document.getElementById('generate-btn');

    // --- INITIALIZATION ---
    // Tell extension we are ready to receive data
    vscode.postMessage({ type: 'webview-ready' });

    // --- CORE LOGIC ---

    function syncDomToState() {
        const currentRules = [];
        rulesContainer.querySelectorAll('.rule-item').forEach(item => {
            const cb = item.querySelector('input');
            currentRules.push({ value: cb.value, checked: cb.checked });
        });

        if (appState.mode === 'exclude') {
            appState.excludeRules = currentRules;
        } else {
            appState.includeRules = currentRules;
        }
    }

    function renderList() {
        rulesContainer.innerHTML = ''; 
        
        const rulesToRender = appState.mode === 'exclude' 
            ? appState.excludeRules 
            : appState.includeRules;

        if (!rulesToRender || rulesToRender.length === 0) {
            if (appState.mode === 'exclude') {
                rulesSection.classList.add('hidden');
            } else {
                rulesSection.classList.remove('hidden');
            }
        } else {
            rulesSection.classList.remove('hidden');
            rulesToRender.forEach(rule => {
                rulesContainer.appendChild(createRuleItem(rule.value, rule.checked));
            });
        }
        
        // Update checkboxes and button state
        updateSelectAllState();
        updateGenerateButtonState();
    }

    function updateUiForMode(mode) {
        if (mode === 'exclude') {
            btnExclude.classList.add('active');
            btnInclude.classList.remove('active');
            modeDesc.innerHTML = `<strong>Blacklist:</strong> Everything is included by default. Check items below to <em>exclude</em> them.`;
            excludeControls.classList.remove('hidden');
            includeControls.classList.add('hidden');
            listHeader.textContent = "2. Refine Exclusions";
        } else {
            btnInclude.classList.add('active');
            btnExclude.classList.remove('active');
            modeDesc.innerHTML = `<strong>Whitelist:</strong> Everything is ignored by default. Add items below to <em>include</em> them.`;
            excludeControls.classList.add('hidden');
            includeControls.classList.remove('hidden');
            listHeader.textContent = "2. Whitelist Files";
        }
    }

    function handleModeSwitch(newMode) {
        if (appState.mode === newMode) return;

        syncDomToState();
        appState.mode = newMode;
        updateUiForMode(newMode);
        renderList();
        saveStateToExtension();
    }

    // --- EVENT LISTENERS ---
    btnExclude.addEventListener('click', () => handleModeSwitch('exclude'));
    btnInclude.addEventListener('click', () => handleModeSwitch('include'));

    loadTemplateBtn.addEventListener('click', () => {
        loadTemplateBtn.disabled = true;
        loadTemplateBtn.textContent = 'Loading...';
        vscode.postMessage({ type: 'load-template' });
    });

    function addNewRule() {
        let newRule = newRuleInput.value.trim();
        if (!newRule) return;

        if (newRule.startsWith('.') && !newRule.includes('*') && !newRule.includes('/')) {
            newRule = '*' + newRule;
        }

        if (!document.getElementById(newRule)) {
            const ruleItem = createRuleItem(newRule, true); // Checked by default
            rulesContainer.prepend(ruleItem);
            rulesSection.classList.remove('hidden');
            newRuleInput.value = '';
            
            updateSelectAllState();
            updateGenerateButtonState();
            
            syncDomToState();
            saveStateToExtension();
        }
    }

    addRuleBtn.addEventListener('click', addNewRule);
    newRuleInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addNewRule(); });

    // Individual checkbox change
    rulesContainer.addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"]')) {
            updateSelectAllState();
            updateGenerateButtonState(); // Check if button should be disabled
            syncDomToState();
            saveStateToExtension();
        }
    });

    // Select All change
    selectAllCb.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        rulesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = isChecked);
        
        updateGenerateButtonState(); // Check if button should be disabled
        syncDomToState();
        saveStateToExtension();
    });

    generateBtn.addEventListener('click', () => {
        syncDomToState(); 
        const activeRules = appState.mode === 'exclude' ? appState.excludeRules : appState.includeRules;
        const selectedRules = activeRules.filter(r => r.checked).map(r => r.value);

        vscode.postMessage({ 
            type: 'generate', 
            rules: selectedRules,
            mode: appState.mode
        });
    });

    // --- MESSAGE HANDLING ---
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.type) {
            case 'restore-state':
                if (message.state) {
                    appState = message.state;
                    
                    if (!appState.excludeRules) appState.excludeRules = [];
                    if (!appState.includeRules) appState.includeRules = [];
                    if (!appState.mode) appState.mode = 'exclude';

                    updateUiForMode(appState.mode);
                    renderList();
                }
                break;

            case 'update-rules':
                // From Load Templates
                const { local, template } = message.rules;
                const newRules = [];
                local.forEach(r => newRules.push({ value: r, checked: true }));
                template.rules.forEach(r => newRules.push({ value: r, checked: true }));

                appState.excludeRules = newRules;
                appState.mode = 'exclude';

                loadTemplateBtn.textContent = 'Reload Rules';
                loadTemplateBtn.disabled = false;

                updateUiForMode('exclude');
                renderList();
                saveStateToExtension();
                break;
        }
    });

    function saveStateToExtension() {
        vscode.postMessage({
            type: 'save-state',
            state: appState 
        });
    }

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

    function updateSelectAllState() {
        const checkboxes = rulesContainer.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length === 0) return;
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        selectAllCb.checked = allChecked;
    }

    // --- NEW HELPER FOR BUTTON STATE ---
    function updateGenerateButtonState() {
        const checkedBoxes = rulesContainer.querySelectorAll('input[type="checkbox"]:checked');
        const count = checkedBoxes.length;

        if (count === 0) {
            generateBtn.disabled = true;
            generateBtn.title = "Please select at least one item to generate";
        } else {
            generateBtn.disabled = false;
            generateBtn.title = "";
        }
    }
}());