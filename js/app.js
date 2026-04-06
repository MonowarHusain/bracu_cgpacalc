/**
 * CGPA Calc Pro - Main Logic & Router
 */

const KEY = 'cgpapro_user_data';
let cgpaChart = null;
const DISCORD_WEBHOOK = "YOUR_DISCORD_WEBHOOK_URL_HERE";

const getPoints = (g) => {
    const table = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'D+': 1.7, 'D': 1.3, 'D-': 1.0, 'F': 0.0 };
    return table[(g || '').split(' ')[0].toUpperCase()] || 0;
};

// --- MULTI-PAGE ROUTER ---
function launchPage(pageId) {
    if (pageId === 'analyticsPage' && (!localStorage.getItem(KEY) || JSON.parse(localStorage.getItem(KEY)).history.length === 0)) {
        alert("Please import your transcript PDF first to unlock Degree Analytics!");
        return;
    }

    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    document.getElementById('mainFooter').classList.remove('hidden');

    if (pageId === 'analyticsPage') {
        switchTab('dashboard');
    } else if (pageId === 'predictorPage') {
        calculatePrediction();
    }
}

function launchPredictor() {
    // Fresher bypass: if no data exists, create a clean slate
    if (!localStorage.getItem(KEY)) {
        const freshUser = {
            studentName: "Fresher Student",
            history: [], transcriptHistory: [], semesters: [],
            officialCgpa: 0, officialCredits: 0, plan: "CSE"
        };
        localStorage.setItem(KEY, JSON.stringify(freshUser));
    }
    launchPage('predictorPage');
    renderPredictorHistory();
    calculatePrediction();
}

function goToMenu() {
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    document.getElementById('gatewayPage').classList.add('active');
    document.getElementById('mainFooter').classList.add('hidden');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-link').forEach(l => {
        l.classList.remove('active', 'border-blue-600', 'text-blue-600', 'dark:text-blue-500');
        l.classList.add('border-transparent', 'text-slate-500');
    });
    document.getElementById(tabId).classList.add('active');

    const links = document.querySelectorAll(`.tab-link`);
    links.forEach(l => {
        if (l.innerText.toLowerCase().includes(tabId) || (tabId === 'audit' && l.innerText.includes('Audit')) || (tabId === 'history' && l.innerText.includes('Grades'))) {
            l.classList.add('active', 'border-blue-600', 'text-blue-600', 'dark:text-blue-500');
            l.classList.remove('border-transparent', 'text-slate-500');
        }
    });
}

