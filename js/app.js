import { parseBracuTranscript } from './parser.js';

// --- MATH ENGINE ---
const calculateFinalCGPA = (currGPA, currCredits, newCourses) => {
    let totalPoints = currGPA * currCredits;
    let totalCredits = currCredits;

    newCourses.forEach(c => {
        totalPoints += (parseFloat(c.grade) * parseFloat(c.credits));
        totalCredits += parseFloat(c.credits);
    });

    return totalCredits === 0 ? 0 : totalPoints / totalCredits;
};

// --- DOM ELEMENTS ---
const elements = {
    form: document.getElementById('cgpaForm'),
    courses: document.getElementById('courseInputs'),
    addBtn: document.getElementById('addCourseBtn'),
    pdf: document.getElementById('pdfUpload'),
    status: document.getElementById('pdfStatus'),
    historySec: document.getElementById('historySection'),
    historyBody: document.getElementById('historyBody'),
    resultCard: document.getElementById('resultCard'),
    finalGPA: document.getElementById('finalGPA')
};

// --- INITIALIZE ---
window.addEventListener('DOMContentLoaded', () => {
    // Load from Cache
    const saved = JSON.parse(localStorage.getItem('bracu_pro_cache'));
    if (saved) {
        document.getElementById('currentCGPA').value = saved.cgpa;
        document.getElementById('completedCredits').value = saved.credits;
    }
    addCourseRow();
});

// --- UI LOGIC ---
elements.addBtn.addEventListener('click', addCourseRow);

function addCourseRow() {
    const div = document.createElement('div');
    div.className = "flex gap-3 group animate-in fade-in slide-in-from-left-2 duration-300";
    div.innerHTML = `
        <select class="course-grade flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500">
            <option value="4.0">A (4.00)</option>
            <option value="3.7">A- (3.70)</option>
            <option value="3.3">B+ (3.30)</option>
            <option value="3.0">B (3.00)</option>
            <option value="2.7">B- (2.70)</option>
            <option value="2.3">C+ (2.30)</option>
            <option value="2.0">C (2.00)</option>
            <option value="0.0">F (0.00)</option>
        </select>
        <input type="number" placeholder="Credits" value="3" class="course-credits w-24 bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500">
    `;
    elements.courses.appendChild(div);
}

// --- PDF HANDLER ---
elements.pdf.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    elements.status.innerText = "Processing Student Transcript...";

    try {
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

            // Update UI with Cumulative Data 
            document.getElementById('currentCGPA').value = data.currentCGPA;
            document.getElementById('completedCredits').value = data.completedCredits;

            renderHistory(data.courses);
            elements.status.innerHTML = `<span class="text-blue-400 font-bold"><i class="fas fa-check-circle"></i> Records Imported Successfully</span>`;
        };
        reader.readAsArrayBuffer(file);
    } catch (err) {
        elements.status.innerText = "Error: Invalid PDF format.";
    }
});

function renderHistory(courses) {
    elements.historySec.classList.remove('hidden');
    elements.historyBody.innerHTML = '';
    document.getElementById('courseCount').innerText = `${courses.length} COURSES`;

    courses.forEach(c => {
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-800 transition-colors";
        row.innerHTML = `
            <td class="px-6 py-4 font-mono text-blue-400 text-xs">${c.code}</td>
            <td class="px-6 py-4 text-slate-400">${c.credits.toFixed(1)}</td>
            <td class="px-6 py-4"><span class="px-2 py-1 rounded text-[10px] font-bold bg-slate-700">${c.grade}</span></td>
            <td class="px-6 py-4 text-right font-bold text-slate-200">${c.points.toFixed(2)}</td>
        `;
        elements.historyBody.appendChild(row);
    });
}

// --- FORM SUBMIT & CACHE ---
elements.form.addEventListener('submit', (e) => {
    e.preventDefault();

    const cgpa = parseFloat(document.getElementById('currentCGPA').value);
    const credits = parseFloat(document.getElementById('completedCredits').value);

    const newCourses = Array.from(document.querySelectorAll('#courseInputs > div')).map(row => ({
        grade: row.querySelector('.course-grade').value,
        credits: row.querySelector('.course-credits').value
    }));

    const final = calculateFinalCGPA(cgpa, credits, newCourses);

    elements.resultCard.classList.remove('hidden');
    elements.finalGPA.innerText = final.toFixed(2);

    // Cache for Next Semester 
    localStorage.setItem('bracu_pro_cache', JSON.stringify({ cgpa, credits }));
});