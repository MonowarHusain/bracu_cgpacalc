/**
 * BRACU Transcript Parser
 * Specifically designed to handle Name extraction and the Repeat Policy (RP/NT).
 */
export const parseBracuTranscript = (text) => {
    const courseMap = new Map();
    const semestersFound = [];

    // Robust Name Extraction - targets the space between "Name :" and "BRAC UNIVERSITY"
    const nameMatch = text.match(/Name\s*[:\-]*\s*([A-Za-z\s\.]+?)\s*(?:BRAC\s+UNIVERSITY|BRAC|University|Student ID|PROGRAM)/i);
    const studentName = nameMatch && nameMatch[1] ? nameMatch[1].trim() : "Student";

    // Semester Timeline Extraction
    const semesterRegex = /SEMESTER:\s+([A-Z]+\s+\d{4})/gi;
    let semMatch;
    while ((semMatch = semesterRegex.exec(text)) !== null) {
        semestersFound.push(semMatch[1].trim());
    }

    // Individual Course Extraction
    const courseRegex = /([A-Z]{2,3}\s?\d{3})\s+[\w\s&:-]+\s+(\d\.\d{2})\s+([A-F][+-]?(\s\(\w+\))?|I)/g;
    let currentMatch;
    let lastSem = semestersFound.length > 0 ? semestersFound[0] : "Unknown";

    while ((currentMatch = courseRegex.exec(text)) !== null) {
        const [_, code, credits, gradeInfo] = currentMatch;
        const index = currentMatch.index;

        // Map course to correct semester based on document position
        let detectedSem = semestersFound.find((s, i) => {
            const nextSem = semestersFound[i + 1];
            const start = text.indexOf(s);
            const end = nextSem ? text.indexOf(nextSem) : text.length;
            return index >= start && index < end;
        }) || lastSem;

        const cleanCode = code.replace(/\s/g, '');
        const cleanGrade = gradeInfo.trim();

        // Skip Not Taken (NT) or Incomplete (I) as per policy 
        if (cleanGrade.includes('I') || cleanGrade.includes('(NT)')) continue;

        // Latest entries (RP) overwrite older ones for the same course code
        courseMap.set(cleanCode, {
            code: cleanCode,
            credits: parseFloat(credits),
            grade: cleanGrade,
            semester: detectedSem
        });
        lastSem = detectedSem;
    }

    // Cumulative Stat Extraction (Targets 3.55 CGPA and 75 Credits) 
    const cgpaMatches = [...text.matchAll(/CGPA\s*([\d.]+)/gi)];
    const earnedMatches = [...text.matchAll(/Credits\s+Earned\s*([\d.]+)/gi)];

    return {
        studentName,
        enrollmentSemester: semestersFound.length > 0 ? semestersFound[0] : "Unknown",
        currentCGPA: parseFloat(cgpaMatches.length ? cgpaMatches.pop()[1] : 0),
        completedCredits: parseFloat(earnedMatches.length ? earnedMatches.pop()[1] : 0),
        courses: Array.from(courseMap.values()),
        semesters: [...new Set(semestersFound)]
    };
};