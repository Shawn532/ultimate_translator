// Excel Translator - Core Logic

// Language mapping (same as content.js)
const LANGUAGE_MAP = {
    'chinese_simplified': 'zh-CN',
    'chinese_traditional': 'zh-TW',
    'english': 'en',
    'spanish': 'es',
    'french': 'fr',
    'german': 'de',
    'japanese': 'ja',
    'korean': 'ko',
    'russian': 'ru',
    'arabic': 'ar',
    'portuguese': 'pt',
    'italian': 'it',
    'dutch': 'nl',
    'polish': 'pl',
    'turkish': 'tr',
    'vietnamese': 'vi',
    'hindi': 'hi',
    'hebrew': 'he',
    'thai': 'th',
    'indonesian': 'id'
};

// Global state
let workbook = null;
let translatedWorkbook = null;
let selectedFile = null;
let sheetColumnsMap = new Map(); // Map of sheet name -> column info

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const changeFileBtn = document.getElementById('changeFileBtn');
const settingsCard = document.getElementById('settingsCard');
const sheetsList = document.getElementById('sheetsList');
const translateBtn = document.getElementById('translateBtn');
const progressCard = document.getElementById('progressCard');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const progressDetail = document.getElementById('progressDetail');
const resultCard = document.getElementById('resultCard');
const previewTabs = document.getElementById('previewTabs');
const previewContent = document.getElementById('previewContent');
const downloadBtn = document.getElementById('downloadBtn');
const startOverBtn = document.getElementById('startOverBtn');
const columnSelectionGroup = document.getElementById('columnSelectionGroup');
const columnSelectionContainer = document.getElementById('columnSelectionContainer');

// Initialize
init();

function init() {
    // Upload area click
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Change file button
    changeFileBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // Translate button
    translateBtn.addEventListener('click', startTranslation);

    // Download button
    downloadBtn.addEventListener('click', downloadTranslatedFile);

    // Start over button
    startOverBtn.addEventListener('click', resetApp);
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

async function handleFile(file) {
    // Validate file type
    const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
        alert('Please select a valid Excel file (.xlsx or .xls)');
        return;
    }

    selectedFile = file;

    // Show file info
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    uploadArea.style.display = 'none';
    fileInfo.style.display = 'flex';

    // Read Excel file
    try {
        const data = await readExcelFile(file);
        workbook = data;

        // Show settings card
        settingsCard.style.display = 'block';

        // Populate sheets list
        populateSheetsList(workbook.SheetNames);

        // Scroll to settings
        settingsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
        alert('Error reading Excel file: ' + error.message);
        console.error(error);
    }
}

function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                resolve(workbook);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsArrayBuffer(file);
    });
}

function populateSheetsList(sheetNames) {
    sheetsList.innerHTML = '';
    sheetColumnsMap.clear();

    sheetNames.forEach((name, index) => {
        const item = document.createElement('div');
        item.className = 'sheet-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `sheet-${index}`;
        checkbox.value = name;
        checkbox.checked = true; // All sheets selected by default

        const label = document.createElement('label');
        label.htmlFor = `sheet-${index}`;
        label.textContent = name;

        item.appendChild(checkbox);
        item.appendChild(label);
        sheetsList.appendChild(item);

        // Detect columns for this sheet
        detectSheetColumns(name);

        // Listen for checkbox changes to update column selection display
        checkbox.addEventListener('change', updateColumnSelectionDisplay);
    });

    // Initial display of column selection
    updateColumnSelectionDisplay();
}

function detectSheetColumns(sheetName) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (data.length === 0) {
        sheetColumnsMap.set(sheetName, []);
        return;
    }

    // Get first row for preview
    const firstRow = data[0] || [];
    const columns = [];

    firstRow.forEach((cellValue, colIndex) => {
        const columnLetter = XLSX.utils.encode_col(colIndex); // Convert 0 -> A, 1 -> B, etc.
        const preview = cellValue !== null && cellValue !== undefined ? String(cellValue) : '(empty)';

        columns.push({
            index: colIndex,
            letter: columnLetter,
            preview: preview,
            translateHeader: true,  // Translate header (row 1) by default
            translateData: true     // Translate data (row 2+) by default
        });
    });

    sheetColumnsMap.set(sheetName, columns);
}

