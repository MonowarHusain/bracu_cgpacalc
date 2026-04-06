/**
 * CGPA Calc Pro - Master Engine
 */

const KEY = 'cgpapro_user_data';
let cgpaChart = null;

// --- UTILS ---
const getPoints = (g) => {
    const table = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'D+': 1.7, 'D': 1.3, 'D-': 1.0, 'F': 0.0 };
    return table[(g || '').split(' ')[0].toUpperCase()] || 0;
};

// --- ROBUST TRANSCRIPT PARSER ---
const parseTranscript = (text) => {
    const history = [], semestersFound = [], transcriptHistory = [];

    // 1. Identify Name & Totals
    const nameMatch = text.match(/Name\s*[:\-]*\s*([A-Za-z\s\.]+?)\s*(?:BRAC|Student ID|PROGRAM)/i);
    const finalCgpaMatch = [...text.matchAll(/CGPA\s*[:\-]*\s*([\d.]+)/gi)].pop();
    const finalCreditsMatch = [...text.matchAll(/Credits\s+(?:Earned|Completed)\s*[:\-]*\s*([\d.]+)/gi)].pop();

    // 2. Auto-Detect Degree [cite: 57-58, 137-140]
    let detectedPlan = "CSE";
    if (/MASTER/i.test(text)) detectedPlan = "MSC";
    else if (/COMPUTER SCIENCE\s*AND\s*ENGINEERING/i.test(text)) detectedPlan = "CSE";
    else if (/COMPUTER SCIENCE/i.test(text)) detectedPlan = "CS";

    // 3. Extract Semesters
    const semRegex = /(?:SEMESTER|Semester)\s*[:\-]*\s*([A-Z]+\s+\d{4})/gi;
    let m; while ((m = semRegex.exec(text)) !== null) semestersFound.push(m[1].trim());

    // 4. Extract Courses (Loosened regex for better matching)
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

        history.push({
            code,
            credits: parseFloat(c[3]),
            grade: c[4].trim(),
            semester: currentSem,
            points: getPoints(c[4].trim())
        });
    }

    // 5. Extract Historic CGPA
    semestersFound.forEach(sem => {
        const start = text.indexOf(sem), nextSem = semestersFound[semestersFound.indexOf(sem) + 1];
        const cgpaMatch = text.substring(start, nextSem ? text.indexOf(nextSem) : text.length).match(/CGPA\s*[:\-]*\s*([\d.]+)/i);
        if (cgpaMatch) transcriptHistory.push({ semester: sem, cgpa: parseFloat(cgpaMatch[1]) });
    });

    return {
        studentName: (nameMatch ? nameMatch[1].trim() : "Student").replace(/PROGRAM/i, ''),
        history, transcriptHistory, semesters: [...new Set(semestersFound)],
        officialCgpa: parseFloat(finalCgpaMatch?.[1] || 0),
        officialCredits: parseFloat(finalCreditsMatch?.[1] || 0),
        plan: detectedPlan
    };
};