// --- PARSER ---
const parseTranscript = (text) => {
    const history = [], semestersFound = [], transcriptHistory = [];
    const nameMatch = text.match(/Name\s*[:\-]*\s*([A-Za-z\s\.]+?)\s*(?:BRAC|Student ID|PROGRAM)/i);
    const finalCgpaMatch = [...text.matchAll(/CGPA\s*[:\-]*\s*([\d.]+)/gi)].pop();
    const finalCreditsMatch = [...text.matchAll(/Credits\s+(?:Earned|Completed)\s*[:\-]*\s*([\d.]+)/gi)].pop();

    let detectedPlan = "CSE";
    if (/MASTER/i.test(text)) detectedPlan = "MSC";
    else if (/COMPUTER SCIENCE\s*AND\s*ENGINEERING/i.test(text)) detectedPlan = "CSE";
    else if (/COMPUTER SCIENCE/i.test(text)) detectedPlan = "CS";

    const semRegex = /(?:SEMESTER|Semester)\s*[:\-]*\s*([A-Z]+\s+\d{4})/gi;
    let m; while ((m = semRegex.exec(text)) !== null) semestersFound.push(m[1].trim());

    const courseRegex = /([A-Z]{2,4}\s*\d{3})\s+([\w\s&:\-\(\)\/\.,]+?)\s+(\d(?:\.\d+)?)\s+([A-F][+-]?|I|W|P|S|U)/g;
    let c; while ((c = courseRegex.exec(text)) !== null) {
        if (['I', 'W', 'P', 'S', 'U'].includes(c[4].trim())) continue;
        let currentSem = semestersFound[0] || "Unknown";
        for (let i = 0; i < semestersFound.length; i++) {
            if (c.index > text.indexOf(semestersFound[i])) currentSem = semestersFound[i];
        }
        const code = c[1].replace(/\s/g, '');
        const existingIdx = history.findIndex(h => h.code === code);
        if (existingIdx !== -1) history.splice(existingIdx, 1);

        history.push({ code, credits: parseFloat(c[3]), grade: c[4].trim(), semester: currentSem, points: getPoints(c[4].trim()) });
    }

    semestersFound.forEach(sem => {
        const start = text.indexOf(sem), nextSem = semestersFound[semestersFound.indexOf(sem) + 1];
        const block = text.substring(start, nextSem ? text.indexOf(nextSem) : text.length);
        const cgpaMatch = block.match(/CGPA\s*[:\-]*\s*([\d.]+)/i);
        const gpaMatch = block.match(/\bGPA\s*[:\-]*\s*([\d.]+)/i);
        if (cgpaMatch) {
            let gpaVal = gpaMatch ? parseFloat(gpaMatch[1]) : null;
            if (gpaVal === null) {
                const semCourses = history.filter(h => h.semester === sem);
                const pts = semCourses.reduce((s, c) => s + (c.points * c.credits), 0);
                const crs = semCourses.reduce((s, c) => s + c.credits, 0);
                gpaVal = crs > 0 ? parseFloat((pts / crs).toFixed(2)) : 0;
            }
            transcriptHistory.push({ semester: sem, cgpa: parseFloat(cgpaMatch[1]), gpa: gpaVal });
        }
    });

    return {
        studentName: (nameMatch ? nameMatch[1].trim() : "Student").replace(/PROGRAM/i, ''),
        history, transcriptHistory, semesters: [...new Set(semestersFound)],
        officialCgpa: parseFloat(finalCgpaMatch?.[1] || 0),
        officialCredits: parseFloat(finalCreditsMatch?.[1] || 0),
        plan: detectedPlan
    };
};

// --- PREDICTOR ENGINE & HISTORY EDITOR ---
function renderPredictorHistory() {
    const user = JSON.parse(localStorage.getItem(KEY));
    const list = document.getElementById('predictorHistoryList');
    if (!user || user.history.length === 0) {
        list.innerHTML = `<div class="col-span-full p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center text-slate-500 text-sm">No courses imported yet. Freshers can start adding courses above!</div>`;
        return;
    }

    list.innerHTML = user.history.map(c => `
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
                <p class="font-bold text-sm text-slate-900 dark:text-white">${c.code}</p>
                <p class="text-[10px] uppercase text-slate-500">${c.grade} (${c.points.toFixed(1)}) • ${c.credits} Cr</p>
            </div>
            <button onclick="removeCourseFromHistory('${c.code}')" class="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center" title="Remove Course">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `).join('');
}

window.removeCourseFromHistory = function (code) {
    if (!confirm(`Are you sure you want to remove ${code}? Your base CGPA will be recalculated.`)) return;

    let user = JSON.parse(localStorage.getItem(KEY));
    user.history = user.history.filter(c => c.code !== code);

    // Recalculate Base Profile
    let pts = 0, crs = 0;
    user.history.forEach(c => { pts += (c.points * c.credits); crs += c.credits; });
    user.officialCredits = crs;
    user.officialCgpa = crs > 0 ? (pts / crs) : 0;

    localStorage.setItem(KEY, JSON.stringify(user));
    renderPredictorHistory();
    calculatePrediction();
    refreshUI(user);
}

