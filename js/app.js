import { parseBracuTranscript } from './parser.js';

/**
 * BRACU CGPA Dash - Application Controller
 * Manages UI, Persistence, and Academic Logic.
 */

const STORAGE_KEY = 'bracu_dashboard_data_v3';

const ui = {
    pdfInput: document.getElementById('pdfUpload'),
    pdfStatus: document.getElementById('pdfStatus'),
    currentGPA: document.getElementById('currentCGPA'),
    currentCredits: document.getElementById('completedCredits'),
    courseContainer: document.getElementById('courseInputs'),
    finalGPA: document.getElementById('finalGPA'),
    projectedCredits: document.getElementById('projectedCredits'),
    standingTag: document.getElementById('standingTag'),
    historySec: document.getElementById('historySection'),
    historyBody: document.getElementById('historyBody'),
    addBtn: document.getElementById('addCourseBtn'),
    resetBtn: document.getElementById('resetApp')
};

// --- 1. INITIALIZATION (Restore State) ---
window.addEventListener('DOMContentLoaded', () => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (saved) {
        // Restore manual inputs
        ui.currentGPA.value = saved.cgpa || "";
        ui.currentCredits.value = saved.credits || "";

        // Restore planned course rows
        if (saved.plannedCourses && saved.plannedCourses.length > 0) {
            ui.courseContainer.innerHTML = '';
            saved.plannedCourses.forEach(c => addCourseRow(c.grade, c.credits, c.retakeOf));
        } else {
            addCourseRow();
        }

        // Restore the history table if it existed [cite: 13]
        if (saved.transcriptHistory) {
            renderHistoryTable(saved.transcriptHistory);
        }
    } else {
        addCourseRow();
    }

    // Live sync inputs
    ui.currentGPA.addEventListener('input', updateUI);
    ui.currentCredits.addEventListener('input', updateUI);
    updateUI();
});

// --- 2. THE CALCULATION ENGINE (Handles Retakes) ---
function updateUI() {
    const currentCGPA = parseFloat(ui.currentGPA.value) || 0;
    const currentCredits = parseFloat(ui.currentCredits.value) || 0;
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const history = saved?.transcriptHistory || [];

    let totalPoints = currentCGPA * currentCredits;
    let totalCredits = currentCredits;
    const planned = [];

    // Process every planned row
    document.querySelectorAll('#courseInputs > div').forEach(row => {
        const gradeVal = row.querySelector('.row-grade').value;
        const credsVal = row.querySelector('.row-credits').value;
        const isRetake = row.querySelector('.is-retake').checked;
        const retakeTargetCode = row.querySelector('.retake-selection').value;

        const grade = parseFloat(gradeVal);
        const creds = parseFloat(credsVal) || 0;

        if (isRetake && retakeTargetCode) {
            // Find old grade in history (e.g., MAT216) to replace it [cite: 13]
            const oldCourse = history.find(c => c.code === retakeTargetCode);
            if (oldCourse) {
                // Subtract old points. Credits are already in currentCredits [cite: 13]
                totalPoints -= (getNumericPoints(oldCourse.grade) * oldCourse.credits);
            }
        } else {
            // New course: Add to total credit count
            totalCredits += creds;
        }

        totalPoints += (grade * creds);
        planned.push({ grade: gradeVal, credits: credsVal, retakeOf: isRetake ? retakeTargetCode : null });
    });

    const final = totalCredits === 0 ? 0 : totalPoints / totalCredits;

    // Update UI
    ui.finalGPA.innerText = final.toFixed(2);
    ui.projectedCredits.innerText = totalCredits.toFixed(1);
    updateStandingBadge(final);

    // PERSIST DATA (Spread existing data to keep history)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...saved,
        cgpa: currentCGPA,
        credits: currentCredits,
        plannedCourses: planned
    }));
}