// --- AUDIT RENDERER ---
// --- AUDIT RENDERER (THE OVERFLOW ENGINE) ---
function renderDetailedAudit(user) {
    if (!user || !user.history) return;
    const plan = DEGREE_DATA[user.plan];
    if (!plan) return;

    let auditHtml = '';
    let usedCodes = new Set();
    let genEdOverflow = []; // Holds extra Stream courses (e.g., ENG103)

    // PASS 1: Strict Cores, Streams, and Remedial
    Object.entries(plan.categories).forEach(([catName, rules]) => {
        if (catName === "GenEd Electives" || rules.isElective) return;

        let completed = [], remaining = [];
        let currentCredits = 0;

        // 1A. Handle Remedial (0 credits)
        if (rules.isRemedial) {
            user.history.forEach(c => {
                if (!usedCodes.has(c.code) && rules.codes.includes(c.code)) {
                    completed.push(c); usedCodes.add(c.code);
                }
            });
            plan.categories[catName]._tempCompleted = completed;
            plan.categories[catName]._tempRemaining = [];
            return;
        }

        // 1B. Handle Mandatory Targets (e.g., EMB101/DEV101)
        if (rules.mandatory) {
            rules.mandatory.forEach(mandCode => {
                let found = false;
                const options = mandCode.split('/'); // Split 'EMB101/DEV101'
                for (let opt of options) {
                    let c = user.history.find(x => x.code === opt);
                    if (c && !usedCodes.has(c.code)) {
                        if (currentCredits < rules.req) {
                            completed.push(c); usedCodes.add(c.code); currentCredits += c.credits;
                        } else {
                            genEdOverflow.push(c); usedCodes.add(c.code); // Overflow!
                        }
                        found = true;
                        break;
                    }
                }
                if (!found) remaining.push(mandCode);
            });
        }

        // 1C. Fill with Options (Codes array or Matcher)
        user.history.forEach(c => {
            if (!usedCodes.has(c.code)) {
                if ((rules.codes && rules.codes.includes(c.code)) || (rules.matcher && rules.matcher(c.code))) {
                    if (currentCredits < rules.req) {
                        completed.push(c); usedCodes.add(c.code); currentCredits += c.credits;
                    } else if (catName.includes("Stream")) {
                        genEdOverflow.push(c); usedCodes.add(c.code); // Overflow!
                    }
                }
            }
        });

        // Add standard remaining codes if not mandatory-driven
        if (rules.codes && !rules.mandatory) {
            rules.codes.forEach(code => {
                if (!completed.find(c => c.code === code)) remaining.push(code);
            });
        }

        plan.categories[catName]._tempCompleted = completed;
        plan.categories[catName]._tempRemaining = remaining;
    });

    // PASS 2: GenEd Electives (Grabs BIO/CHE/ENV + Overflow)
    let genEdCat = plan.categories["GenEd Electives"];
    if (genEdCat) {
        let completed = [], currentCredits = 0;

        // Grab explicit GenEd courses
        user.history.forEach(c => {
            if (!usedCodes.has(c.code) && genEdCat.matcher && genEdCat.matcher(c.code)) {
                if (currentCredits < genEdCat.req) {
                    completed.push(c); usedCodes.add(c.code); currentCredits += c.credits;
                }
            }
        });

        // Consume overflow from Streams
        genEdOverflow.forEach(c => {
            if (currentCredits < genEdCat.req) {
                completed.push(c); currentCredits += c.credits;
            }
        });

        genEdCat._tempCompleted = completed;
        genEdCat._tempRemaining = [];
    }

    // PASS 3: Program Electives (Crossover Logic)
    Object.entries(plan.categories).forEach(([catName, rules]) => {
        if (!rules.isElective) return;

        let completed = [];
        user.history.forEach(course => {
            if (!usedCodes.has(course.code) && (!rules.matcher || rules.matcher(course.code))) {
                completed.push(course); usedCodes.add(course.code);
            }
        });
        plan.categories[catName]._tempCompleted = completed;
        plan.categories[catName]._tempRemaining = [];
    });

    // PASS 4: Generate HTML Cards
    Object.entries(plan.categories).forEach(([catName, rules]) => {
        const completed = rules._tempCompleted;
        const remaining = rules._tempRemaining;
        const totalEarned = completed.reduce((sum, c) => sum + c.credits, 0);

        // Handle Remedial display logic (always shows 100% full, but 0/0 credits)
        const displayReq = rules.isRemedial ? 0 : rules.req;
        const progressPercent = displayReq === 0 ? 100 : Math.min((totalEarned / displayReq) * 100, 100);

        auditHtml += `
            <div class="bg-slate-900/50 border border-slate-800 rounded-[2rem] overflow-hidden">
                <div class="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                    <div>
                        <h3 class="text-white font-black uppercase tracking-widest text-sm">${catName}</h3>
                        <p class="text-slate-500 text-xs mt-1">${totalEarned} / ${displayReq} Credits Met</p>
                    </div>
                    <span class="text-2xl font-black ${progressPercent >= 100 ? 'text-emerald-500' : 'text-blue-500'}">${Math.round(progressPercent)}%</span>
                </div>
                <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 class="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3"><i class="fas fa-check-circle mr-2"></i> Completed</h4>
                        <div class="flex flex-wrap gap-2">
                            ${completed.length > 0 ? completed.map(c => `<span class="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-1 rounded-md text-[10px] font-bold">${c.code} (${c.grade})</span>`).join('') : '<p class="text-slate-600 italic text-xs">None yet.</p>'}
                        </div>
                    </div>
                    <div>
                        <h4 class="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3"><i class="fas fa-exclamation-triangle mr-2"></i> Remaining</h4>
                        <div class="flex flex-wrap gap-2">
                            ${remaining.length > 0 ? remaining.map(code => `<span class="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-1 rounded-md text-[10px] font-bold">${code}</span>`).join('') : (rules.isElective || rules.isRemedial ? `<p class="text-slate-500 text-xs">${rules.isRemedial ? 'No requirements.' : 'Take electives to fill gap.'}</p>` : '<p class="text-emerald-500 text-xs font-bold">Category Complete!</p>')}
                        </div>
                    </div>
                </div>
            </div>`;
    });
    document.getElementById('auditList').innerHTML = auditHtml;
}

