/**
 * Advanced BRACU Parser
 * Specifically tuned for the "Credits Earned" and "CGPA" table layouts.
 */
export const parseBracuTranscript = (text) => {
    const courseMap = new Map();

    // 1. Extract Individual Courses (Handles RP/RT/NT/I)
    // Matches patterns like "CSE110 ... 3.00 ... A ... 4.00"
    const courseRegex = /([A-Z]{2,3}\s?\d{3})\s+[\w\s&:-]+\s+(\d\.\d{2})\s+([A-F][+-]?(\s\(\w+\))?|I)/g;
    let match;
    while ((match = courseRegex.exec(text)) !== null) {
        const [_, code, credits, gradeInfo] = match;
        const cleanCode = code.replace(/\s/g, '');
        const cleanGrade = gradeInfo.trim();

        // Skip NT (Not Taken) or I (Incomplete)
        if (cleanGrade.includes('I') || cleanGrade.includes('(NT)')) continue;

        // RP (Repeat) logic: the latest instance in the PDF replaces the old one
        courseMap.set(cleanCode, {
            code: cleanCode,
            credits: parseFloat(credits),
            grade: cleanGrade
        });
    }

    // 2. Extract Cumulative Totals 
    // Patterns adjusted to handle potential colons or varying spaces in joined text
    const cgpaMatches = [...text.matchAll(/CGPA[\s:]+([\d.]+)/gi)];
    const earnedMatches = [...text.matchAll(/Credits\s+Earned[\s:]+([\d.]+)/gi)];

    // We take the LAST match found in the document (the most current total) 
    const finalCGPA = cgpaMatches.length > 0 ? cgpaMatches[cgpaMatches.length - 1][1] : "0.00";
    const finalCredits = earnedMatches.length > 0 ? earnedMatches[earnedMatches.length - 1][1] : "0";

    return {
        currentCGPA: parseFloat(finalCGPA),
        completedCredits: parseFloat(finalCredits),
        courses: Array.from(courseMap.values())
    };
};