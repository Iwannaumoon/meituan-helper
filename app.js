// Meituan Matcher Core Application Logic

// State Management
const state = {
    cashbackMerchants: new Set(),
    allowanceMerchants: new Set(),
    rawCashbackText: '',
    rawAllowanceText: '',
    theme: 'dark',
    lanIP: '',
    lanPort: ''
};

// DOM Elements
const elements = {
    themeToggle: document.getElementById('theme-toggle'),
    desktopQrPanel: document.getElementById('desktop-qr-panel'),
    lanUrlText: document.getElementById('lan-url-text'),
    qrCodeImg: document.getElementById('qr-code-img'),
    qrLoading: document.getElementById('qr-loading'),
    
    // Cashback
    cashbackFile: document.getElementById('cashback-file'),
    cashbackDropzone: document.getElementById('cashback-dropzone'),
    cashbackPreviews: document.getElementById('cashback-previews'),
    cashbackProgress: document.getElementById('cashback-progress-bar'),
    cashbackListArea: document.getElementById('cashback-list-area'),
    cashbackTags: document.getElementById('cashback-tags'),
    addCashbackInput: document.getElementById('add-cashback-input'),
    addCashbackBtn: document.getElementById('add-cashback-btn'),
    clearCashbackBtn: document.getElementById('clear-cashback-btn'),
    cashbackCount: document.getElementById('cashback-count'),
    
    // Allowance
    allowanceFile: document.getElementById('allowance-file'),
    allowanceDropzone: document.getElementById('allowance-dropzone'),
    allowancePreviews: document.getElementById('allowance-previews'),
    allowanceProgress: document.getElementById('allowance-progress-bar'),
    allowanceListArea: document.getElementById('allowance-list-area'),
    allowanceTags: document.getElementById('allowance-tags'),
    addAllowanceInput: document.getElementById('add-allowance-input'),
    addAllowanceBtn: document.getElementById('add-allowance-btn'),
    clearAllowanceBtn: document.getElementById('clear-allowance-btn'),
    allowanceCount: document.getElementById('allowance-count'),
    
    // Results
    resultsPlaceholder: document.getElementById('results-placeholder'),
    resultsDisplay: document.getElementById('results-display'),
    matchSummaryBadge: document.getElementById('match-summary-badge'),
    
    toast: document.getElementById('toast'),
    toastText: document.getElementById('toast-text')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupTheme();
    setupLanDetection();
    setupDragAndDrop();
    setupManualEntry();
    setupClearButtons();
});

// Reassure user of folders
console.log("美团特惠匹配助手已初始化在 d:\\Projects\\meituan-helper 目录。与您的 anime-tracker 项目完全隔离。");

// 1. Theme Configuration
function setupTheme() {
    // Check local storage or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    state.theme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon();
    
    elements.themeToggle.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('theme', state.theme);
        updateThemeIcon();
    });
}

function updateThemeIcon() {
    const icon = elements.themeToggle.querySelector('i');
    if (state.theme === 'dark') {
        icon.className = 'fa-solid fa-sun';
    } else {
        icon.className = 'fa-solid fa-moon';
    }
}

// 2. Local network IP detection & QR display
async function setupLanDetection() {
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1';
                        
    if (isLocalhost) {
        try {
            const response = await fetch('/api/ip');
            const data = await response.json();
            if (data && data.ip) {
                state.lanIP = data.ip;
                state.lanPort = data.port;
                
                const url = `http://${data.ip}:${data.port}`;
                elements.lanUrlText.textContent = url;
                
                // Show QR code
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
                elements.qrCodeImg.src = qrUrl;
                elements.qrCodeImg.onload = () => {
                    elements.qrLoading.classList.add('hide');
                };
                
                elements.desktopQrPanel.classList.remove('hide');
            }
        } catch (e) {
            console.log("无法获取局域网IP，可能没有运行Python本地后台", e);
        }
    }
}

// 3. Drag and Drop File Handlers
function setupDragAndDrop() {
    // Cashback zone
    setupZoneEvents(elements.cashbackDropzone, elements.cashbackFile, 'cashback');
    // Allowance zone
    setupZoneEvents(elements.allowanceDropzone, elements.allowanceFile, 'allowance');
}