// --- GREEN HISTORY RENDERER ---
function renderHistory(history, semesters) {
    const body = document.getElementById('historyTable');
    if (!semesters || semesters.length === 0) return;

    const recentSems = semesters.slice(-2); // Last 2 sems are green

    let html = "";
    [...semesters].reverse().forEach(sem => {
        const isGreen = recentSems.includes(sem);
        const semCourses = history.filter(h => h.semester === sem);

        html += `
            <div class="p-6 rounded-[2rem] border ${isGreen ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/50'}">
                <h4 class="text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${isGreen ? 'text-emerald-500' : 'text-slate-500'}">
                    ${sem} ${isGreen ? '• ACTIVE' : ''}
                </h4>
                <div class="space-y-2">
                    ${semCourses.map(c => `
                        <div class="flex justify-between items-center border-b border-slate-800/50 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                            <div>
                                <p class="font-bold text-xs ${isGreen ? 'text-emerald-400' : 'text-white'}">${c.code}</p>
                                <p class="text-[8px] text-slate-500 uppercase">${c.credits} Credits</p>
                            </div>
                            <span class="font-black text-xs ${isGreen ? 'text-emerald-500' : 'text-slate-400'}">${c.grade}</span>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    });
    body.innerHTML = html;
}

// --- UI SYNC ---
function refreshUI(user) {
    if (!user) return;
    const plan = DEGREE_DATA[user.plan] || DEGREE_DATA.CSE;

    document.getElementById('studentNameDisplay').innerText = user.studentName;
    document.getElementById('nameInitial').innerText = user.studentName[0];
    document.getElementById('navUserPlan').innerText = `${user.plan} Track (${plan.total} Credits) Auto-Detected`;
    document.getElementById('systemStatus').innerHTML = `<span class="text-emerald-500 font-bold"><i class="fas fa-check-circle"></i> Sync Successful!</span> Loaded ${user.history.length} courses for ${user.plan} program.`;

    const cgpa = user.officialCgpa || 0;
    const completed = user.officialCredits || 0;
    document.getElementById('finalGPA').innerText = cgpa.toFixed(2);
    document.getElementById('progressText').innerText = `${completed} / ${plan.total} Credits`;

    document.getElementById('degreeProgressBar').style.width = `${Math.min((completed / plan.total) * 100, 100)}%`;

    const badge = document.getElementById('waiverBadgeDetail');
    if (cgpa >= 3.9) { badge.className = "px-4 py-2 rounded-full text-xs font-black bg-emerald-500 text-white"; badge.innerText = "100% WAIVER"; }
    else if (cgpa >= 3.85) { badge.className = "px-4 py-2 rounded-full text-xs font-black bg-blue-500 text-white"; badge.innerText = "75% WAIVER"; }
    else { badge.className = "px-4 py-2 rounded-full text-xs font-black bg-slate-800 text-slate-500"; badge.innerText = "NO WAIVER"; }

    renderDetailedAudit(user);
    renderHistory(user.history, user.semesters);

    const canvas = document.getElementById('cgpaChart');
    if (cgpaChart) cgpaChart.destroy();
    cgpaChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: (user.transcriptHistory || []).map(th => th.semester),
            datasets: [{ label: 'CGPA', data: (user.transcriptHistory || []).map(th => th.cgpa), borderColor: '#3b82f6', tension: 0.4, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.1)' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 2.0, max: 4.0 } } }
    });
}

// --- INIT ---
window.addEventListener('DOMContentLoaded', () => {
    let user = JSON.parse(localStorage.getItem(KEY));
    if (user && user.history && user.history.length > 0) refreshUI(user);

    document.getElementById('resetData').onclick = () => {
        if (confirm("Clear all loaded data?")) {
            localStorage.removeItem(KEY);
            location.reload();
        }
    };

    document.getElementById('pdfUpload').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        document.getElementById('systemStatus').innerHTML = "Extracting data from PDF... Please wait.";

        const reader = new FileReader();
        reader.onload = async function () {
            try {
                const pdf = await pdfjsLib.getDocument(new Uint8Array(this.result)).promise;
                let text = "";
                for (let i = 1; i <= pdf.numPages; i++) text += (await (await pdf.getPage(i)).getTextContent()).items.map(s => s.str).join(" ") + "\n";

                const parsedData = parseTranscript(text);

                if (parsedData.history.length === 0) {
                    alert("PDF read successfully, but no course data matched. Ensure this is an unofficial BRACU transcript.");
                    document.getElementById('systemStatus').innerHTML = "Extraction failed. Invalid format.";
                    return;
                }

                localStorage.setItem(KEY, JSON.stringify(parsedData));
                location.reload();
            } catch (err) {
                console.error("PDF Parse Error", err);
                alert("Failed to parse PDF.");
            }
        };
        reader.readAsArrayBuffer(file);
    };
});