function updateColumnSelectionDisplay() {
    const selectedSheets = getSelectedSheets();

    if (selectedSheets.length === 0) {
        columnSelectionGroup.style.display = 'none';
        return;
    }

    columnSelectionGroup.style.display = 'block';
    columnSelectionContainer.innerHTML = '';

    selectedSheets.forEach(sheetName => {
        const columns = sheetColumnsMap.get(sheetName);

        if (!columns || columns.length === 0) {
            return;
        }

        // Create column section for this sheet
        const section = document.createElement('div');
        section.className = 'column-section';

        const header = document.createElement('div');
        header.className = 'column-section-header';
        header.innerHTML = `
            <span>📋 ${sheetName}</span>
            <div class="column-actions">
                <button class="btn-small" onclick="selectAllColumns('${sheetName}')">Select All</button>
                <button class="btn-small" onclick="deselectAllColumns('${sheetName}')">Deselect All</button>
            </div>
        `;

        const grid = document.createElement('div');
        grid.className = 'columns-grid';
        grid.id = `columns-${sheetName}`;

        columns.forEach((col, index) => {
            const item = document.createElement('div');
            item.className = 'column-item-wrapper';

            // Column header with preview
            const colHeader = document.createElement('div');
            colHeader.className = 'column-item-header';
            colHeader.innerHTML = `
                <strong>Column ${col.letter}</strong>
                <span class="column-preview-inline">${col.preview}</span>
            `;

            // Translation options
            const options = document.createElement('div');
            options.className = 'column-options';

            // Header checkbox
            const headerLabel = document.createElement('label');
            headerLabel.className = 'option-label';
            const headerCheckbox = document.createElement('input');
            headerCheckbox.type = 'checkbox';
            headerCheckbox.checked = col.translateHeader;
            headerCheckbox.dataset.sheet = sheetName;
            headerCheckbox.dataset.colIndex = col.index;
            headerCheckbox.addEventListener('change', (e) => {
                col.translateHeader = e.target.checked;
            });
            headerLabel.appendChild(headerCheckbox);
            headerLabel.appendChild(document.createTextNode(' Translate Header 翻译表头'));

            // Data checkbox
            const dataLabel = document.createElement('label');
            dataLabel.className = 'option-label';
            const dataCheckbox = document.createElement('input');
            dataCheckbox.type = 'checkbox';
            dataCheckbox.checked = col.translateData;
            dataCheckbox.dataset.sheet = sheetName;
            dataCheckbox.dataset.colIndex = col.index;
            dataCheckbox.addEventListener('change', (e) => {
                col.translateData = e.target.checked;
            });
            dataLabel.appendChild(dataCheckbox);
            dataLabel.appendChild(document.createTextNode(' Translate Data 翻译数据'));

            options.appendChild(headerLabel);
            options.appendChild(dataLabel);

            item.appendChild(colHeader);
            item.appendChild(options);

            grid.appendChild(item);
        });

        section.appendChild(header);
        section.appendChild(grid);
        columnSelectionContainer.appendChild(section);
    });
}

// Helper functions for select/deselect all buttons
window.selectAllColumns = function(sheetName) {
    const columns = sheetColumnsMap.get(sheetName);
    if (!columns) return;

    columns.forEach(col => {
        col.translateHeader = true;
        col.translateData = true;
    });

    // Update UI
    const checkboxes = document.querySelectorAll(`#columns-${sheetName} input[type="checkbox"]`);
    checkboxes.forEach(cb => cb.checked = true);
};

window.deselectAllColumns = function(sheetName) {
    const columns = sheetColumnsMap.get(sheetName);
    if (!columns) return;

    columns.forEach(col => {
        col.translateHeader = false;
        col.translateData = false;
    });

    // Update UI
    const checkboxes = document.querySelectorAll(`#columns-${sheetName} input[type="checkbox"]`);
    checkboxes.forEach(cb => cb.checked = false);
};

