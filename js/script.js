// =========================================
// LOCAL HISTORY LOGIC (PRIVACY FIRST)
// =========================================
function loadLocalHistory() {
    const historyList = document.getElementById("historyList");
    let localHistory = JSON.parse(localStorage.getItem('phishguard_local_history') || '[]');
    
    if (localHistory.length === 0) {
        historyList.innerHTML = "<li style='color:#888; justify-content:center;'>You haven't scanned any messages on this device yet.</li>";
        return;
    }

    historyList.innerHTML = "";
    localHistory.forEach(item => {
        const li = document.createElement("li");
        let icon = item.label.includes("SCAM") ? "🚨" : item.label.includes("SPAM") ? "📧" : "✅";
        let color = item.label.includes("SCAM") ? "#d93025" : item.label.includes("SPAM") ? "#fbc02d" : "#1e8e3e";
        
        li.innerHTML = `<div style="font-size: 20px; min-width: 30px;">${icon}</div> 
                        <div><strong style="color:${color}">${item.label}</strong><br><span style="color:#666;">${item.text}</span></div>`;
        historyList.appendChild(li);
    });
}

function saveToLocalHistory(label, text) {
    let localHistory = JSON.parse(localStorage.getItem('phishguard_local_history') || '[]');
    let shortText = text.length > 80 ? text.substring(0, 80) + "..." : text;
    
    // Add new item to the beginning
    localHistory.unshift({ label: label, text: shortText });
    
    // Keep only the last 15 scans to save space
    if (localHistory.length > 15) {
        localHistory = localHistory.slice(0, 15);
    }
    
    localStorage.setItem('phishguard_local_history', JSON.stringify(localHistory));
    loadLocalHistory(); // Refresh the list
}

// Load local history on startup
document.addEventListener("DOMContentLoaded", loadLocalHistory);

// =========================================
// TERMS & PRIVACY MODAL LOGIC
// =========================================
function checkAgreementAndScan() {
    const rawText = document.getElementById('smsText').value.trim();
    if (!rawText && imageQueue.length === 0) { 
        alert("Please enter text or upload an image before scanning."); 
        return; 
    }

    if (localStorage.getItem('phishguard_agreed') === 'true') {
        startMasterProcess(); 
    } else {
        document.getElementById('termsModal').style.display = 'flex';
        document.getElementById('agreeTerms').checked = false;
        document.getElementById('dontShowAgain').checked = false;
        toggleAcceptBtn();
    }
}

function toggleAcceptBtn() {
    const isAgreed = document.getElementById('agreeTerms').checked;
    document.getElementById('acceptBtn').disabled = !isAgreed;
}

function declineTerms() {
    document.getElementById('termsModal').style.display = 'none';
    // Scan is cancelled, return to normal state
}

function acceptTerms() {
    const dontShowAgain = document.getElementById('dontShowAgain').checked;
    if (dontShowAgain) {
        localStorage.setItem('phishguard_agreed', 'true');
    }
    document.getElementById('termsModal').style.display = 'none';
    startMasterProcess(); 
}

// =========================================
// STATE MANAGEMENT & UI LOCKING
// =========================================
let isScanning = false;
let imageQueue = [];
let scanCompleted = false;

window.addEventListener('beforeunload', function (e) {
    if (isScanning) {
        var confirmationMessage = 'A scan is currently in progress. If you leave or refresh this page, the scan will be interrupted.';
        (e || window.event).returnValue = confirmationMessage;
        return confirmationMessage;
    }
});

function setUIState(scanning) {
    isScanning = scanning;
    const textInput = document.getElementById('smsText');
    const scanBtn = document.getElementById('scanBtn');
    const clearBtn = document.getElementById('clearTrigger');
    const uploadBtn = document.getElementById('uploadTrigger');

    if (scanning) {
        textInput.disabled = true;
        textInput.style.opacity = '0.6';
        textInput.style.cursor = 'not-allowed';
        clearBtn.style.pointerEvents = 'none';
        clearBtn.style.opacity = '0.5';
        uploadBtn.style.pointerEvents = 'none';
        uploadBtn.style.opacity = '0.5';
        scanBtn.disabled = true;
        scanBtn.classList.add("loading");
    } else {
        textInput.disabled = false;
        textInput.style.opacity = '1';
        textInput.style.cursor = 'text';
        clearBtn.style.pointerEvents = 'auto';
        clearBtn.style.opacity = '1';
        uploadBtn.style.pointerEvents = 'auto';
        uploadBtn.style.opacity = '1';
        scanBtn.disabled = false;
        scanBtn.classList.remove("loading");
        scanBtn.innerText = "SCAN MESSAGES NOW";
    }
}

