/**
 * BRACU CGPA Dash - Master Logic (Finalized for Vercel)
 */

// --- 1. THE PDF PARSER ---
const parseBracuTranscript = (text) => {
    const courseMap = new Map();
    const semestersFound = [];

    const nameMatch = text.match(/Name\s*[:\-]*\s*([A-Za-z\s\.]+?)\s*(?:BRAC\s+UNIVERSITY|Student ID|PROGRAM)/i);
    const studentName = nameMatch && nameMatch[1] ? nameMatch[1].trim() : "Student";

    const semesterRegex = /SEMESTER:\s+([A-Z]+\s+\d{4})/gi;
    let semMatch;
    while ((semMatch = semesterRegex.exec(text)) !== null) semestersFound.push(semMatch[1].trim());

    const courseRegex = /([A-Z]{2,3}\s?\d{3})\s+[\w\s&:-]+\s+(\d\.\d{2})\s+([A-F][+-]?(\s\(\w+\))?|I)/g;
    let currentMatch, lastSem = semestersFound[0] || "Unknown";
    while ((currentMatch = courseRegex.exec(text)) !== null) {
        const [_, code, credits, gradeInfo] = currentMatch;
        let dSem = semestersFound.find((s, i) => {
            const start = text.indexOf(s), end = semestersFound[i + 1] ? text.indexOf(semestersFound[i + 1]) : text.length;
            return currentMatch.index >= start && currentMatch.index < end;
        }) || lastSem;
        const cleanCode = (code || "").replace(/\s/g, ''), cleanGrade = (gradeInfo || "").trim();
        if (cleanGrade.includes('I') || cleanGrade.includes('(NT)')) continue;
        courseMap.set(cleanCode, { code: cleanCode, credits: parseFloat(credits), grade: cleanGrade, semester: dSem, points: getPoints(cleanGrade) });
    }
    const cgpaMatches = [...text.matchAll(/CGPA\s*([\d.]+)/gi)], creditMatches = [...text.matchAll(/Credits\s+Earned\s*([\d.]+)/gi)];
    return { studentName, enrollment: semestersFound[0] || "Unknown", cgpa: parseFloat(cgpaMatches.pop()?.[1] || 0), credits: parseFloat(creditMatches.pop()?.[1] || 0), courses: Array.from(courseMap.values()), semesters: [...new Set(semestersFound)] };
};

// --- 2. CONFIG & HELPERS ---
const KEY = 'bracu_dash_v12_pro';
function getPoints(g) {
    if (!g) return 0;
    return { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'D+': 1.7, 'D': 1.3, 'D-': 1.0, 'F': 0.0 }[g.split(' ')[0]] || 0;
}

