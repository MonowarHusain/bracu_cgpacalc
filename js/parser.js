/**
 * Professional BRACU Transcript Parser
 */
export const parseBracuTranscript = (text) => {
    const courseMap = new Map();
    const semestersFound = [];

    // Extract Student Name [cite: 4]
    const nameMatch = text.match(/Name\s*[:\-]*\s*([A-Za-z\s\.]+?)\s*(?:BRAC\s+UNIVERSITY|BRAC|University|Student ID|PROGRAM)/i);
    const studentName = nameMatch && nameMatch[1] ? nameMatch[1].trim() : "Student";

    // Extract Semester Headers [cite: 13]
    const semesterRegex = /SEMESTER:\s+([A-Z]+\s+\d{4})/gi;
    let semMatch;
    while ((semMatch = semesterRegex.exec(text)) !== null) {
        semestersFound.push(semMatch[1].trim());
    }

    // Extract All Courses and their respective details [cite: 13]
    const courseRegex = /([A-Z]{2,3}\s?\d{3})\s+[\w\s&:-]+\s+(\d\.\d{2})\s+([A-F][+-]?(\s\(\w+\))?|I)/g;
    let currentMatch;
    let lastSem = semestersFound.length > 0 ? semestersFound[0] : "Unknown";

    while ((currentMatch = courseRegex.exec(text)) !== null) {
        const [_, code, credits, gradeInfo] = currentMatch;
        const index = currentMatch.index;

        let detectedSem = semestersFound.find((s, i) => {
            const nextSem = semestersFound[i + 1];
            const start = text.indexOf(s);
            const end = nextSem ? text.indexOf(nextSem) : text.length;
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
            points: getNumericPoints(cleanGrade) // Maps grade to numeric points [cite: 13]
        });
        lastSem = detectedSem;
    }

    // Extract Cumulative Totals [cite: 13]
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

function getNumericPoints(gradeStr) {
    const table = {
        'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7,
        'C+': 2.3, 'C': 2.0, 'D+': 1.7, 'D': 1.3, 'D-': 1.0, 'F': 0.0
    };
    return table[gradeStr.split(' ')[0]] || 0.0;
}