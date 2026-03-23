import { parseBracuTranscript } from './parser.js';

const KEY = 'bracu_dash_v7_final';

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
    closeHelp: document.getElementById('closeHelp')
};

// --- INITIALIZATION ---
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
        } else { addCourseRow(); }

        if (saved.history) renderHistory(saved.history, saved.semesters);
    } else {
        addCourseRow();
    }

    elements.name.oninput = (e) => { updateInitial(e.target.value); calculate(); };
    elements.enrollment.oninput = calculate;
    elements.cgpa.oninput = calculate;
    elements.credits.oninput = calculate;
    calculate();
});

function updateInitial(name) {
    elements.initial.innerText = name && name.trim().length > 0 ? name.trim().charAt(0).toUpperCase() : "S";
}

// --- CALCULATION ENGINE ---
function calculate() {
    const currentCGPA = parseFloat(elements.cgpa.value) || 0;
    const currentCredits = parseFloat(elements.credits.value) || 0;
    const saved = JSON.parse(localStorage.getItem(KEY)) || {};
    const history = saved.history || [];

    let totalPoints = currentCGPA * currentCredits;
    let totalCredits = currentCredits;
    const savedCourses = [];

    document.querySelectorAll('.course-row').forEach(row => {
        const grade = parseFloat(row.querySelector('.row-grade').value);
        const creds = parseFloat(row.querySelector('.row-credits').value) || 0;
        const isRetake = row.querySelector('.is-retake').checked;
        const target = row.querySelector('.retake-target').value;

        if (isRetake && target) {
            const old = history.find(h => h.code === target);
            if (old) totalPoints -= (getPoints(old.grade) * old.credits);
        } else {
            totalCredits += creds;
        }

        totalPoints += (grade * creds);
        savedCourses.push({ grade, credits: creds, retakeTarget: isRetake ? target : null });
    });

    const final = totalCredits === 0 ? 0 : (totalPoints / totalCredits);
    elements.finalGpa.innerText = final.toFixed(2);
    elements.projCredits.innerText = totalCredits;

    localStorage.setItem(KEY, JSON.stringify({
        ...saved,
        name: elements.name.value,
        enrollment: elements.enrollment.value,
        cgpa: elements.cgpa.value,
        credits: elements.credits.value,
        courses: savedCourses
    }));
}

// --- UI HELPERS ---
function addCourseRow(defaultG = "4.0", defaultC = "3", target = null) {
    const saved = JSON.parse(localStorage.getItem(KEY));
    const history = saved?.history || [];

    const div = document.createElement('div');
    div.className = "course-row p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl transition-all";

    div.innerHTML = `
        <div class="flex gap-4 mb-3">
            <select class="row-grade flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm font-bold outline-none focus:border-blue-500">
                <option value="4.0" ${defaultG == 4.0 ? 'selected' : ''}>A (4.0)</option>
                <option value="3.7" ${defaultG == 3.7 ? 'selected' : ''}>A- (3.7)</option>
                <option value="3.3" ${defaultG == 3.3 ? 'selected' : ''}>B+ (3.3)</option>
                <option value="3.0" ${defaultG == 3.0 ? 'selected' : ''}>B (3.0)</option>
                <option value="2.7" ${defaultG == 2.7 ? 'selected' : ''}>B- (2.7)</option>
                <option value="2.3" ${defaultG == 2.3 ? 'selected' : ''}>C+ (2.3)</option>
                <option value="2.0" ${defaultG == 2.0 ? 'selected' : ''}>C (2.0)</option>
                <option value="1.0" ${defaultG == 1.0 ? 'selected' : ''}>D (1.0)</option>
                <option value="0.0" ${defaultG == 0.0 ? 'selected' : ''}>F (0.0)</option>
            </select>
            <input type="number" value="${defaultC}" class="row-credits w-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm font-bold text-center outline-none focus:border-blue-500">
            <button class="remove-btn text-slate-400 hover:text-red-500 p-2"><i class="fas fa-trash"></i></button>
        </div>
        <div class="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <input type="checkbox" class="is-retake w-4 h-4" ${target ? 'checked' : ''}>
            <span class="text-[10px] font-bold text-slate-500 uppercase">Retake</span>
            <select class="retake-target flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2.5 px-2 text-[10px] font-medium ${target ? '' : 'hidden'}">
                <option value="">Select Course (Grade, Semester)...</option>
                ${history.map(h => `<option value="${h.code}" ${target === h.code ? 'selected' : ''}>${h.code} (${h.grade}, ${h.semester})</option>`).join('')}
            </select>
        </div>
    `;
    elements.container.appendChild(div);

    const check = div.querySelector('.is-retake');
    const select = div.querySelector('.retake-target');

    check.onchange = (e) => {
        select.classList.toggle('hidden', !e.target.checked);
        calculate();
    };

    // FIXED: Added immediate calculation when the course selection changes
    select.onchange = calculate;

    div.querySelector('.row-grade').onchange = calculate;
    div.querySelector('.row-credits').oninput = calculate;
    div.querySelector('.remove-btn').onclick = () => { div.remove(); calculate(); };
}

