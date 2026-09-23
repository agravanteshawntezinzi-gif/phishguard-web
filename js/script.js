document.addEventListener("DOMContentLoaded", () => {
    const navItems = document.querySelectorAll(".nav-links a");
    const sections = document.querySelectorAll("section");

    navItems.forEach(item => {
        item.addEventListener("click", function() {
            navItems.forEach(i => i.classList.remove("active"));
            this.classList.add("active");
        });
    });

    window.addEventListener("scroll", () => {
        let currentSectionId = "";
        const scrollPosition = window.pageYOffset + 150;

        sections.forEach(sec => {
            const top = sec.offsetTop;
            const height = sec.offsetHeight;
            if (scrollPosition >= top && scrollPosition < top + height) {
                currentSectionId = sec.getAttribute("id");
            }
        });

        if (currentSectionId) {
            navItems.forEach(item => {
                item.classList.remove("active");
                if (item.getAttribute("href") === `#${currentSectionId}`) {
                    item.classList.add("active");
                }
            });
        }
    });
    
    loadLocalHistory();
    loadAppsFromGitHub();
});

function toggleIncognito() {
    const isIncognito = document.getElementById('incognitoToggle').checked;
    const smsText = document.getElementById('smsText');
    if (isIncognito) {
        smsText.placeholder = "You are in incognito mode. All scans won't be saved here or in the server database.";
        smsText.classList.add('incognito-active');
    } else {
        smsText.placeholder = "Type or paste the SMS text here... You can also drag & drop multiple screenshots!";
        smsText.classList.remove('incognito-active');
    }
}

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
    
    localHistory.unshift({ label: label, text: shortText });
    
    if (localHistory.length > 15) {
        localHistory = localHistory.slice(0, 15);
    }
    
    localStorage.setItem('phishguard_local_history', JSON.stringify(localHistory));
    loadLocalHistory();
}

// SCAN BUTTON PART AND ENCRYPTION/PRIVACY LOGIC
function checkAgreementAndScan() {
    const rawText = document.getElementById('smsText').value.trim();
    if (!rawText && imageQueue.length === 0) { 
        alert("Please enter text or upload an image before scanning."); 
        return; 
    }

    const isIncognito = document.getElementById('incognitoToggle').checked;

    if (isIncognito || localStorage.getItem('phishguard_agreed') === 'true') {
        startMasterProcess(isIncognito); 
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
}

function acceptTerms() {
    const dontShowAgain = document.getElementById('dontShowAgain').checked;
    if (dontShowAgain) {
        localStorage.setItem('phishguard_agreed', 'true');
    }
    document.getElementById('termsModal').style.display = 'none';
    startMasterProcess(false); 
}

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
    const incToggle = document.getElementById('incognitoToggle');

    if (scanning) {
        textInput.disabled = true;
        textInput.style.opacity = '0.6';
        textInput.style.cursor = 'not-allowed';
        clearBtn.style.pointerEvents = 'none';
        clearBtn.style.opacity = '0.5';
        uploadBtn.style.pointerEvents = 'none';
        uploadBtn.style.opacity = '0.5';
        incToggle.disabled = true;
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
        incToggle.disabled = false;
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

async function startMasterProcess(isIncognito) {
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
                }
            } catch(err) {
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

    await startBatchTextScan(isIncognito);
}

async function startBatchTextScan(isIncognito) {
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
                body: JSON.stringify({ text: msg, incognito: isIncognito })
            });
            let rawData = await res.json();
            
            if(rawData.error) throw new Error(rawData.error);

            let data = rawData.results && rawData.results.length > 0 ? rawData.results[0] : rawData;
            
            updateCard(cardId, data, msg);
            
            if (!isIncognito) {
                saveToLocalHistory((data.predicted || "UNKNOWN").toUpperCase(), msg);
            }

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
        
        let dbHit = (data.phishing_db == 1) ? "<b style='color:#d93025'>YES (Blacklisted)</b>" : "No";
        detailsBox += `<span><b>🏴‍☠️ In PhishTank:</b> ${dbHit}</span>`;
        
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
    } catch(err){
        alert("❌ Error saving feedback.");
    }
}

function openTutorialModal() { document.getElementById('tutorialModal').style.display = 'flex'; }
function closeTutorialModal() { document.getElementById('tutorialModal').style.display = 'none'; }
function closeDownloadModal() { clearInterval(downloadInterval); document.getElementById('downloadModal').style.display = 'none'; }

let downloadInterval = null;
let availableApps = [];
const PROXY_URL = "https://shawntezinzi.pythonanywhere.com/api/github_proxy?url=";

