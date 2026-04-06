/**
 * CGPA Calc Pro - Transcript PDF Parser Engine (Flattened Text Version)
 */

const getPoints = (g) => {
    const table = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'D+': 1.7, 'D': 1.3, 'D-': 1.0, 'F': 0.0 };
    return table[(g || '').split(' ')[0].toUpperCase()] || 0;
};

const parseTranscript = (rawText) => {
    // THE FIX: Flatten all random PDF line breaks, tabs, and spaces into a single readable line.
    const text = rawText.replace(/\s+/g, ' ');

    const history = [], semestersFound = [], transcriptHistory = [];

    // 1. Extract Header Information
    const nameMatch = text.match(/Name\s*[:\-]*\s*([A-Za-z\s\.]+?)\s*(?:BRAC|Student ID|PROGRAM)/i);
    const finalCgpaMatch = [...text.matchAll(/CGPA\s*[:\-]*\s*([\d.]+)/gi)].pop();
    const finalCreditsMatch = [...text.matchAll(/Credits\s+(?:Earned|Completed)\s*[:\-]*\s*([\d.]+)/gi)].pop();

    // 2. Auto-Detect Degree
    let detectedPlan = "CSE";
    if (/MASTER/i.test(text)) detectedPlan = "MSC";
    else if (/COMPUTER SCIENCE\s*AND\s*ENGINEERING/i.test(text)) detectedPlan = "CSE";
    else if (/COMPUTER SCIENCE/i.test(text)) detectedPlan = "CS";

    // 3. Extract Semesters (e.g., "Semester: Fall 2023")
    const semRegex = /(?:SEMESTER|Semester)\s*[:\-]*\s*([A-Z]+\s+\d{4})/gi;
    let m; while ((m = semRegex.exec(text)) !== null) semestersFound.push(m[1].trim());

    // Remove duplicates from semesters
    const uniqueSemesters = [...new Set(semestersFound)];

    // 4. Extract Courses
    // Extremely forgiving regex: looks for "CSE 110", any text, a number "3.0", and a grade "B+"
    const courseRegex = /([A-Z]{3,4}\s*\d{3})\s+(.*?)\s+(\d(?:\.\d{1,2})?)\s+([A-F][+-]?|I|W|P|S|U)\b/g;
    let c; while ((c = courseRegex.exec(text)) !== null) {
        if (['I', 'W', 'P', 'S', 'U'].includes(c[4].trim())) continue; // Skip incomplete grades

        let currentSem = uniqueSemesters[0] || "Unknown";
        // Map the course to the correct semester block
        for (let i = 0; i < uniqueSemesters.length; i++) {
            if (c.index > text.indexOf(uniqueSemesters[i])) {
                currentSem = uniqueSemesters[i];
            }
        }

        const code = c[1].replace(/\s/g, ''); // "CSE 110" -> "CSE110"

        // Remove old attempts if retaken
        const existingIdx = history.findIndex(h => h.code === code);
        if (existingIdx !== -1) history.splice(existingIdx, 1);

        history.push({
            code: code,
            credits: parseFloat(c[3]),
            grade: c[4].trim(),
            semester: currentSem,
            points: getPoints(c[4].trim())
        });
    }

    // 5. Extract Historic Semester GPAs and CGPAs
    uniqueSemesters.forEach(sem => {
        const start = text.indexOf(sem);
        const nextSem = uniqueSemesters[uniqueSemesters.indexOf(sem) + 1];
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

    // Console log for debugging if it still fails
    if (history.length === 0) {
        console.error("PARSER FAILED. Here is the raw text PDF.js saw:\n\n", text);
    }

    return {
        studentName: (nameMatch ? nameMatch[1].trim() : "Student").replace(/PROGRAM/i, ''),
        history,
        transcriptHistory,
        semesters: uniqueSemesters,
        officialCgpa: parseFloat(finalCgpaMatch?.[1] || 0),
        officialCredits: parseFloat(finalCreditsMatch?.[1] || 0),
        plan: detectedPlan
    };
};