// History sidebar showing GPA points
function renderHistory(courses, semesters = []) {
    if (!courses || courses.length === 0) {
        elements.historyBody.innerHTML = `<div class="text-center text-slate-500 text-xs mt-10">No grades imported yet.</div>`;
        return;
    }

    const recentTwo = semesters.slice(-2);
    elements.historyBody.innerHTML = courses.map(c => {
        const isEligible = recentTwo.includes(c.semester);
        return `
            <div class="p-3 rounded-xl border ${isEligible ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'} flex justify-between items-center group">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-xs text-blue-500">${c.code}</span>
                        <span class="text-[10px] font-black px-2 py-0.5 rounded ${isEligible ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}">${c.grade} (${c.points.toFixed(2)})</span>
                    </div>
                    <p class="text-[9px] text-slate-500 font-bold mt-1 uppercase">${c.semester}</p>
                </div>
                <button class="delete-grade-btn text-slate-300 hover:text-red-500 transition-colors p-2" data-code="${c.code}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.delete-grade-btn').forEach(btn => {
        btn.onclick = () => deleteHistoryCourse(btn.getAttribute('data-code'));
    });
}

function deleteHistoryCourse(code) {
    if (confirm(`Remove ${code}? Your Current Standing will update.`)) {
        let saved = JSON.parse(localStorage.getItem(KEY)) || {};
        if (saved.history) {
            saved.history = saved.history.filter(c => c.code !== code);
            let bP = 0, bC = 0;
            saved.history.forEach(c => {
                bP += (getPoints(c.grade) * c.credits);
                bC += c.credits;
            });
            const nCGPA = bC === 0 ? 0 : (bP / bC);
            elements.cgpa.value = nCGPA.toFixed(2);
            elements.credits.value = bC;
            saved.cgpa = elements.cgpa.value;
            saved.credits = elements.credits.value;
            localStorage.setItem(KEY, JSON.stringify(saved));
            renderHistory(saved.history, saved.semesters);
            calculate();
        }
    }
}

function getPoints(g) {
    const table = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'D+': 1.7, 'D': 1.3, 'D-': 1.0, 'F': 0.0 };
    return table[g.split(' ')[0]] || 0;
}

// PDF Import Logic
elements.pdfInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    elements.pdfStatus.classList.remove('hidden');
    elements.pdfStatus.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(s => s.str).join(" ");
    }

    const data = parseBracuTranscript(fullText);
    const saved = JSON.parse(localStorage.getItem(KEY)) || {};

    localStorage.setItem(KEY, JSON.stringify({
        ...saved,
        name: data.studentName,
        enrollment: data.enrollmentSemester,
        cgpa: data.currentCGPA,
        credits: data.completedCredits,
        history: data.courses,
        semesters: data.semesters
    }));

    location.reload();
};

// Events
elements.addBtn.onclick = () => { addCourseRow(); calculate(); };
elements.themeBtn.onclick = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.theme = isDark ? 'dark' : 'light';
};
elements.openHistory.onclick = () => {
    elements.sidebarOverlay.classList.remove('hidden');
    setTimeout(() => elements.sidebar.classList.add('active'), 10);
};
elements.closeHistory.onclick = () => {
    elements.sidebar.classList.remove('active');
    setTimeout(() => elements.sidebarOverlay.classList.add('hidden'), 300);
};
elements.helpBtn.onclick = () => elements.helpModal.classList.remove('hidden');
elements.closeHelp.onclick = () => elements.helpModal.classList.add('hidden');

// --- RESET ALL LOGIC ---
elements.resetFull.onclick = () => {
    if (confirm("DANGER: This will delete everything (Name, Grades, Planner). Nothing will remain.")) {
        localStorage.removeItem(KEY);

        // Explicitly clear DOM values
        elements.name.value = "";
        elements.enrollment.value = "";
        elements.cgpa.value = "";
        elements.credits.value = "";
        elements.initial.innerText = "S";
        elements.container.innerHTML = "";
        elements.finalGpa.innerText = "0.00";
        elements.projCredits.innerText = "0";

        location.reload();
    }
};