function addPredictorRow() {
    const container = document.getElementById('predictorRows');
    const row = document.createElement('div');
    row.className = "predictor-row flex flex-col md:flex-row gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 items-center relative";
    row.innerHTML = `
        <input type="text" placeholder="Code (e.g. CSE110)" class="p-code flex-1 bg-white dark:bg-slate-800 border-0 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-blue-500 w-full text-slate-900 dark:text-white uppercase">
        <input type="number" placeholder="Cr" value="3" min="1" max="6" class="p-credits w-full md:w-20 bg-white dark:bg-slate-800 border-0 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-blue-500 text-center text-slate-900 dark:text-white">
        <select class="p-grade w-full md:w-28 bg-white dark:bg-slate-800 border-0 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-blue-500 text-slate-900 dark:text-white">
            <option value="4.0">A (4.0)</option>
            <option value="3.7">A- (3.7)</option>
            <option value="3.3">B+ (3.3)</option>
            <option value="3.0">B (3.0)</option>
            <option value="2.7">B- (2.7)</option>
            <option value="2.3">C+ (2.3)</option>
            <option value="2.0">C (2.0)</option>
            <option value="1.7">D+ (1.7)</option>
            <option value="1.3">D (1.3)</option>
            <option value="1.0">D- (1.0)</option>
            <option value="0.0">F (0.0)</option>
        </select>
        <div class="flex items-center gap-2 w-full md:w-auto bg-white dark:bg-slate-800 px-4 py-3 rounded-xl">
            <input type="checkbox" class="p-retake w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer" onchange="toggleRetakeInput(this)">
            <span class="text-xs font-bold text-slate-500">RETAKE?</span>
        </div>
        <input type="text" placeholder="Old Code" class="p-oldcode hidden w-full md:w-28 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-amber-500 uppercase">
        <button onclick="this.parentElement.remove(); calculatePrediction();" class="w-full md:w-auto text-red-500 hover:bg-red-500 hover:text-white p-3 rounded-xl transition-all"><i class="fas fa-times"></i></button>
    `;

    row.querySelectorAll('input, select').forEach(el => el.addEventListener('input', calculatePrediction));
    container.appendChild(row);
    calculatePrediction();
}

window.toggleRetakeInput = function (checkbox) {
    const oldInput = checkbox.parentElement.nextElementSibling;
    if (checkbox.checked) { oldInput.classList.remove('hidden'); oldInput.classList.add('block'); }
    else { oldInput.classList.add('hidden'); oldInput.classList.remove('block'); oldInput.value = ''; }
    calculatePrediction();
};

window.calculatePrediction = function () {
    const user = JSON.parse(localStorage.getItem(KEY));
    if (!user) return;

    let baseCredits = user.officialCredits || 0;
    let basePoints = (user.officialCgpa || 0) * baseCredits;

    document.querySelectorAll('.predictor-row').forEach(row => {
        const credits = parseFloat(row.querySelector('.p-credits').value) || 0;
        const gradePoints = parseFloat(row.querySelector('.p-grade').value) || 0;
        const isRetake = row.querySelector('.p-retake').checked;
        const oldCode = row.querySelector('.p-oldcode').value.replace(/\s/g, '').toUpperCase();

        if (isRetake && oldCode) {
            const oldCourse = user.history.find(c => c.code === oldCode);
            if (oldCourse) {
                basePoints -= (oldCourse.points * oldCourse.credits);
                if (oldCourse.grade === 'F') baseCredits += credits;
            }
        } else {
            baseCredits += credits;
        }
        basePoints += (gradePoints * credits);
    });

    const newCgpa = baseCredits > 0 ? (basePoints / baseCredits).toFixed(2) : "0.00";

    const display = document.getElementById('projectedCgpaDisplay');
    display.innerText = newCgpa;
    document.getElementById('projectedCreditsDisplay').innerText = baseCredits;

    if (parseFloat(newCgpa) > (user.officialCgpa || 0)) { display.className = "text-7xl font-black tracking-tighter mb-2 text-white"; }
    else if (parseFloat(newCgpa) < (user.officialCgpa || 0)) { display.className = "text-7xl font-black tracking-tighter mb-2 text-red-200"; }
    else { display.className = "text-7xl font-black tracking-tighter mb-2 text-white"; }
};