function clearWorkspace() {
    if(isScanning) return;
    document.getElementById('smsText').value = ''; 
    imageQueue = []; 
    renderQueue(); 
    document.getElementById('carouselArea').style.display='none'; 
}

// =========================================
// 1. IMAGE QUEUE LOGIC & AUTO-CLEAR FLAG
// =========================================
function autoResetWorkspace() {
    if (scanCompleted && !isScanning) {
        document.getElementById('smsText').value = '';
        document.getElementById('carouselArea').innerHTML = '';
        document.getElementById('carouselArea').style.display = 'none';
        scanCompleted = false;
    }
}

const dropZone = document.getElementById('dropZone');
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); 
    dropZone.classList.remove('dragover');
    if (isScanning) return; 
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        autoResetWorkspace(); 
        addFilesToQueue(e.dataTransfer.files);
    }
});

function handleImageUpload(event) {
    if (isScanning) return;
    if (event.target.files && event.target.files.length > 0) {
        autoResetWorkspace(); 
        addFilesToQueue(event.target.files);
    }
}

document.addEventListener('paste', function (event) {
    if (isScanning) return;
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    let files = [];
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.includes('image/')) {
            files.push(item.getAsFile());
        }
    }
    if (files.length > 0) {
        autoResetWorkspace(); 
        addFilesToQueue(files);
    }
});

function addFilesToQueue(files) {
    for (let i = 0; i < files.length; i++) {
        if(files[i].size > 5 * 1024 * 1024){
           alert("⚠️ Image too large (max 5MB). Removed from queue.");
           continue;
        }
        if (files[i].type.startsWith('image/')) {
            imageQueue.push(files[i]);
        }
    }
    renderQueue();
}

function renderQueue() {
    const container = document.getElementById('imageQueueContainer');
    container.innerHTML = '';
    imageQueue.forEach((file, index) => {
        const url = URL.createObjectURL(file);
        container.innerHTML += `
            <div class="queue-item">
                <img src="${url}">
                <button class="remove-btn" onclick="removeFromQueue(${index})">✕</button>
            </div>
        `;
    });
}

function removeFromQueue(index) {
    if(isScanning) return;
    imageQueue.splice(index, 1);
    renderQueue();
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// =========================================
// 2. MASTER SCAN FUNCTION (BATCH PROCESSING)
// =========================================
async function startMasterProcess() {
    if(isScanning) return; 

    setUIState(true); 

    document.getElementById('carouselArea').innerHTML = ""; 
    document.getElementById('carouselArea').style.display = "flex";

    if (imageQueue.length > 0) {
        document.getElementById('scanBtn').innerText = `👁️ READING ${imageQueue.length} IMAGES...`;

        let extractedTexts = [];
        for (let i = 0; i < imageQueue.length; i++) {
            try {
                let base64Str = await fileToBase64(imageQueue[i]);
                const res = await fetch('https://shawntezinzi.pythonanywhere.com/core/scan_image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64Str })
                });
                const data = await res.json();
                if(data.status === "success") {
                    extractedTexts.push(data.extracted_text);
                } else {
                    console.error("OCR Error:", data.message);
                }
            } catch(err) {
                console.error("Image Error:", err.message);
            }
            await sleep(1000); 
        }

        if (extractedTexts.length > 0) {
            let currentText = document.getElementById('smsText').value.trim();
            let newText = extractedTexts.join("\n\n==========\n\n");
            document.getElementById('smsText').value = currentText ? currentText + "\n\n==========\n\n" + newText : newText;
        }

        imageQueue = []; 
        renderQueue(); 
    }

    await startBatchTextScan();
}