function setupZoneEvents(dropzone, fileInput, type) {
    // Prevent defaults
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, e => e.preventDefault(), false);
    });

    // Highlight dropzone
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
    });

    // File dropped or selected
    dropzone.addEventListener('drop', e => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files, type);
    });

    fileInput.addEventListener('change', e => {
        handleFiles(e.target.files, type);
    });

    // Click zone to open file dialog
    dropzone.addEventListener('click', (e) => {
        // Prevent click loop if clicking preview image or child buttons
        if (e.target.tagName !== 'INPUT' && !e.target.closest('.preview-badge') && !e.target.closest('.remove-tag-btn')) {
            fileInput.click();
        }
    });
}

function handleFiles(files, type) {
    if (!files.length) return;
    
    // Display previews
    const previewContainer = type === 'cashback' ? elements.cashbackPreviews : elements.allowancePreviews;
    
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onload = e => {
            const badge = document.createElement('div');
            badge.className = 'preview-badge';
            
            const img = document.createElement('img');
            img.src = e.target.result;
            badge.appendChild(img);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-img-btn';
            deleteBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            deleteBtn.onclick = (event) => {
                event.stopPropagation();
                badge.remove();
            };
            badge.appendChild(deleteBtn);
            
            previewContainer.appendChild(badge);
            
            // Run OCR on this image
            processImageOCR(e.target.result, type);
        };
        reader.readAsDataURL(file);
    });
}

