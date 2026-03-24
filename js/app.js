/**
 * BRACU CGPA Dash - Master Logic
 */

// --- 1. THE PDF PARSER ---
const parseBracuTranscript = (text) => {
    const courseMap = new Map();
    const semestersFound = [];

    const nameMatch = text.match(/Name\s*[:\-]*\s*([A-Za-z\s\.]+?)\s*(?:BRAC\s+UNIVERSITY|BRAC|University|Student ID|PROGRAM)/i);
    const studentName = nameMatch && nameMatch[1] ? nameMatch[1].trim() : "Student";

    const semesterRegex = /SEMESTER:\s+([A-Z]+\s+\d{4})/gi;
    let semMatch;
    while ((semMatch = semesterRegex.exec(text)) !== null) semestersFound.push(semMatch[1].trim());

    const courseRegex = /([A-Z]{2,3}\s?\d{3})\s+[\w\s&:-]+\s+(\d\.\d{2})\s+([A-F][+-]?(\s\(\w+\))?|I)/g;
    let currentMatch;
    let lastSem = semestersFound.length > 0 ? semestersFound[0] : "Unknown";

    while ((currentMatch = courseRegex.exec(text)) !== null) {
        const [_, code, credits, gradeInfo] = currentMatch;
        const index = currentMatch.index;

        let detectedSem = semestersFound.find((s, i) => {
            const start = text.indexOf(s);
            const end = semestersFound[i + 1] ? text.indexOf(semestersFound[i + 1]) : text.length;
            return index >= start && index < end;
        }) || lastSem;

        const cleanCode = code.replace(/\s/g, '');
        const cleanGrade = gradeInfo.trim();
        if (cleanGrade.includes('I') || cleanGrade.includes('(NT)')) continue;

        courseMap.set(cleanCode, {
            code: cleanCode,
            credits: parseFloat(credits),
            grade: cleanGrade,
            semester: detectedSem,
            points: getPointsForTable(cleanGrade)
        });
        lastSem = detectedSem;
    }

    const cgpaMatches = [...text.matchAll(/CGPA\s*([\d.]+)/gi)];
    const earnedMatches = [...text.matchAll(/Credits\s+Earned\s*([\d.]+)/gi)];

    return {
        studentName,
        enrollmentSemester: semestersFound[0] || "Unknown",
        currentCGPA: parseFloat(cgpaMatches.length ? cgpaMatches.pop()[1] : 0),
        completedCredits: parseFloat(earnedMatches.length ? earnedMatches.pop()[1] : 0),
        courses: Array.from(courseMap.values()),
        semesters: [...new Set(semestersFound)]
    };
};

function getPointsForTable(g) {
    const table = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'D+': 1.7, 'D': 1.3, 'D-': 1.0, 'F': 0.0 };
    return table[g.split(' ')[0]] || 0.0;
}

// --- 2. THE APP CORE ---
const KEY = 'bracu_dash_v12_pro';

const elements = {
    name: document.getElementById('studentName'),
    initial: document.getElementById('nameInitial'),
    enrollment: document.getElementById('enrollmentSem'),
    cgpa: document.getElementById('currentCGPA'),
    credits: document.getElementById('completedCredits'),
    container: document.getElementById('courseInputs'),
    finalGpa: document.getElementById('finalGPA'),
    projCredits: document.getElementById('projectedCredits'),
    pdfInput: document.getElementById('pdfUpload'),
    pdfStatus: document.getElementById('pdfStatus'),
    addBtn: document.getElementById('addCourseBtn'),
    historyBody: document.getElementById('historyBody'),
    themeBtn: document.getElementById('themeToggle'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    sidebar: document.getElementById('historySidebar'),
    openHistory: document.getElementById('openHistory'),
    closeHistory: document.getElementById('closeHistory'),
    resetFull: document.getElementById('resetFull'),
    helpBtn: document.getElementById('helpBtn'),
    helpModal: document.getElementById('helpModal'),
    closeHelp: document.getElementById('closeHelp'),
    footerFeedback: document.getElementById('footerFeedback'),
    sendFeedback: document.getElementById('sendFeedback'),
    tabGuide: document.getElementById('tabGuide'),
    tabFeedback: document.getElementById('tabFeedback'),
    contentGuide: document.getElementById('contentGuide'),
    contentFeedback: document.getElementById('contentFeedback')
};

window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.theme === 'light') document.documentElement.classList.remove('dark');
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) {
        elements.name.value = saved.name || "";
        elements.enrollment.value = saved.enrollment || "";
        elements.cgpa.value = saved.cgpa || "";
        elements.credits.value = saved.credits || "";
        updateInitial(saved.name);
        if (saved.courses && saved.courses.length > 0) {
            elements.container.innerHTML = '';
            saved.courses.forEach(c => addCourseRow(c.grade, c.credits, c.retakeTarget));
        } else addCourseRow();
        if (saved.history) renderHistory(saved.history, saved.semesters);
    } else addCourseRow();

    elements.name.oninput = (e) => { updateInitial(e.target.value); calculate(); };
    elements.enrollment.oninput = calculate;
    elements.cgpa.oninput = calculate;
    elements.credits.oninput = calculate;
    calculate();
});

