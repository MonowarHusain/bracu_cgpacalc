import { parseBracuTranscript } from './parser.js';

const STORAGE_KEY = 'bracu_dashboard_data_v3';

const ui = {
    pdfInput: document.getElementById('pdfUpload'),
    pdfStatus: document.getElementById('pdfStatus'),
    currentGPA: document.getElementById('currentCGPA'),
    currentCredits: document.getElementById('completedCredits'),
    courseContainer: document.getElementById('courseInputs'),
    finalGPA: document.getElementById('finalGPA'),
    projectedCredits: document.getElementById('projectedCredits'),
    historySec: document.getElementById('historySection'),
    historyBody: document.getElementById('historyBody'),
    resetBtn: document.getElementById('resetApp')
};

// --- INITIALIZATION (Load Everything) ---
window.addEventListener('DOMContentLoaded', () => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (saved) {
        // 1. Restore Inputs
        ui.currentGPA.value = saved.cgpa || "";
        ui.currentCredits.value = saved.credits || "";

        // 2. Restore Planned Course Rows
        if (saved.plannedCourses && saved.plannedCourses.length > 0) {
            ui.courseContainer.innerHTML = '';
            saved.plannedCourses.forEach(c => addCourseRow(c.grade, c.credits));
        } else {
            addCourseRow();
        }

        // 3. Restore Transcript History Table
        if (saved.transcriptHistory && saved.transcriptHistory.length > 0) {
            renderHistory(saved.transcriptHistory);
        }
    } else {
        addCourseRow();
    }

    ui.currentGPA.addEventListener('input', updateUI);
    ui.currentCredits.addEventListener('input', updateUI);
    updateUI();
});

// --- CORE CALCULATION & STORAGE ---
function updateUI() {
    const cgpa = parseFloat(ui.currentGPA.value) || 0;
    const credits = parseFloat(ui.currentCredits.value) || 0;

    const rows = document.querySelectorAll('#courseInputs > div');
    let semQP = 0;
    let semCredits = 0;
    const planned = [];

    rows.forEach(row => {
        const gVal = row.querySelector('.row-grade').value;
        const cVal = row.querySelector('.row-credits').value;
        const g = parseFloat(gVal);
        const c = parseFloat(cVal) || 0;

        semQP += (g * c);
        semCredits += c;
        planned.push({ grade: gVal, credits: cVal });
    });

    const totalCredits = credits + semCredits;
    const final = totalCredits === 0 ? 0 : ((cgpa * credits) + semQP) / totalCredits;

    ui.finalGPA.innerText = final.toFixed(2);
    ui.projectedCredits.innerText = totalCredits;

    // Persist current state while keeping the history intact
    const existingData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...existingData,
        cgpa,
        credits,
        plannedCourses: planned
    }));
}

// --- PDF IMPORT ---
ui.pdfInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    ui.pdfStatus.innerText = "Syncing Records...";

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

        // Update UI
        ui.currentGPA.value = data.currentCGPA;
        ui.currentCredits.value = data.completedCredits;

        // Render and SAVE History
        renderHistory(data.courses);

        const currentData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...currentData,
            cgpa: data.currentCGPA,
            credits: data.completedCredits,
            transcriptHistory: data.courses
        }));

        ui.pdfStatus.innerHTML = `<span class="text-emerald-400 font-bold">Imported: ${data.courses.length} Courses</span>`;
        updateUI();
    };
    reader.readAsArrayBuffer(file);
});

// --- UI HELPERS ---
function addCourseRow(defaultG = "4.0", defaultC = "3") {
    const div = document.createElement('div');
    div.className = "flex gap-4 p-4 bg-slate-900/40 rounded-2xl border border-slate-800/50 mb-4";
    div.innerHTML = `
        <div class="flex-1"><select class="row-grade w-full bg-slate-900 text-white rounded-lg p-2 text-sm border border-slate-700">
            <option value="4.0" ${defaultG === "4.0" ? 'selected' : ''}>A (4.00)</option>
            <option value="3.7" ${defaultG === "3.7" ? 'selected' : ''}>A- (3.70)</option>
            <option value="3.3" ${defaultG === "3.3" ? 'selected' : ''}>B+ (3.30)</option>
            <option value="3.0" ${defaultG === "3.0" ? 'selected' : ''}>B (3.00)</option>
            <option value="2.0" ${defaultG === "2.0" ? 'selected' : ''}>C (2.00)</option>
            <option value="0.0" ${defaultG === "0.0" ? 'selected' : ''}>F (0.00)</option>
        </select></div>
        <div class="w-24"><input type="number" value="${defaultC}" class="row-credits w-full bg-slate-900 text-white rounded-lg p-2 text-sm border border-slate-700 text-center"></div>
        <button class="remove-row p-2 text-slate-500 hover:text-red-500"><i class="fas fa-trash-alt"></i></button>
    `;
    ui.courseContainer.appendChild(div);

    div.querySelector('.row-grade').onchange = updateUI;
    div.querySelector('.row-credits').oninput = updateUI;
    div.querySelector('.remove-row').onclick = () => { div.remove(); updateUI(); };
}

function renderHistory(courses) {
    if (!courses || courses.length === 0) return;
    ui.historySec.classList.remove('hidden');
    ui.historyBody.innerHTML = courses.map(c => `
        <tr class="border-b border-slate-800/50">
            <td class="py-2 text-blue-400 font-mono text-xs">${c.code}</td>
            <td class="py-2 text-center text-slate-400">${c.credits.toFixed(1)}</td>
            <td class="py-2 text-right font-bold text-slate-200">${c.grade}</td>
        </tr>
    `).join('');
}

document.getElementById('addCourseBtn').onclick = () => { addCourseRow(); updateUI(); };
ui.resetBtn.onclick = () => { if (confirm("Wipe all data?")) { localStorage.clear(); location.reload(); } };