// --- ANALYTICS VIEWS ---
function renderDetailedAudit(user) {
    if (!user || !user.history) return;
    const plan = DEGREE_DATA[user.plan];
    if (!plan) return;

    let usedCodes = new Set();
    let genEdOverflow = [];

    Object.entries(plan.categories).forEach(([catName, rules]) => {
        if (catName === "GenEd Electives" || rules.isElective) return;
        let completed = [], remaining = [], currentCredits = 0;

        if (rules.isRemedial) {
            user.history.forEach(c => { if (!usedCodes.has(c.code) && rules.codes.includes(c.code)) { completed.push(c); usedCodes.add(c.code); } });
            plan.categories[catName]._tempCompleted = completed; plan.categories[catName]._tempRemaining = []; return;
        }

        if (rules.mandatory) {
            rules.mandatory.forEach(mandCode => {
                let found = false;
                const options = mandCode.split('/');
                for (let opt of options) {
                    let c = user.history.find(x => x.code === opt);
                    if (c && !usedCodes.has(c.code)) {
                        if (currentCredits < rules.req) { completed.push(c); usedCodes.add(c.code); currentCredits += c.credits; }
                        else { genEdOverflow.push(c); usedCodes.add(c.code); }
                        found = true; break;
                    }
                }
                if (!found) remaining.push(mandCode);
            });
        }

        user.history.forEach(c => {
            if (!usedCodes.has(c.code)) {
                if ((rules.codes && rules.codes.includes(c.code)) || (rules.matcher && rules.matcher(c.code))) {
                    if (currentCredits < rules.req) { completed.push(c); usedCodes.add(c.code); currentCredits += c.credits; }
                    else if (catName.includes("Stream")) { genEdOverflow.push(c); usedCodes.add(c.code); }
                }
            }
        });

        if (rules.codes && !rules.mandatory) rules.codes.forEach(code => { if (!completed.find(c => c.code === code)) remaining.push(code); });
        plan.categories[catName]._tempCompleted = completed; plan.categories[catName]._tempRemaining = remaining;
    });

    let genEdCat = plan.categories["GenEd Electives"];
    if (genEdCat) {
        let completed = [], currentCredits = 0;
        user.history.forEach(c => { if (!usedCodes.has(c.code) && genEdCat.matcher && genEdCat.matcher(c.code)) { if (currentCredits < genEdCat.req) { completed.push(c); usedCodes.add(c.code); currentCredits += c.credits; } } });
        genEdOverflow.forEach(c => { if (currentCredits < genEdCat.req) { completed.push(c); currentCredits += c.credits; } });
        genEdCat._tempCompleted = completed; genEdCat._tempRemaining = [];
    }

    Object.entries(plan.categories).forEach(([catName, rules]) => {
        if (!rules.isElective) return;
        let completed = [];
        user.history.forEach(course => { if (!usedCodes.has(course.code) && (!rules.matcher || rules.matcher(course.code))) { completed.push(course); usedCodes.add(course.code); } });
        plan.categories[catName]._tempCompleted = completed; plan.categories[catName]._tempRemaining = [];
    });

    let uniCoreHtml = `<div class="col-span-full mb-2 mt-4"><h2 class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2">University Core (39 Credits)</h2></div>`;
    let programHtml = `<div class="col-span-full mb-2 mt-8"><h2 class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2">Program Requirements</h2></div>`;

    Object.entries(plan.categories).forEach(([catName, rules]) => {
        const completed = rules._tempCompleted;
        const remaining = rules._tempRemaining;
        const totalEarned = completed.reduce((sum, c) => sum + c.credits, 0);
        const displayReq = rules.isRemedial ? 0 : rules.req;
        const progressPercent = displayReq === 0 ? 100 : Math.min((totalEarned / displayReq) * 100, 100);

        const card = `
            <div class="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
                <div class="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                    <div>
                        <h3 class="text-slate-900 dark:text-white font-black uppercase tracking-widest text-sm">${catName}</h3>
                        <p class="text-slate-500 text-xs mt-1">${totalEarned} / ${displayReq} Credits Met</p>
                    </div>
                    <span class="text-2xl font-black ${progressPercent >= 100 ? 'text-emerald-500' : 'text-blue-500'}">${Math.round(progressPercent)}%</span>
                </div>
                <div class="p-6">
                    <div class="mb-4">
                        <h4 class="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3"><i class="fas fa-check-circle mr-2"></i> Completed</h4>
                        <div class="flex flex-wrap gap-2">
                            ${completed.length > 0 ? completed.map(c => `<span class="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-200 dark:border-emerald-500/20 px-2 py-1 rounded-md text-[10px] font-bold">${c.code} (${c.grade})</span>`).join('') : '<p class="text-slate-400 italic text-xs">None yet.</p>'}
                        </div>
                    </div>
                    <div>
                        <h4 class="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3"><i class="fas fa-exclamation-triangle mr-2"></i> Remaining</h4>
                        <div class="flex flex-wrap gap-2">
                            ${remaining.length > 0 ? remaining.map(code => `<span class="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 border border-red-200 dark:border-red-500/20 px-2 py-1 rounded-md text-[10px] font-bold">${code}</span>`).join('') : (rules.isElective || rules.isRemedial ? `<p class="text-slate-400 text-xs">${rules.isRemedial ? 'No requirements.' : 'Take electives to fill gap.'}</p>` : '<p class="text-emerald-500 text-xs font-bold">Category Complete!</p>')}
                        </div>
                    </div>
                </div>
            </div>`;

        if (["Remedial Courses", "Stream 1: Writing", "Stream 2: Math/Science", "Stream 3: Humanities", "Stream 4: Social Sciences", "Stream 5: Communities", "GenEd Electives"].includes(catName)) {
            uniCoreHtml += card;
        } else {
            programHtml += card;
        }
    });
    document.getElementById('auditList').innerHTML = uniCoreHtml + programHtml;
}