function calculate() {
    const curCGPA = parseFloat(elements.cgpa.value) || 0;
    const curCreds = parseFloat(elements.credits.value) || 0;
    const saved = JSON.parse(localStorage.getItem(KEY)) || {};
    const history = saved.history || [];

    let totalPoints = curCGPA * curCreds;
    let totalCredits = curCreds;
    const savedRows = [];

    document.querySelectorAll('.course-row').forEach(row => {
        const grade = parseFloat(row.querySelector('.row-grade').value);
        const creds = parseFloat(row.querySelector('.row-credits').value) || 0;
        const isR = row.querySelector('.is-retake').checked;
        const target = row.querySelector('.retake-target').value;

        if (isR && target) {
            const old = history.find(h => h.code === target);
            if (old) totalPoints -= (getPointsForTable(old.grade) * old.credits);
        } else totalCredits += creds;

        totalPoints += (grade * creds);
        savedRows.push({ grade, credits: creds, retakeTarget: isR ? target : null });
    });

    elements.finalGpa.innerText = (totalCredits === 0 ? 0 : totalPoints / totalCredits).toFixed(2);
    elements.projCredits.innerText = totalCredits;

    localStorage.setItem(KEY, JSON.stringify({
        ...saved,
        name: elements.name.value,
        enrollment: elements.enrollment.value,
        cgpa: elements.cgpa.value,
        credits: elements.credits.value,
        courses: savedRows
    }));
}

function addCourseRow(defaultG = "4.0", defaultC = "3", target = null) {
    const saved = JSON.parse(localStorage.getItem(KEY));
    const history = saved?.history || [];
    const div = document.createElement('div');
    // --- HEIGHT INCREASED ---
    div.className = "course-row p-6 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-[2rem] transition-all";
    div.innerHTML = `
        <div class="flex gap-4 mb-4">
            <select class="row-grade flex-1 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4 text-sm font-bold outline-none focus:border-blue-500">
                <option value="4.0" ${defaultG == 4.0 ? 'selected' : ''}>A (4.0)</option>
                <option value="3.7" ${defaultG == 3.7 ? 'selected' : ''}>A- (3.7)</option>
                <option value="0.0" ${defaultG == 0.0 ? 'selected' : ''}>F (0.0)</option>
            </select>
            <input type="number" value="${defaultC}" class="row-credits w-24 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4 text-sm font-bold text-center outline-none">
            <button class="remove-btn text-slate-400 hover:text-red-500 p-2 transition-colors"><i class="fas fa-trash text-lg"></i></button>
        </div>
        <div class="flex items-center gap-4 pt-5 border-t dark:border-slate-700">
            <input type="checkbox" class="is-retake w-5 h-5 accent-blue-600" ${target ? 'checked' : ''}>
            <span class="text-[11px] font-extrabold text-slate-500 uppercase tracking-tighter">RETAKE/REPEAT</span>
            <select class="retake-target flex-1 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl py-4 px-4 text-[11px] font-bold ${target ? '' : 'hidden'}">
                <option value="">Select Course...</option>
                ${history.map(h => `<option value="${h.code}" ${target === h.code ? 'selected' : ''}>${h.code} (${h.grade}, ${h.semester})</option>`).join('')}
            </select>
        </div>`;

    elements.container.appendChild(div);
    const sel = div.querySelector('.retake-target'), chk = div.querySelector('.is-retake');
    chk.onchange = () => { sel.classList.toggle('hidden', !chk.checked); calculate(); };
    sel.onchange = calculate;
    div.querySelector('.row-grade').onchange = calculate;
    div.querySelector('.row-credits').oninput = calculate;
    div.querySelector('.remove-btn').onclick = () => { div.remove(); calculate(); };
}