// --- 3. MAIN APP ---
window.addEventListener('DOMContentLoaded', () => {
    const els = {
        name: document.getElementById('studentName'),
        initial: document.getElementById('nameInitial'),
        enrollment: document.getElementById('enrollmentSem'),
        cgpa: document.getElementById('currentCGPA'),
        credits: document.getElementById('completedCredits'),
        container: document.getElementById('courseInputs'),
        finalGpa: document.getElementById('finalGPA'),
        projCredits: document.getElementById('projectedCredits'),
        pdfInput: document.getElementById('pdfUpload'),
        addBtn: document.getElementById('addCourseBtn'),
        resetFull: document.getElementById('resetFull'), // Correct ID
        helpBtn: document.getElementById('helpBtn'),
        helpModal: document.getElementById('helpModal'),
        themeBtn: document.getElementById('themeToggle'),
        openHistory: document.getElementById('openHistory'),
        closeHistory: document.getElementById('closeHistory'),
        historyBody: document.getElementById('historyBody')
    };

    function calculate() {
        const curCGPA = parseFloat(els.cgpa.value) || 0, curCreds = parseFloat(els.credits.value) || 0;
        const saved = JSON.parse(localStorage.getItem(KEY)) || {};
        const history = saved.history || [];
        let tPoints = curCGPA * curCreds, tCreds = curCreds, rows = [];

        document.querySelectorAll('.course-row').forEach(row => {
            const g = parseFloat(row.querySelector('.row-grade').value),
                c = parseFloat(row.querySelector('.row-credits').value) || 0,
                isR = row.querySelector('.is-retake').checked,
                target = row.querySelector('.retake-target').value;
            if (isR && target) {
                const old = history.find(h => h.code === target);
                if (old) tPoints -= (getPoints(old.grade) * old.credits);
            } else tCreds += c;
            tPoints += (g * c);
            rows.push({ grade: g.toString(), credits: c.toString(), retakeTarget: isR ? target : null });
        });
        els.finalGpa.innerText = (tCreds === 0 ? 0 : tPoints / tCreds).toFixed(2);
        els.projCredits.innerText = tCreds;
        localStorage.setItem(KEY, JSON.stringify({ ...saved, name: els.name.value, enrollment: els.enrollment.value, cgpa: els.cgpa.value, credits: els.credits.value, courses: rows }));
    }

    function addCourseRow(defaultG = "4.0", defaultC = "3", target = null) {
        const saved = JSON.parse(localStorage.getItem(KEY)) || {};
        const history = saved.history || [];
        const div = document.createElement('div');
        div.className = "course-row p-6 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-[2rem] mb-6";
        div.innerHTML = `
            <div class="flex gap-4 mb-5">
                <select class="row-grade flex-1 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4 text-sm font-bold outline-none focus:border-blue-500">
                    <option value="4.0" ${defaultG == 4.0 ? 'selected' : ''}>A (4.0)</option>
                    <option value="3.7" ${defaultG == 3.7 ? 'selected' : ''}>A- (3.7)</option>
                    <option value="0.0" ${defaultG == 0.0 ? 'selected' : ''}>F (0.0)</option>
                </select>
                <input type="number" value="${defaultC}" class="row-credits w-24 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4 text-sm font-bold text-center outline-none">
                <button class="remove-btn p-2 text-slate-400 hover:text-red-500 transition-colors"><i class="fas fa-trash text-lg"></i></button>
            </div>
            <div class="flex items-center gap-4 pt-5 border-t dark:border-slate-700">
                <input type="checkbox" class="is-retake w-5 h-5 accent-blue-600" ${target ? 'checked' : ''}>
                <span class="text-[11px] font-extrabold text-slate-500 uppercase tracking-tighter">RETAKE/REPEAT</span>
                <select class="retake-target flex-1 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl py-4 px-4 text-[11px] font-bold ${target ? '' : 'hidden'}">
                    <option value="">Select Course...</option>
                    ${history.map(h => `<option value="${h.code}" ${target === h.code ? 'selected' : ''}>${(h.code || '')} (${(h.grade || '')}, ${(h.semester || '')})</option>`).join('')}
                </select>
            </div>`;
        els.container.appendChild(div);
        const sel = div.querySelector('.retake-target'), chk = div.querySelector('.is-retake');
        chk.onchange = () => { sel.classList.toggle('hidden', !chk.checked); calculate(); };
        sel.onchange = calculate;
        div.querySelector('.row-grade').onchange = calculate;
        div.querySelector('.row-credits').oninput = calculate;
        div.querySelector('.remove-btn').onclick = () => { div.remove(); calculate(); };
    }

    function renderHistory(courses, semesters = []) {
        const lastTwo = (semesters || []).slice(-2);
        els.historyBody.innerHTML = (courses || []).map(c => {
            const isRecent = lastTwo.includes(c.semester);
            const cardStyle = isRecent ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/30" : "bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/50";
            const pillStyle = (c.grade || '').startsWith('A') ? "bg-emerald-500" : "bg-teal-500";
            return `
                <div class="p-6 rounded-[1.5rem] border flex justify-between items-center mb-5 shadow-sm ${cardStyle}">
                    <div class="space-y-1">
                        <div class="flex items-center gap-3">
                            <span class="font-bold text-blue-500 text-sm tracking-tight">${c.code}</span>
                            <span class="px-3 py-1 rounded-lg text-[10px] font-extrabold text-white ${pillStyle}">${c.grade} (${(c.points || 0).toFixed(2)})</span>
                        </div>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${c.semester}</p>
                    </div>
                    <button class="p-2 text-slate-300 hover:text-red-500 transition-colors" onclick="window.delGrade('${c.code}')"><i class="fas fa-trash"></i></button>
                </div>`;
        }).join('');
    }

    window.delGrade = (code) => {
        if (!confirm(`⚠️ Deleting ${code} will alter your Cumulative standing. Proceed?`)) return;
        let s = JSON.parse(localStorage.getItem(KEY));
        s.history = s.history.filter(c => c.code !== code);
        let bP = 0, bC = 0; s.history.forEach(c => { bP += (getPoints(c.grade) * c.credits); bC += c.credits; });
        els.cgpa.value = (bC === 0 ? 0 : bP / bC).toFixed(2); els.credits.value = bC;
        localStorage.setItem(KEY, JSON.stringify({ ...s, cgpa: els.cgpa.value, credits: bC }));
        renderHistory(s.history, s.semesters); calculate();
    };

    // --- NUCLEAR RESET LOGIC ---
    els.resetFull.onclick = () => {
        if (confirm("🚨 DANGER: This will delete your Name, Transcript History, and Planner. Are you sure?")) {
            // 1. Clear Local Storage
            localStorage.removeItem(KEY);

            // 2. Explicitly wipe all UI values (Overcomes browser auto-fill)
            els.name.value = "";
            els.enrollment.value = "";
            els.cgpa.value = "";
            els.credits.value = "";
            els.initial.innerText = "S";
            els.container.innerHTML = "";
            els.historyBody.innerHTML = "";
            els.finalGpa.innerText = "0.00";
            els.projCredits.innerText = "0";

            // 3. Force reload to a clean state
            location.reload();
        }
    };

    // --- OTHER ACTIONS ---
    els.addBtn.onclick = () => { addCourseRow(); calculate(); };

    els.pdfInput.onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        const pdf = await pdfjsLib.getDocument(await f.arrayBuffer()).promise;
        let t = ""; for (let i = 1; i <= pdf.numPages; i++) t += (await (await pdf.getPage(i)).getTextContent()).items.map(s => s.str).join(" ");
        const d = parseBracuTranscript(t);
        localStorage.setItem(KEY, JSON.stringify({ name: d.studentName, enrollment: d.enrollment, cgpa: d.cgpa, credits: d.credits, history: d.courses, semesters: d.semesters }));
        location.reload();
    };

    document.getElementById('sendFeedback').onclick = async () => {
        const body = { name: document.getElementById('fbName').value, email: document.getElementById('fbEmail').value, message: document.getElementById('fbMessage').value };
        const res = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) { alert("Feedback Sent!"); document.getElementById('helpModal').classList.add('hidden'); }
    };

    const switchTab = (i) => {
        [document.getElementById('contentGuide'), document.getElementById('contentFeedback')].forEach((c, idx) => c.classList.toggle('hidden', idx !== i));
        [document.getElementById('tabGuide'), document.getElementById('tabFeedback')].forEach((t, idx) => t.className = idx === i ? "flex-1 py-4 text-[10px] font-black uppercase border-b-2 border-blue-600 text-blue-600" : "flex-1 py-4 text-[10px] font-black uppercase border-b-2 border-transparent text-slate-400");
    };

    els.helpBtn.onclick = () => { els.helpModal.classList.remove('hidden'); switchTab(0); };
    document.getElementById('tabGuide').onclick = () => switchTab(0);
    document.getElementById('tabFeedback').onclick = () => switchTab(1);
    document.getElementById('closeHelp').onclick = () => els.helpModal.classList.add('hidden');
    document.getElementById('footerFeedback').onclick = (e) => { e.preventDefault(); els.helpModal.classList.remove('hidden'); switchTab(1); };
    els.themeBtn.onclick = () => { const isD = document.documentElement.classList.toggle('dark'); localStorage.theme = isD ? 'dark' : 'light'; };
    els.openHistory.onclick = () => { document.getElementById('sidebarOverlay').classList.remove('hidden'); setTimeout(() => document.getElementById('historySidebar').classList.add('active'), 10); };
    els.closeHistory.onclick = () => { document.getElementById('historySidebar').classList.remove('active'); setTimeout(() => document.getElementById('sidebarOverlay').classList.add('hidden'), 300); };
    els.name.oninput = (e) => { els.initial.innerText = e.target.value.charAt(0).toUpperCase() || "S"; calculate(); };

    // Initial Load
    if (localStorage.theme === 'light') document.documentElement.classList.remove('dark');
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) {
        els.name.value = saved.name || ""; els.enrollment.value = saved.enrollment || ""; els.cgpa.value = saved.cgpa || ""; els.credits.value = saved.credits || "";
        els.initial.innerText = saved.name ? saved.name.charAt(0).toUpperCase() : "S";
        if (saved.courses && saved.courses.length > 0) {
            els.container.innerHTML = '';
            saved.courses.forEach(c => addCourseRow(c.grade, c.credits, c.retakeTarget));
        } else addCourseRow();
        if (saved.history) renderHistory(saved.history, saved.semesters);
    } else addCourseRow();

    calculate();
});