function getSelectedSheets() {
    const checkboxes = sheetsList.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function getOutputFormat() {
    const selected = document.querySelector('input[name="outputFormat"]:checked');
    return selected ? selected.value : 'replace';
}

async function startTranslation() {
    const sourceLang = document.getElementById('sourceLang').value;
    const targetLang = document.getElementById('targetLang').value;
    const selectedSheets = getSelectedSheets();
    const outputFormat = getOutputFormat();

    if (selectedSheets.length === 0) {
        alert('Please select at least one sheet to translate');
        return;
    }

    if (sourceLang === targetLang) {
        alert('Source and target languages cannot be the same');
        return;
    }

    // Hide settings, show progress
    settingsCard.style.display = 'none';
    progressCard.style.display = 'block';
    progressCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
        // Create a copy of the workbook
        translatedWorkbook = XLSX.utils.book_new();

        // Translate each selected sheet
        for (let i = 0; i < selectedSheets.length; i++) {
            const sheetName = selectedSheets[i];
            const progress = ((i / selectedSheets.length) * 100).toFixed(0);

            progressText.textContent = `Translating sheet ${i + 1} of ${selectedSheets.length}...`;
            progressDetail.textContent = `Current sheet: ${sheetName}`;
            progressFill.style.width = progress + '%';

            const originalSheet = workbook.Sheets[sheetName];
            const translatedSheet = await translateSheet(
                originalSheet,
                sheetName,
                sourceLang,
                targetLang,
                outputFormat
            );

            XLSX.utils.book_append_sheet(translatedWorkbook, translatedSheet, sheetName);
        }

        // Complete
        progressFill.style.width = '100%';
        progressText.textContent = 'Translation complete!';
        progressDetail.textContent = `Translated ${selectedSheets.length} sheet(s) successfully`;

        // Show result after a short delay
        setTimeout(() => {
            progressCard.style.display = 'none';
            resultCard.style.display = 'block';
            resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            displayPreview(translatedWorkbook);
        }, 1000);

    } catch (error) {
        alert('Translation error: ' + error.message);
        console.error(error);
        resetApp();
    }
}

async function translateSheet(sheet, sheetName, sourceLang, targetLang, outputFormat) {
    // Convert sheet to 2D array
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (data.length === 0) {
        return sheet; // Empty sheet, return as is
    }

    // Get column configuration for this sheet
    const sheetColumns = sheetColumnsMap.get(sheetName) || [];

    // Collect all unique texts for batch translation based on column settings
    const textsToTranslate = new Set();
    const textMap = new Map(); // Original -> Translated mapping

    data.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            const colConfig = sheetColumns.find(col => col.index === colIndex);
            if (!colConfig) return; // Column not in config

            // Determine if this cell should be translated
            const isHeaderRow = (rowIndex === 0);
            const shouldTranslate = isHeaderRow ? colConfig.translateHeader : colConfig.translateData;

            if (shouldTranslate && cell && typeof cell === 'string' && cell.trim()) {
                textsToTranslate.add(cell.trim());
            }
        });
    });

    if (textsToTranslate.size === 0) {
        return sheet; // No text to translate
    }

    // Update progress
    const totalTexts = textsToTranslate.size;
    progressDetail.textContent = `Found ${totalTexts} unique texts to translate...`;

    // Translate in batches (50 texts at a time to avoid overwhelming the API)
    const textsArray = Array.from(textsToTranslate);
    const batchSize = 50;

    for (let i = 0; i < textsArray.length; i += batchSize) {
        const batch = textsArray.slice(i, Math.min(i + batchSize, textsArray.length));

        progressDetail.textContent = `Translating ${i + batch.length} of ${totalTexts} unique texts...`;

        const translations = await translateBatch(batch, sourceLang, targetLang);

        // Store translations in map
        batch.forEach((text, index) => {
            if (translations[index] && translations[index].success) {
                textMap.set(text, translations[index].translation);
            } else {
                textMap.set(text, text); // Keep original if translation fails
            }
        });
    }

    // Apply translations to data based on column settings
    const translatedData = data.map((row, rowIndex) => {
        return row.map((cell, colIndex) => {
            const colConfig = sheetColumns.find(col => col.index === colIndex);
            if (!colConfig) return cell; // Column not in config, keep original

            // Determine if this cell should be translated
            const isHeaderRow = (rowIndex === 0);
            const shouldTranslate = isHeaderRow ? colConfig.translateHeader : colConfig.translateData;

            if (shouldTranslate && cell && typeof cell === 'string' && cell.trim()) {
                const translated = textMap.get(cell.trim()) || cell;

                if (outputFormat === 'bilingual') {
                    return `${cell} | ${translated}`;
                } else {
                    return translated;
                }
            }
            return cell; // Keep original for non-translated cells
        });
    });

    // Convert back to sheet
    return XLSX.utils.aoa_to_sheet(translatedData);
}