function renderHistory(courses, semesters = []) {
    if (!courses || courses.length === 0) return;
    const lastTwo = semesters.slice(-2);
    elements.historyBody.innerHTML = courses.map(c => {
        const isRecent = lastTwo.includes(c.semester);
        const cardClass = isRecent ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-700/50";
        const pillClass = c.grade.startsWith('A') ? "bg-emerald-600" : "bg-teal-600";
        return `
            <div class="p-5 rounded-[1.5rem] border flex justify-between items-center transition-all ${cardClass}">
                <div>
                    <div class="flex items-center gap-3">
                        <span class="font-bold text-blue-500 text-sm">${c.code}</span>
                        <span class="px-2.5 py-1 rounded-lg text-[10px] font-black text-white ${pillClass}">${c.grade} (${c.points.toFixed(2)})</span>
                    </div>
                    <p class="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">${c.semester}</p>
                </div>
                <button class="p-2 text-slate-400 hover:text-red-500" onclick="window.delGrade('${c.code}')"><i class="fas fa-trash"></i></button>
            </div>`;
    }).join('');
}

window.delGrade = (code) => {
    if (confirm(`⚠️ Warning: Deleting ${code} will update your Current Standing. Proceed?`)) {
        let s = JSON.parse(localStorage.getItem(KEY));
        s.history = s.history.filter(c => c.code !== code);
        let bP = 0, bC = 0; s.history.forEach(c => { bP += (getPointsForTable(c.grade) * c.credits); bC += c.credits; });
        elements.cgpa.value = (bC === 0 ? 0 : bP / bC).toFixed(2); elements.credits.value = bC;
        localStorage.setItem(KEY, JSON.stringify({ ...s, cgpa: elements.cgpa.value, credits: bC }));
        location.reload();
    }
};

elements.pdfInput.onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    elements.pdfStatus.classList.remove('hidden');
    const pdf = await pdfjsLib.getDocument(await f.arrayBuffer()).promise;
    let text = ""; for (let i = 1; i <= pdf.numPages; i++) text += (await (await pdf.getPage(i)).getTextContent()).items.map(s => s.str).join(" ");
    const d = parseBracuTranscript(text);
    localStorage.setItem(KEY, JSON.stringify({ name: d.studentName, enrollment: d.enrollmentSemester, cgpa: d.currentCGPA, credits: d.completedCredits, history: d.courses, semesters: d.semesters }));
    location.reload();
};

const switchTab = (i) => {
    [elements.contentGuide, elements.contentFeedback].forEach((c, idx) => c.classList.toggle('hidden', idx !== i));
    [elements.tabGuide, elements.tabFeedback].forEach((t, idx) => t.className = idx === i ? "flex-1 py-4 text-[10px] font-black uppercase border-b-2 border-blue-600 text-blue-600" : "flex-1 py-4 text-[10px] font-black uppercase border-b-2 border-transparent text-slate-400");
};

elements.sendFeedback.onclick = async () => {
    const body = { name: document.getElementById('fbName').value, email: document.getElementById('fbEmail').value, message: document.getElementById('fbMessage').value };
    const res = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { alert("Sent!"); elements.helpModal.classList.add('hidden'); }
};

elements.themeBtn.onclick = () => { const isD = document.documentElement.classList.toggle('dark'); localStorage.theme = isD ? 'dark' : 'light'; };
elements.helpBtn.onclick = () => { elements.helpModal.classList.remove('hidden'); switchTab(0); };
elements.tabGuide.onclick = () => switchTab(0);
elements.tabFeedback.onclick = () => switchTab(1);
elements.footerFeedback.onclick = (e) => { e.preventDefault(); elements.helpModal.classList.remove('hidden'); switchTab(1); };
elements.closeHelp.onclick = () => elements.helpModal.classList.add('hidden');
elements.openHistory.onclick = () => { elements.sidebarOverlay.classList.remove('hidden'); setTimeout(() => elements.sidebar.classList.add('active'), 10); };
elements.closeHistory.onclick = () => { elements.sidebar.classList.remove('active'); setTimeout(() => elements.sidebarOverlay.classList.add('hidden'), 300); };
elements.resetFull.onclick = () => { if (confirm("DANGER: Wiping all data?")) { localStorage.removeItem(KEY); location.reload(); } };

function updateInitial(n) { elements.initial.innerText = n && n.trim().length > 0 ? n.trim().charAt(0).toUpperCase() : "S"; }