async function loadAppsFromGitHub() {
    let localApps = JSON.parse(localStorage.getItem('pg_mobile_apps')) || [];

    try {
        const repoUrl = 'https://api.github.com/repos/agravanteshawntezinzi-gif/phishguard-web/contents/app';
        const response = await fetch(PROXY_URL + encodeURIComponent(repoUrl));
        
        if (response.ok) {
            const files = await response.json();
            const apkFiles = files.filter(f => f.name.endsWith('.apk'));

            if (apkFiles.length > 0) {
                let globalManifest = {};
                try {
                    const cacheBuster = new Date().getTime();
                    const manifestUrl = `https://api.github.com/repos/agravanteshawntezinzi-gif/phishguard-web/contents/js/phishguard_manifest.json?t=${cacheBuster}`;
                    const manRes = await fetch(PROXY_URL + encodeURIComponent(manifestUrl));
                    if (manRes.ok) {
                        const manData = await manRes.json();
                        const decodedContent = decodeURIComponent(escape(atob(manData.content.replace(/\s/g, ''))));
                        globalManifest = JSON.parse(decodedContent);
                    }
                } catch(e) { }

                availableApps = await Promise.all(apkFiles.map(async (f, idx) => {
                    let matchingLocal = localApps.find(l => l.filename === f.name);
                    let verClean = f.name.replace('PhishGuard_', '').replace('.apk', '').replace(/_/g, '-');
                    if (!verClean.startsWith('v')) verClean = 'v' + verClean;

                    let realDate = "Latest Release";
                    try {
                        const commitUrl = `https://api.github.com/repos/agravanteshawntezinzi-gif/phishguard-web/commits?path=${f.path}`;
                        const commitRes = await fetch(PROXY_URL + encodeURIComponent(commitUrl));
                        if (commitRes.ok) {
                            const commitData = await commitRes.json();
                            if (commitData.length > 0) {
                                const d = new Date(commitData[0].commit.author.date);
                                realDate = d.toISOString().split('T')[0];
                            }
                        }
                    } catch(e) { }

                    let fallbackFeatures = [
                        "Real-time SMS inbox scanning",
                        "Dual-SIM connection support",
                        "Machine Learning threat detection",
                        "Send deep-scan reports to Admin"
                    ];

                    if (f.name.includes("Beta") || f.name.includes("v1.0.0-Beta")) {
                        fallbackFeatures = [
                            "Added automatic background scanning.",
                            "Notifications show color-coded threats.",
                            "Reply directly from notifications.",
                            "Replies use the correct SIM.",
                            "Added dynamic recent contacts list.",
                            "Inbox updates in real time.",
                            "Fixed camera cutout UI overlap.",
                            "Added native ripple click effects."
                        ];
                    } else if (f.name.includes("Stable") || f.name.includes("v1.0.0-Stable")) {
                        fallbackFeatures = ["fix crash"];
                    } else if (f.name.includes("v1.0.1-Alpha")) {
                        fallbackFeatures = ["Fix Deep Scan"];
                    }

                    let customFeatures = globalManifest[f.name] || (matchingLocal ? matchingLocal.features : fallbackFeatures);

                    return {
                        id: idx + 1,
                        name: "PhishGuard Mobile Security",
                        version: matchingLocal ? matchingLocal.version : verClean,
                        size: matchingLocal ? matchingLocal.size : (f.size ? (f.size / (1024 * 1024)).toFixed(1) + " MB" : "15.0 MB"),
                        date: realDate !== "Latest Release" ? realDate : (matchingLocal ? matchingLocal.date : "Latest Release"),
                        author: "PhishGuard Dev Team",
                        filename: f.name,
                        filePath: f.download_url,
                        features: customFeatures
                    };
                }));
                
                availableApps.sort((a, b) => b.id - a.id);
                renderAppTable();
                return;
            }
        }
    } catch (err) {
    }

    availableApps = localApps;
    renderAppTable();
}

function renderAppTable() {
    const tbody = document.getElementById('appTableBody');
    if (!tbody) return;

    if (availableApps.length === 0) {
        tbody.innerHTML = `<tr id="emptyAppRow"><td colspan="5" style="text-align: center; color: #94a3b8; padding: 25px;">No mobile application releases available yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    availableApps.forEach(app => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="apk-link" onclick="openInfoModal(${app.id})">${app.name}</span></td>
            <td><span class="apk-link" onclick="openInfoModal(${app.id})">${app.version}</span></td>
            <td>${app.size}</td>
            <td>${app.date}</td>
            <td><button class="btn-download-trigger" onclick="openDownloadModal(${app.id})">Download</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function populateModalData(app) {
    document.getElementById('modalAppName').innerText = app.name;
    document.getElementById('modalAppVersion').innerText = app.version;
    document.getElementById('modalAppAuthor').innerText = app.author;
    document.getElementById('modalAppSize').innerText = app.size;
    document.getElementById('modalAppFeatures').innerHTML = app.features.map(f => `<li>${f}</li>`).join('');
    
    const manualLink = document.getElementById('manualDownloadLink');
    manualLink.href = app.filePath;
    manualLink.setAttribute('download', app.filename);
}

function openInfoModal(appId) {
    const app = availableApps.find(a => a.id === appId);
    if (!app) return;
    populateModalData(app);
    document.getElementById('timerBoxContainer').style.display = 'none';
    document.getElementById('manualDownloadDiv').style.display = 'none';
    const infoBtn = document.getElementById('infoModeDownloadBtn');
    infoBtn.style.display = 'block';
    infoBtn.onclick = function() { openDownloadModal(appId); };
    document.getElementById('downloadModal').style.display = 'flex';
    clearInterval(downloadInterval);
}

function openDownloadModal(appId) {
    const app = availableApps.find(a => a.id === appId);
    if (!app) return;
    populateModalData(app);
    document.getElementById('timerBoxContainer').style.display = 'block';
    document.getElementById('manualDownloadDiv').style.display = 'none';
    document.getElementById('infoModeDownloadBtn').style.display = 'none';
    document.getElementById('downloadModal').style.display = 'flex';
    let timeLeft = 10;
    const timerDisplay = document.getElementById('downloadTimer');
    timerDisplay.innerText = timeLeft;
    clearInterval(downloadInterval);
    downloadInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(downloadInterval);
            document.getElementById('manualDownloadDiv').style.display = 'block';
            document.getElementById('manualDownloadLink').click();
        }
    }, 1000);
}