async function translateBatch(texts, sourceLang, targetLang) {
    const sourceCode = LANGUAGE_MAP[sourceLang] || 'en';
    const targetCode = LANGUAGE_MAP[targetLang] || 'zh-CN';

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'TRANSLATE_BATCH',
            texts: texts,
            sourceLang: sourceCode,
            targetLang: targetCode
        });

        if (response && response.success && response.translations) {
            return response.translations;
        } else {
            throw new Error('Translation API failed');
        }
    } catch (error) {
        console.error('Translation error:', error);
        // Return original texts if translation fails
        return texts.map(text => ({ success: false, translation: text }));
    }
}

function displayPreview(workbook) {
    // Clear previous preview
    previewTabs.innerHTML = '';
    previewContent.innerHTML = '';

    const sheetNames = workbook.SheetNames;

    // Create tabs for each sheet
    sheetNames.forEach((name, index) => {
        const tab = document.createElement('button');
        tab.className = 'preview-tab' + (index === 0 ? ' active' : '');
        tab.textContent = name;
        tab.addEventListener('click', () => {
            // Update active tab
            document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show sheet preview
            showSheetPreview(workbook.Sheets[name]);
        });
        previewTabs.appendChild(tab);
    });

    // Show first sheet by default
    if (sheetNames.length > 0) {
        showSheetPreview(workbook.Sheets[sheetNames[0]]);
    }
}

function showSheetPreview(sheet) {
    // Convert sheet to HTML table (show first 100 rows)
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const previewData = data.slice(0, 100);

    let html = '<table class="preview-table">';

    previewData.forEach((row, rowIndex) => {
        html += '<tr>';
        row.forEach(cell => {
            const tag = rowIndex === 0 ? 'th' : 'td';
            const cellText = cell !== null && cell !== undefined ? String(cell) : '';
            html += `<${tag}>${escapeHtml(cellText)}</${tag}>`;
        });
        html += '</tr>';
    });

    html += '</table>';

    if (data.length > 100) {
        html += '<p style="text-align: center; margin-top: 10px; color: #666;">Showing first 100 rows</p>';
    }

    previewContent.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function downloadTranslatedFile() {
    if (!translatedWorkbook) {
        alert('No translated file available');
        return;
    }

    // Generate filename
    const originalName = selectedFile.name.replace(/\.(xlsx|xls)$/i, '');
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${originalName}_translated_${timestamp}.xlsx`;

    // Write workbook to file
    XLSX.writeFile(translatedWorkbook, filename);
}

function resetApp() {
    // Reset all state
    workbook = null;
    translatedWorkbook = null;
    selectedFile = null;
    sheetColumnsMap.clear();
    fileInput.value = '';

    // Reset UI
    uploadArea.style.display = 'block';
    fileInfo.style.display = 'none';
    settingsCard.style.display = 'none';
    columnSelectionGroup.style.display = 'none';
    progressCard.style.display = 'none';
    resultCard.style.display = 'none';

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
