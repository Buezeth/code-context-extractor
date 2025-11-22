// media/main.js
(function () {
    const vscode = acquireVsCodeApi();

    // --- INTERNAL STATE ---
    let appState = {
        mode: 'exclude', 
        // Rules now look like: { value: 'node_modules', checked: true, category: 'imported' | 'custom' }
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
    const selectAllContainer = document.getElementById('select-all-container'); // Global select all
    
    const loadTemplateBtn = document.getElementById('load-template-btn');
    const newRuleInput = document.getElementById('new-rule-input');
    const addRuleBtn = document.getElementById('add-rule-btn');
    const selectAllCb = document.getElementById('select-all-cb');
    const generateBtn = document.getElementById('generate-btn');

    // --- INITIALIZATION ---
    vscode.postMessage({ type: 'webview-ready' });

    // --- CORE LOGIC ---

    /**
     * Scrapes DOM to update State.
     * Logic differs for Exclude (Grouped) vs Include (Flat).
     */
    function syncDomToState() {
        if (appState.mode === 'include') {
            // Include mode is still a flat list
            const currentRules = [];
            rulesContainer.querySelectorAll('.rule-item').forEach(item => {
                const cb = item.querySelector('.rule-cb');
                currentRules.push({ value: cb.value, checked: cb.checked, category: 'custom' });
            });
            appState.includeRules = currentRules;
        } else {
            // Exclude mode is grouped. We need to preserve the category.
            const currentRules = [];
            // We can grab all inputs, their category is stored in a data attribute on the item
            rulesContainer.querySelectorAll('.rule-item').forEach(item => {
                const cb = item.querySelector('.rule-cb');
                const category = item.dataset.category || 'custom';
                currentRules.push({ value: cb.value, checked: cb.checked, category: category });
            });
            appState.excludeRules = currentRules;
        }
    }

    /**
     * Renders the list. 
     * If Exclude Mode -> Renders 2 Accordions (Imported, Custom).
     * If Include Mode -> Renders Flat List.
     */
    function renderList() {
        rulesContainer.innerHTML = ''; 
        
        if (appState.mode === 'include') {
            // --- INCLUDE MODE (FLAT) ---
            selectAllContainer.classList.remove('global-select-all-hidden'); // Show global select all
            
            if (appState.includeRules.length > 0) {
                rulesSection.classList.remove('hidden');
                appState.includeRules.forEach(rule => {
                    rulesContainer.appendChild(createRuleItem(rule.value, rule.checked, 'custom'));
                });
            } else {
                rulesSection.classList.remove('hidden'); // Keep visible so they can add
            }

        } else {
            // --- EXCLUDE MODE (GROUPED) ---
            selectAllContainer.classList.add('global-select-all-hidden'); // Hide global select all, use group ones

            const importedRules = appState.excludeRules.filter(r => r.category === 'imported');
            const customRules = appState.excludeRules.filter(r => r.category !== 'imported'); // Default to custom

            let hasContent = false;

            if (importedRules.length > 0) {
                const group = createCategoryGroup('Imported Rules (.gitignore/Template)', importedRules);
                rulesContainer.appendChild(group);
                hasContent = true;
            }

            if (customRules.length > 0) {
                const group = createCategoryGroup('Custom Rules', customRules);
                rulesContainer.appendChild(group);
                hasContent = true;
            }

            // Only show section if we have data or if we want to allow adding
            if (hasContent || customRules.length === 0) {
                 // Even if empty, show section so user can add custom rules
                rulesSection.classList.remove('hidden');
            } else {
                rulesSection.classList.add('hidden');
            }
        }
        
        updateGenerateButtonState();
        // Update global select all for Include mode
        if (appState.mode === 'include') updateGlobalSelectAllState();
    }

    /**
     * Creates a collapsible accordion DOM element
     */
    function createCategoryGroup(title, rules) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'category-group expanded'; // Default expanded

        // HEADER
        const header = document.createElement('div');
        header.className = 'category-header';
        
        // Collapse Icon
        const icon = document.createElement('span');
        icon.className = 'category-toggle-icon';
        icon.textContent = '▶'; 
        
        // Title
        const titleSpan = document.createElement('span');
        titleSpan.className = 'category-title';
        titleSpan.textContent = title;

        // Group Select All
        const groupCb = document.createElement('input');
        groupCb.type = 'checkbox';
        groupCb.className = 'category-checkbox';
        groupCb.title = 'Select/Deselect All in Group';
        
        // Logic for initial Group Checkbox state
        const allChecked = rules.every(r => r.checked);
        const someChecked = rules.some(r => r.checked);
        groupCb.checked = allChecked;
        groupCb.indeterminate = someChecked && !allChecked;

        // EVENT: Toggle Collapse
        header.addEventListener('click', (e) => {
            if (e.target !== groupCb) {
                groupDiv.classList.toggle('expanded');
            }
        });

        // EVENT: Group Select All
        groupCb.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const contentDiv = groupDiv.querySelector('.category-content');
            contentDiv.querySelectorAll('.rule-cb').forEach(cb => {
                cb.checked = isChecked;
            });
            syncDomToState();
            saveStateToExtension();
            updateGenerateButtonState();
        });

        header.appendChild(icon);
        header.appendChild(titleSpan);
        header.appendChild(groupCb);

        // CONTENT
        const content = document.createElement('div');
        content.className = 'category-content';
        
        rules.forEach(rule => {
            content.appendChild(createRuleItem(rule.value, rule.checked, rule.category));
        });

        groupDiv.appendChild(header);
        groupDiv.appendChild(content);

        return groupDiv;
    }

    // --- NEW: Delete Logic ---
    function deleteRule(valueToDelete) {
        // 1. Sync current checkbox states so we don't lose checkmarks on other items
        syncDomToState();

        // 2. Filter out the item
        if (appState.mode === 'include') {
            appState.includeRules = appState.includeRules.filter(r => r.value !== valueToDelete);
        } else {
            appState.excludeRules = appState.excludeRules.filter(r => r.value !== valueToDelete);
        }

        // 3. Re-render
        renderList();
        saveStateToExtension();
    }

    // --- UPDATED: Create Rule Item ---
    function createRuleItem(ruleValue, isChecked, category) {
        const ruleItem = document.createElement('div');
        ruleItem.className = 'rule-item';
        ruleItem.dataset.category = category;

        // 1. Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'rule-cb';
        checkbox.id = ruleValue;
        checkbox.value = ruleValue;
        checkbox.checked = isChecked;
        
        // 2. Label
        const label = document.createElement('label');
        label.htmlFor = ruleValue;
        label.textContent = ruleValue;
        label.title = ruleValue; // Tooltip for long paths

        ruleItem.appendChild(checkbox);
        ruleItem.appendChild(label);

        // 3. Delete Button (Condition: Include Mode OR Custom Category)
        if (appState.mode === 'include' || category === 'custom') {
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '&times;'; // The "X" symbol
            delBtn.title = 'Remove this rule';
            
            delBtn.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent triggering label click
                deleteRule(ruleValue);
            });

            ruleItem.appendChild(delBtn);
        }

        return ruleItem;
    }

    // --- UI HELPERS ---

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

    // --- ACTIONS ---

    function handleModeSwitch(newMode) {
        if (appState.mode === newMode) return;
        syncDomToState();
        appState.mode = newMode;
        updateUiForMode(newMode);
        renderList();
        saveStateToExtension();
    }

    function addNewRule() {
        let newRule = newRuleInput.value.trim();
        if (!newRule) return;

        // Auto format
        if (newRule.startsWith('.') && !newRule.includes('*') && !newRule.includes('/')) {
            newRule = '*' + newRule;
        }

        // Logic split for Adding
        if (appState.mode === 'include') {
            // Include mode (Flat)
            if (!appState.includeRules.find(r => r.value === newRule)) {
                appState.includeRules.unshift({ value: newRule, checked: true, category: 'custom' });
                renderList();
                saveStateToExtension();
            }
        } else {
            // Exclude mode (Grouped) - Add to Custom
            if (!appState.excludeRules.find(r => r.value === newRule)) {
                appState.excludeRules.unshift({ value: newRule, checked: true, category: 'custom' });
                renderList();
                saveStateToExtension();
            }
        }
        newRuleInput.value = '';
    }

    // --- EVENTS ---

    btnExclude.addEventListener('click', () => handleModeSwitch('exclude'));
    btnInclude.addEventListener('click', () => handleModeSwitch('include'));

    loadTemplateBtn.addEventListener('click', () => {
        loadTemplateBtn.disabled = true;
        loadTemplateBtn.textContent = 'Loading...';
        vscode.postMessage({ type: 'load-template' });
    });

    addRuleBtn.addEventListener('click', addNewRule);
    newRuleInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addNewRule(); });

    // Listener for individual Rule Checkboxes
    rulesContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('rule-cb')) {
            
            // If inside a group, update that group's select all checkbox
            const groupDiv = e.target.closest('.category-group');
            if (groupDiv) {
                const groupCb = groupDiv.querySelector('.category-checkbox');
                const allCbs = groupDiv.querySelectorAll('.rule-cb');
                const allChecked = Array.from(allCbs).every(cb => cb.checked);
                const someChecked = Array.from(allCbs).some(cb => cb.checked);
                groupCb.checked = allChecked;
                groupCb.indeterminate = someChecked && !allChecked;
            }

            updateGenerateButtonState();
            if (appState.mode === 'include') updateGlobalSelectAllState();
            syncDomToState();
            saveStateToExtension();
        }
    });

    // Global Select All (Only used for Include Mode now)
    selectAllCb.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        rulesContainer.querySelectorAll('.rule-cb').forEach(cb => cb.checked = isChecked);
        updateGenerateButtonState();
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

    // --- MESSAGES ---

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'restore-state':
                if (message.state) {
                    appState = message.state;
                    // Defaults
                    if (!appState.excludeRules) appState.excludeRules = [];
                    if (!appState.includeRules) appState.includeRules = [];
                    if (!appState.mode) appState.mode = 'exclude';
                    
                    updateUiForMode(appState.mode);
                    renderList();
                }
                break;

            case 'update-rules':
                // Loading templates (Exclude Mode)
                const { local, template } = message.rules;
                const newRules = [];
                
                // Tag them as 'imported'
                local.forEach(r => newRules.push({ value: r, checked: true, category: 'imported' }));
                template.rules.forEach(r => newRules.push({ value: r, checked: true, category: 'imported' }));
                
                // Preserve existing custom rules? 
                // Currently we overwrite imported, but we should probably keep custom rules user added
                const existingCustom = appState.excludeRules.filter(r => r.category === 'custom');
                appState.excludeRules = [...newRules, ...existingCustom];
                
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
        vscode.postMessage({ type: 'save-state', state: appState });
    }

    function updateGlobalSelectAllState() {
        const checkboxes = rulesContainer.querySelectorAll('.rule-cb');
        if (checkboxes.length === 0) return;
        selectAllCb.checked = Array.from(checkboxes).every(cb => cb.checked);
    }

    function updateGenerateButtonState() {
        const checkedBoxes = rulesContainer.querySelectorAll('.rule-cb:checked');
        const count = checkedBoxes.length;

        if (count === 0) {
            generateBtn.disabled = true;
            generateBtn.title = "Select at least one item";
        } else {
            generateBtn.disabled = false;
            generateBtn.title = "";
        }
    }

}());