async function startBatchTextScan() {
    const scanBtn = document.getElementById('scanBtn');
    const carouselArea = document.getElementById('carouselArea');

    const rawText = document.getElementById('smsText').value.trim();
    if (!rawText) { 
        setUIState(false); 
        return; 
    }

    let messages = rawText.split(/==========+/).map(t => t.trim()).filter(t => t.length > 0);

    scanBtn.innerText = "⏳ SYSTEM IS ANALYZING...";

    for (let i = 0; i < messages.length; i++) {
        let msg = messages[i];
        let cardId = `card_${i}`;
        
        carouselArea.innerHTML += `
            <div id="${cardId}" class="result-section unknown">
                <h3 class="status-label">⏳ Scanning ${i+1}/${messages.length}...</h3>
                <div class="preview-text">${msg.substring(0, 100)}...</div>
            </div>
        `;

        try {
            const res = await fetch(`https://shawntezinzi.pythonanywhere.com/core/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: msg })
            });
            let rawData = await res.json();
            
            if(rawData.error) throw new Error(rawData.error);

            let data = rawData.results && rawData.results.length > 0 ? rawData.results[0] : rawData;
            
            updateCard(cardId, data, msg);
            
            // SAVE TO LOCAL HISTORY (Client-Side Privacy)
            saveToLocalHistory((data.predicted || "UNKNOWN").toUpperCase(), msg);

        } catch (err) {
            document.getElementById(cardId).innerHTML = `<h3 class="status-label" style="color:#d93025;">❌ Error</h3><p>${err.message}</p>`;
        }

        if (i < messages.length - 1) {
            await sleep(2500); 
        }
    }

    setUIState(false); 
    scanCompleted = true;
}

function updateCard(cardId, data, originalText) {
    const card = document.getElementById(cardId);
    let cardClass = "unknown";
    let icon = "⚠️ UNKNOWN";
    
    const pred = (data.predicted || "").toUpperCase();
    if (pred.includes("SCAM") || pred.includes("SMISHING")) { cardClass = "scam"; icon = "🚨 SCAM"; }
    else if (pred.includes("SPAM")) { cardClass = "spam"; icon = "📧 SPAM"; }
    else if (pred.includes("SAFE") || pred.includes("HAM")) { cardClass = "safe"; icon = "✅ SAFE"; }

    let sourceStr = data.decision_source || "UNKNOWN";
    let confHtml = '';

    if (sourceStr === "INPUT FILTER") {
        confHtml = `<p style="margin-bottom: 2px; font-size:14px;"><b>📊 Confidence Level:</b> N/A (Filtered)</p>
                    <div class="confidence-bar"><div style="height:100%; width:0%; background:#5f6368;"></div></div>`;
    } else if (sourceStr === "GEMINI AI" || sourceStr.includes("CLOUD")) {
        confHtml = `<p style="margin-bottom: 2px; font-size:14px;"><b>📊 Confidence Level:</b> N/A (Cloud Evaluation)</p>
                    <div class="confidence-bar"><div style="height:100%; width:0%; background:#1a73e8;"></div></div>`;
    } else {
        let confPercent = data.confidence ? (parseFloat(data.confidence) * 100).toFixed(2) : 0;
        let bg = confPercent > 75 ? "#1e8e3e" : "#fbbc05";
        confHtml = `<p style="margin-bottom: 2px; font-size:14px;"><b>📊 Confidence Level:</b> ${confPercent}%</p>
                    <div class="confidence-bar"><div style="height:100%; width:${confPercent}%; background:${bg};"></div></div>`;
    }

    let detectedLinkHtml = '';
    if (data.original_url) {
        let linkDisplay = `<a href="${data.original_url}" target="_blank" style="color:#1a73e8; font-weight:600; word-wrap:break-word;">${data.original_url}</a>`;
        
        let detailsBox = `<div class="link-details">`;
        let ageStr = (data.domain_age_days && data.domain_age_days > 0) ? data.domain_age_days + ' days' : 'Protected / Hidden';
        detailsBox += `<span><b>📅 Domain Age:</b> ${ageStr}</span>`;
        let regStr = (data.registrar && data.registrar !== "None" && data.registrar !== "Unknown" && data.registrar !== "") ? data.registrar : 'Protected / Hidden';
        detailsBox += `<span><b>🏢 Registrar:</b> ${regStr}</span>`;
        let ipStr = (data.dns_ip && data.dns_ip !== "None" && data.dns_ip !== "") ? data.dns_ip : 'Protected / Firewall';
        detailsBox += `<span><b>🌐 Server IP:</b> ${ipStr}</span>`;
        
        // --- VISUAL UI FIX IS HERE ---
        let dbHit = (data.phishing_db == 1) ? "<b style='color:#d93025'>YES (Blacklisted)</b>" : "No";
        detailsBox += `<span><b>🏴‍☠️ In PhishTank:</b> ${dbHit}</span>`;
        // -----------------------------
        
        detailsBox += `</div>`;
        
        detectedLinkHtml = `<div class="verified-link"><b>🔗 Detected Link:</b><br>${linkDisplay} ${detailsBox}</div>`;
    }

    card.className = `result-section ${cardClass}`;
    let descriptionText = data.description || "Unknown status";

    card.innerHTML = `
        <h3 class="status-label">${icon}</h3>
        <p style="font-style: italic; color: #555; margin-bottom: 15px; font-size: 15px;">${descriptionText}</p>
        <div class="preview-text">"${originalText.substring(0, 100)}..."</div>
        
        ${detectedLinkHtml}
        
        <p style="font-size:14px; margin-bottom:5px;"><b>⚖️ Source:</b> <span style="color:#1a73e8; font-weight:600;">${sourceStr.replace("GEMINI AI", "CLOUD ANALYSIS").replace("CLOUD AI BATCH", "CLOUD BATCH ANALYSIS").replace("CLOUD AI SINGLE", "CLOUD ANALYSIS")}</span></p>
        <p style="font-size:14px; margin-bottom:8px;"><b>🔍 Local SVM:</b> <span>${data.svm_result || "N/A"}</span></p>
        ${confHtml}
        
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;">
        <p style="font-size:14px; margin-bottom: 5px;"><b>🧠 Analysis Explanation:</b></p>
        <div style="font-style: italic; line-height: 1.5; color:#444; font-size:13px; max-height:120px; overflow-y:auto; padding-right:5px;">${data.ai_expert_advice ? data.ai_expert_advice.replace("The AI", "The system") : "The system provided no explanation."}</div>

        <div class="feedback-container" id="fb_wrap_${data.row_id}" ${sourceStr === "INPUT FILTER" ? 'style="display:none;"' : ''}>
            <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color:#333;">Is this classification correct?</p>
            <div class="feedback-btns">
                <button class="btn-yes" onclick="submitFeedback('${data.row_id}', true, '${pred}')">👍 Yes</button>
                <button class="btn-no" onclick="document.getElementById('fb_correct_${data.row_id}').style.display='block'; this.parentElement.style.display='none';">👎 No</button>
            </div>
            
            <div id="fb_correct_${data.row_id}" style="display:none; margin-top: 15px;">
                <label style="font-size: 13px; font-weight: 600; color:#555;">What should be the correct category?</label>
                <select id="select_${data.row_id}">
                    <option value="SAFE">✅ SAFE (Legitimate message)</option>
                    <option value="SCAM">🚨 SCAM (Phishing / Dangerous)</option>
                    <option value="SPAM">📧 SPAM (Promotional / Unwanted)</option>
                </select>
                <button class="btn-submit-type" onclick="submitFeedback('${data.row_id}', false, '${pred}')">Save Fix</button>
            </div>
        </div>
        <div id="fb_success_${data.row_id}" style="display:none; margin-top: 20px; color: #1e8e3e; font-weight: bold; text-align: center; font-size: 14px; background: #e6f4ea; padding: 10px; border-radius: 6px;">✅ Feedback Saved!</div>
    `;
}

async function submitFeedback(rowId, isCorrect, predictedLabel) {
    let final_label = isCorrect ? predictedLabel : document.getElementById(`select_${rowId}`).value;
    document.getElementById(`fb_wrap_${rowId}`).style.display = "none";
    document.getElementById(`fb_success_${rowId}`).style.display = "block";

    try {
        await fetch('https://shawntezinzi.pythonanywhere.com/core/feedback', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ row_id: rowId, correct: isCorrect, type: final_label })
        });
        console.log(`Feedback for row ${rowId} sent to Admin Conflictor.`);
    } catch(err){
        alert("❌ Error saving feedback.");
    }
}