function renderHistory(user) {
    const historyBody = document.getElementById('historyTable');
    if (!user || !user.semesters) return;

    const recentSems = user.semesters.slice(-1);
    let html = "";
    [...user.semesters].reverse().forEach(sem => {
        const isGreen = recentSems.includes(sem);
        const semCourses = user.history.filter(h => h.semester === sem);

        html += `
            <div class="p-6 rounded-[2rem] border ${isGreen ? 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/5' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50'} shadow-sm">
                <h4 class="text-[10px] font-black uppercase tracking-widest mb-4 ${isGreen ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-500'}">
                    ${sem} ${isGreen ? '• ACTIVE' : ''}
                </h4>
                <div class="space-y-3">
                    ${semCourses.map(c => `
                        <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/50 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                            <div><p class="font-bold text-xs ${isGreen ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}">${c.code}</p></div>
                            <span class="font-black text-xs ${isGreen ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-500'}">${c.grade} <span class="opacity-50 text-[10px] ml-1">(${c.points.toFixed(1)})</span></span>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    });
    historyBody.innerHTML = html;
}

function refreshUI(user) {
    if (!user) return;
    const plan = DEGREE_DATA[user.plan] || DEGREE_DATA.CSE;

    document.getElementById('studentNameDisplay').innerText = user.studentName;
    document.getElementById('nameInitial').innerText = user.studentName[0];
    document.getElementById('navUserPlan').innerText = `${user.plan} Track (${plan.total} Credits)`;

    const cgpa = user.officialCgpa || 0;
    const completed = user.officialCredits || 0;
    document.getElementById('finalGPA').innerText = cgpa.toFixed(2);
    document.getElementById('progressText').innerText = `${completed} / ${plan.total} Credits`;
    document.getElementById('degreeProgressBar').style.width = `${Math.min((completed / plan.total) * 100, 100)}%`;

    document.getElementById('projectedCgpaDisplay').innerText = cgpa.toFixed(2);
    document.getElementById('projectedCreditsDisplay').innerText = completed;

    const badge = document.getElementById('waiverBadgeDetail');
    if (cgpa >= 3.9) { badge.className = "px-4 py-2 rounded-full text-xs font-black bg-emerald-500 text-white"; badge.innerText = "100% WAIVER"; }
    else if (cgpa >= 3.85) { badge.className = "px-4 py-2 rounded-full text-xs font-black bg-blue-500 text-white"; badge.innerText = "75% WAIVER"; }
    else { badge.className = "px-4 py-2 rounded-full text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-500"; badge.innerText = "NO WAIVER"; }

    renderDetailedAudit(user);
    renderHistory(user);
    renderPredictorHistory();
}