// 4. OCR Core logic
async function processImageOCR(imgDataUrl, type) {
    const progressBar = type === 'cashback' ? elements.cashbackProgress : elements.allowanceProgress;
    progressBar.classList.remove('hide');
    
    const fill = progressBar.querySelector('.progress-fill');
    const percentText = progressBar.querySelector('.percentage');
    const statusText = progressBar.querySelector('.status-text');
    
    updateProgress('正在准备 OCR 引擎...', 5);
    
    function updateProgress(status, pct) {
        statusText.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${status}`;
        percentText.textContent = `${pct}%`;
        fill.style.width = `${pct}%`;
    }

    try {
        // Create canvas for image preprocessing
        updateProgress('优化图片对比度...', 15);
        const processedImgDataUrl = await preprocessImage(imgDataUrl);
        
        updateProgress('加载识别模型 (约10MB)...', 30);
        
        // Load worker
        const worker = await Tesseract.createWorker('chi_sim', 1, {
            langPath: 'https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0',
            logger: m => {
                if (m.status === 'recognizing text') {
                    const progress = Math.round(m.progress * 70) + 30; // Scale from 30% to 100%
                    updateProgress(`识别中: ${Math.round(m.progress * 100)}%`, progress);
                } else if (m.status === 'loading language traineddata') {
                    const progress = Math.round(m.progress * 25) + 5; // Scale from 5% to 30%
                    updateProgress(`加载高精模型: ${Math.round(m.progress * 100)}%`, progress);
                }
            }
        });
        
        updateProgress('正在提取商家名称...', 85);
        const { data: { text } } = await worker.recognize(processedImgDataUrl);
        await worker.terminate();
        
        updateProgress('识别完成！正在筛选商家...', 100);
        setTimeout(() => progressBar.classList.add('hide'), 800);
        
        // Parse results
        const newMerchants = cleanAndExtractMerchants(text);
        
        // Add to state
        const targetSet = type === 'cashback' ? state.cashbackMerchants : state.allowanceMerchants;
        newMerchants.forEach(m => targetSet.add(m));
        
        // Update tags in UI
        renderMerchantTags(type);
        triggerMatching();
        
    } catch (error) {
        console.error("OCR 错误", error);
        updateProgress('识别失败，请重试', 0);
        statusText.style.color = '#ef4444';
        setTimeout(() => progressBar.classList.add('hide'), 3000);
    }
}

// Image Preprocessing: Grayscale and Sharpen/High Contrast
function preprocessImage(imgDataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = imgDataUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            ctx.drawImage(img, 0, 0);
            
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            
            // Convert to grayscale only (retaining anti-aliasing, avoiding bumpy binarized text edges)
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                const v = 0.299 * r + 0.587 * g + 0.114 * b;
                data[i] = data[i+1] = data[i+2] = v;
            }
            
            ctx.putImageData(imgData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
    });
}

// Parse text lines to extract merchant names
function cleanAndExtractMerchants(text) {
    if (!text) return [];
    
    const lines = text.split('\n');
    const merchants = [];
    
    // Expanded blocklist including common misread OCR terms for ratings/times/distances
    const blockList = [
        '分', '评分', '月售', '起送', '配送', '分钟', '已领', '去拼单', 
        '进店', '领券', '首单', '津贴', '到店', '评价', '好评', '在线',
        '搜索', '红包', '推荐', '综合', '销量', '速度', '筛选', '我的',
        '沸巾', '浅由', '清由', '加浅', '加清', '加由', '加尘', '尘雁', '潮丰',
        '公里', 'k㎡', '以内', '以下'
    ];
    
    lines.forEach(rawLine => {
        let line = rawLine.trim();
        
        // Remove spaces inside the line for clean text
        line = line.replace(/\s+/g, '');
        
        // 1. Remove leading symbols and short English/alphanumeric prefix junk (like ER, ES, aa, Y-, 1.) 
        // which are usually misread merchant icons or tags
        line = line.replace(/^[^a-zA-Z0-9\u4e00-\u9fa5]+/, ''); // Strip leading punctuation
        line = line.replace(/^[a-zA-Z0-9\-\_\#]{1,3}(?=[\u4e00-\u9fa5])/, ''); // Strip short prefix codes followed by Chinese
        line = line.replace(/^[^a-zA-Z0-9\u4e00-\u9fa5]+/, ''); // Strip leading punctuation again
        
        // Skip empty or super short/long lines
        if (line.length < 2 || line.length > 22) return;
        
        // Skip if contains only numbers or symbols
        if (/^[\d\s\-\:\.￥¥%]+$/.test(line)) return;
        
        // Skip if starts or ends with decimal point or symbols
        if (/^[^\u4e00-\u9fa5a-zA-Z]/.test(line) && !/^[0-9a-zA-Z\u4e00-\u9fa5]/.test(line)) return;
        
        // Check block words
        const hasBlockWord = blockList.some(word => {
            // Special regex to match things like "4.8分" or rating digits
            if (word === '分') {
                return /\d\.\d分/.test(line) || /^\d分/.test(line);
            }
            return line.includes(word);
        });
        
        if (hasBlockWord) return;
        
        // Skip lines containing delivery time representations like "二加" or "三加"
        if (line.startsWith('二加') || line.startsWith('三加') || line.startsWith('一加')) return;
        
        // Merchant names must contain at least one Chinese character
        if (!/[\u4e00-\u9fa5]/.test(line)) return;
        
        // Clean up trailing symbols
        line = line.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\(\)（）]+$/, '');
        
        if (line.length >= 2) {
            merchants.push(line);
        }
    });
    
    // De-duplicate
    return Array.from(new Set(merchants));
}

// 5. Merchant List Tag rendering
function renderMerchantTags(type) {
    const set = type === 'cashback' ? state.cashbackMerchants : state.allowanceMerchants;
    const container = type === 'cashback' ? elements.cashbackTags : elements.allowanceTags;
    const countBadge = type === 'cashback' ? elements.cashbackCount : elements.allowanceCount;
    const area = type === 'cashback' ? elements.cashbackListArea : elements.allowanceListArea;
    
    container.innerHTML = '';
    countBadge.textContent = `${set.size} 个商家`;
    
    if (set.size > 0) {
        area.classList.remove('hide');
        
        // Convert to sorted array and render tags
        Array.from(set).sort().forEach(name => {
            const tag = document.createElement('div');
            tag.className = 'merchant-tag';
            
            // Editable span
            const span = document.createElement('span');
            span.contentEditable = true;
            span.className = 'tag-edit-input';
            span.textContent = name;
            
            // Handle edit blur
            span.addEventListener('blur', () => {
                const newName = span.textContent.trim();
                if (newName !== name) {
                    set.delete(name);
                    if (newName) {
                        set.add(newName);
                    }
                    renderMerchantTags(type);
                    triggerMatching();
                }
            });
            
            // Prevent Enter key from making newlines, blur instead
            span.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    span.blur();
                }
            });
            
            tag.appendChild(span);
            
            // Delete button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-tag-btn';
            removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            removeBtn.onclick = () => {
                set.delete(name);
                renderMerchantTags(type);
                triggerMatching();
            };
            tag.appendChild(removeBtn);
            
            container.appendChild(tag);
        });
    } else {
        area.classList.add('hide');
    }
}

// 6. Manual additions
function setupManualEntry() {
    // Cashback
    elements.addCashbackBtn.onclick = () => addManualMerchant('cashback');
    elements.addCashbackInput.onkeydown = e => { if (e.key === 'Enter') addManualMerchant('cashback'); };
    
    // Allowance
    elements.addAllowanceBtn.onclick = () => addManualMerchant('allowance');
    elements.addAllowanceInput.onkeydown = e => { if (e.key === 'Enter') addManualMerchant('allowance'); };
}

function addManualMerchant(type) {
    const input = type === 'cashback' ? elements.addCashbackInput : elements.addAllowanceInput;
    const set = type === 'cashback' ? state.cashbackMerchants : state.allowanceMerchants;
    const name = input.value.trim();
    
    if (name) {
        set.add(name);
        input.value = '';
        renderMerchantTags(type);
        triggerMatching();
    }
}

function setupClearButtons() {
    elements.clearCashbackBtn.onclick = () => {
        state.cashbackMerchants.clear();
        elements.cashbackPreviews.innerHTML = '';
        renderMerchantTags('cashback');
        triggerMatching();
    };
    elements.clearAllowanceBtn.onclick = () => {
        state.allowanceMerchants.clear();
        elements.allowancePreviews.innerHTML = '';
        renderMerchantTags('allowance');
        triggerMatching();
    };
}

// 7. Matching and Rendering Results (Cashback > Allowance Priority)
function triggerMatching() {
    const listA = Array.from(state.cashbackMerchants);
    const listB = Array.from(state.allowanceMerchants);
    
    if (listA.length === 0 && listB.length === 0) {
        elements.resultsPlaceholder.classList.remove('hide');
        elements.resultsDisplay.classList.add('hide');
        elements.matchSummaryBadge.textContent = '双重特惠: 0';
        return;
    }
    
    elements.resultsPlaceholder.classList.add('hide');
    elements.resultsDisplay.classList.remove('hide');
    
    // Matching algorithm: Fuzzy name checking
    const matched = [];
    const matchedFromA = new Set();
    const matchedFromB = new Set();
    
    listA.forEach(nameA => {
        listB.forEach(nameB => {
            if (isFuzzyMatch(nameA, nameB)) {
                matched.push({
                    name: nameA, // Prefer Cashback name
                    type: 'double',
                    details: `返现："${nameA}" ↔ 津贴："${nameB}"`
                });
                matchedFromA.add(nameA);
                matchedFromB.add(nameB);
            }
        });
    });
    
    // Remaining Cashback only merchants (Priority 2)
    const cashbackOnly = listA
        .filter(name => !matchedFromA.has(name))
        .map(name => ({
            name: name,
            type: 'cashback'
        }));
        
    // Remaining Allowance only merchants (Priority 3)
    const allowanceOnly = listB
        .filter(name => !matchedFromB.has(name))
        .map(name => ({
            name: name,
            type: 'allowance'
        }));
        
    // Total Results sorted by priority: Double > Cashback > Allowance
    const finalResults = [
        ...matched,
        ...cashbackOnly,
        ...allowanceOnly
    ];
    
    elements.matchSummaryBadge.textContent = `双重特惠: ${matched.length}`;
    renderResults(finalResults);
}

// Fuzzy matching validator
function isFuzzyMatch(nameA, nameB) {
    const cleanA = cleanMerchantName(nameA);
    const cleanB = cleanMerchantName(nameB);
    if (!cleanA || !cleanB) return false;
    
    // Exact clean match
    if (cleanA === cleanB) return true;
    
    // Substring checking (require at least 3 chars for safety)
    if (cleanA.includes(cleanB) && cleanB.length >= 3) return true;
    if (cleanB.includes(cleanA) && cleanA.length >= 3) return true;
    
    // Character overlap score
    const setA = new Set(cleanA);
    const setB = new Set(cleanB);
    let commonCount = 0;
    for (let char of setA) {
        if (setB.has(char)) commonCount++;
    }
    const minLength = Math.min(cleanA.length, cleanB.length);
    // If they share >= 80% characters and shortest name is at least 3 chars
    if (minLength >= 3 && (commonCount / minLength) >= 0.8) {
        return true;
    }
    
    return false;
}

// Normalize merchant name
function cleanMerchantName(name) {
    // Replace Chinese parentheses with standard ones
    let cleaned = name.replace(/（/g, '(').replace(/）/g, ')');
    // Remove content in brackets/parentheses (e.g. branch store name, delivery promo)
    cleaned = cleaned.replace(/\([^)]*\)/g, '');
    cleaned = cleaned.replace(/【[^】]*】/g, '').replace(/\[[^\]]*\]/g, '');
    // Remove punctuation, spaces, and special symbols
    cleaned = cleaned.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    // Remove common trailing branch words
    cleaned = cleaned.replace(/(店|分店|专营店|外卖店|官方店|旗舰店|百货店|便利店)$/, '');
    return cleaned.trim();
}

// Render Results List
function renderResults(results) {
    elements.resultsDisplay.innerHTML = '';
    
    if (results.length === 0) {
        elements.resultsDisplay.innerHTML = `
            <div class="glass-card placeholder-card">
                <p class="placeholder-main">没有找到参与活动的商家</p>
                <p class="placeholder-sub">请尝试手动添加或调整识别出的名字</p>
            </div>
        `;
        return;
    }
    
    results.forEach(item => {
        const card = document.createElement('div');
        let typeClass = '';
        let badgeHtml = '';
        
        if (item.type === 'double') {
            typeClass = 'double-discount';
            badgeHtml = `
                <div class="result-badges">
                    <span class="res-badge double"><i class="fa-solid fa-fire"></i> 双重特惠</span>
                </div>
            `;
        } else if (item.type === 'cashback') {
            typeClass = 'cashback-only';
            badgeHtml = `
                <div class="result-badges">
                    <span class="res-badge cashback">仅参与返现</span>
                </div>
            `;
        } else {
            typeClass = 'allowance-only';
            badgeHtml = `
                <div class="result-badges">
                    <span class="res-badge allowance">仅参与津贴</span>
                </div>
            `;
        }
        
        card.className = `result-item-card ${typeClass}`;
        
        card.innerHTML = `
            <div class="result-merchant-info">
                <span class="result-merchant-name">${item.name}</span>
                ${badgeHtml}
            </div>
            <button class="copy-action-btn" onclick="copyToClipboard('${item.name.replace(/'/g, "\\'")}', this)">
                <i class="fa-regular fa-copy"></i> 复制名字
            </button>
        `;
        
        elements.resultsDisplay.appendChild(card);
    });
}

// Clipboard copying utility
function copyToClipboard(text, buttonEl) {
    navigator.clipboard.writeText(text).then(() => {
        // Show local toast
        elements.toastText.textContent = `已复制: ${text}`;
        elements.toast.classList.remove('hide');
        elements.toast.classList.add('show');
        
        // Button anim state
        const originalHtml = buttonEl.innerHTML;
        buttonEl.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
        buttonEl.classList.add('copied');
        
        setTimeout(() => {
            elements.toast.classList.remove('show');
            setTimeout(() => elements.toast.classList.add('hide'), 300);
            
            buttonEl.innerHTML = originalHtml;
            buttonEl.classList.remove('copied');
        }, 1500);
        
        // Provide haptic feedback if mobile device supports it
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }).catch(err => {
        console.error('复制失败', err);
    });
}