// --- 3. DYNAMIC ROW MANAGEMENT ---
function addCourseRow(defaultG = "4.0", defaultC = "3", retakeOf = null) {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const history = saved?.transcriptHistory || [];

    const div = document.createElement('div');
    div.className = "p-5 bg-slate-900/60 rounded-2xl border border-slate-800 mb-4 transition-all hover:border-slate-700";

    // Generate options from imported PDF data (e.g., CSE110, MAT216) [cite: 13]
    const historyOptions = history.map(c =>
        `<option value="${c.code}" ${retakeOf === c.code ? 'selected' : ''}>${c.code} (Prev: ${c.grade})</option>`
    ).join('');

    div.innerHTML = `
        <div class="flex flex-wrap md:flex-nowrap gap-4 mb-4">
            <div class="flex-1">
                <label class="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Predicted Grade</label>
                <select class="row-grade w-full bg-slate-800 text-white rounded-xl p-3 text-sm border border-slate-700 outline-none focus:border-blue-500">
                    <option value="4.0" ${defaultG === "4.0" ? 'selected' : ''}>A (4.00)</option>
                    <option value="3.7" ${defaultG === "3.7" ? 'selected' : ''}>A- (3.70)</option>
                    <option value="3.3" ${defaultG === "3.3" ? 'selected' : ''}>B+ (3.30)</option>
                    <option value="3.0" ${defaultG === "3.0" ? 'selected' : ''}>B (3.00)</option>
                    <option value="2.0" ${defaultG === "2.0" ? 'selected' : ''}>C (2.00)</option>
                    <option value="0.0" ${defaultG === "0.0" ? 'selected' : ''}>F (0.00)</option>
                </select>
            </div>
            <div class="w-28">
                <label class="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Credits</label>
                <input type="number" value="${defaultC}" class="row-credits w-full bg-slate-800 text-white rounded-xl p-3 text-sm border border-slate-700 text-center outline-none focus:border-blue-500">
            </div>
            <button class="remove-row self-end p-3 text-slate-600 hover:text-red-500 transition-colors"><i class="fas fa-trash-alt"></i></button>
        </div>
        <div class="flex items-center gap-3 pt-3 border-t border-slate-800">
            <input type="checkbox" class="is-retake w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600" ${retakeOf ? 'checked' : ''}>
            <label class="text-[11px] font-semibold text-slate-400 uppercase">Retake/Repeat of Previous Course</label>
            <select class="retake-selection flex-1 bg-slate-800 text-white rounded-lg p-2 text-xs border border-slate-700 ${retakeOf ? '' : 'hidden'}">
                <option value="">Select Course to Replace</option>
                ${historyOptions}
            </select>
        </div>
    `;

    ui.courseContainer.appendChild(div);

    // Row Logic
    const check = div.querySelector('.is-retake');
    const select = div.querySelector('.retake-selection');

    check.onchange = () => {
        select.classList.toggle('hidden', !check.checked);
        updateUI();
    };
    select.onchange = updateUI;
    div.querySelector('.row-grade').onchange = updateUI;
    div.querySelector('.row-credits').oninput = updateUI;
    div.querySelector('.remove-row').onclick = () => { div.remove(); updateUI(); };
}

// --- 4. PDF TRANSCRIPT INTEGRATION ---
ui.pdfInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    ui.pdfStatus.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Syncing Transcript...`;

    const reader = new FileReader();
    reader.onload = async function () {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let text = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(s => s.str).join(" ");
        }

        const data = parseBracuTranscript(text);

        // Auto-fill Cumulative Stats (e.g., 3.49 CGPA, 51.00 Credits) [cite: 13]
        ui.currentGPA.value = data.currentCGPA;
        ui.currentCredits.value = data.completedCredits;

        // Save History and Stats
        const currentData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...currentData,
            cgpa: data.currentCGPA,
            credits: data.completedCredits,
            transcriptHistory: data.courses
        }));

        renderHistoryTable(data.courses);
        ui.pdfStatus.innerHTML = `<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle"></i> Profile Synced Successfully</span>`;
        updateUI();

        // Refresh rows to update retake dropdowns with new history
        refreshAllRows();
    };
    reader.readAsArrayBuffer(file);
});

function renderHistoryTable(courses) {
    ui.historySec.classList.remove('hidden');
    ui.historyBody.innerHTML = courses.map(c => `
        <tr class="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
            <td class="py-3 font-mono text-blue-400 text-xs">${c.code}</td>
            <td class="py-3 text-slate-400 text-center text-xs">${c.credits.toFixed(1)}</td>
            <td class="py-3 text-right font-bold text-slate-200 text-xs">${c.grade}</td>
        </tr>
    `).join('');
}

// --- 5. UTILITIES ---
function getNumericPoints(gradeStr) {
    const grades = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'D+': 1.7, 'D': 1.0, 'F': 0.0 };
    return grades[gradeStr.split(' ')[0]] || 0.0;
}

function updateStandingBadge(gpa) {
    if (gpa >= 3.7) {
        ui.standingTag.className = "text-[10px] font-bold mt-4 px-3 py-1 rounded-full inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
        ui.standingTag.innerText = "VICE CHANCELLOR'S LIST";
    } else if (gpa >= 3.5) {
        ui.standingTag.className = "text-[10px] font-bold mt-4 px-3 py-1 rounded-full inline-block bg-blue-500/10 text-blue-400 border border-blue-500/20";
        ui.standingTag.innerText = "DEAN'S LIST";
    } else {
        ui.standingTag.className = "text-[10px] font-bold mt-4 px-3 py-1 rounded-full inline-block bg-slate-800 text-slate-500";
        ui.standingTag.innerText = "ACADEMIC STANDING: GOOD";
    }
}

function refreshAllRows() {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.plannedCourses) {
        ui.courseContainer.innerHTML = '';
        saved.plannedCourses.forEach(c => addCourseRow(c.grade, c.credits, c.retakeOf));
    }
}

ui.addBtn.onclick = () => { addCourseRow(); updateUI(); };
ui.resetBtn.onclick = () => { if (confirm("This will wipe all imported history and planned courses. Continue?")) { localStorage.clear(); location.reload(); } };