window.addEventListener('DOMContentLoaded', () => {
    let user = JSON.parse(localStorage.getItem(KEY));
    if (user && user.history && user.history.length > 0) {
        document.getElementById('gatewayStatus').innerHTML = `<span class="text-emerald-500">Welcome back, ${user.studentName.split(' ')[0]}!</span> Data loaded.`;
        refreshUI(user);
    }

    document.querySelectorAll('.themeToggle').forEach(btn => {
        btn.onclick = () => { document.documentElement.classList.toggle('dark'); };
    });

    // Reset Buttons
    document.querySelectorAll('.resetDataBtn').forEach(btn => {
        btn.onclick = () => {
            if (confirm("Are you sure you want to clear all data and start fresh?")) {
                localStorage.removeItem(KEY);
                location.reload();
            }
        };
    });

    // Feedback Modal logic (Click Outside to Close)
    const fbModal = document.getElementById('feedbackModal');
    const fbBox = document.getElementById('feedbackBox');

    document.querySelectorAll('.helpBtn').forEach(btn => {
        btn.onclick = () => fbModal.classList.remove('hidden');
    });

    // Close when clicking background
    fbModal.addEventListener('click', (e) => {
        if (e.target === fbModal) fbModal.classList.add('hidden');
    });

    document.getElementById('closeFeedback').onclick = () => fbModal.classList.add('hidden');
    document.getElementById('addCourseBtn').onclick = addPredictorRow;

    // Advanced Feedback Payload
    document.getElementById('sendFeedbackBtn').onclick = async () => {
        const name = document.getElementById('fbName').value || "Anonymous";
        const email = document.getElementById('fbEmail').value || "No Email Provided";
        const msg = document.getElementById('fbMessage').value;
        if (!msg) return alert("Please enter a message!");

        try {
            await fetch(DISCORD_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `**New Feedback Received**\n**From:** ${name}\n**Email:** ${email}\n**Message:** ${msg}`
                })
            });
            alert("Feedback sent successfully! Thank you.");
            fbModal.classList.add('hidden');
            document.getElementById('fbMessage').value = '';
        } catch (e) {
            alert("Failed to send feedback. Ensure webhook URL is configured.");
        }
    };

    const handlePDF = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function () {
            try {
                const pdf = await pdfjsLib.getDocument(new Uint8Array(this.result)).promise;
                let text = "";
                for (let i = 1; i <= pdf.numPages; i++) text += (await (await pdf.getPage(i)).getTextContent()).items.map(s => s.str).join(" ") + "\n";
                const parsedData = parseTranscript(text);
                if (parsedData.history.length === 0) { alert("Invalid format."); return; }
                localStorage.setItem(KEY, JSON.stringify(parsedData));
                location.reload();
            } catch (err) { alert("Failed to parse PDF."); }
        };
        reader.readAsArrayBuffer(file);
    };

    document.getElementById('pdfUploadGateway').onchange = handlePDF;
    document.querySelectorAll('.pdfUploadGlobal').forEach(input => input.onchange = handlePDF);
});

const urls = ['https://monowar.me', 'https://mono.pro.bd', 'https://monowar.pro.bd'];
const devLink = document.getElementById('devLink');
const checkUrl = async (url) => { try { await fetch(url, { mode: 'no-cors' }); return true; } catch (e) { return false; } };
(async () => { for (let url of urls) { if (await checkUrl(url)) { devLink.href = url; break; } } })();