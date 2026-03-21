export const calculateFinalCGPA = (currentCGPA, currentCredits, newCourses) => {
    let totalQualityPoints = currentCGPA * currentCredits;
    let totalCredits = currentCredits;

    newCourses.forEach(course => {
        const grade = parseFloat(course.grade);
        const credits = parseFloat(course.credits);
        if (!isNaN(grade) && !isNaN(credits)) {
            totalQualityPoints += (grade * credits);
            totalCredits += credits;
        }
    });

    return totalCredits === 0 ? 0 : totalQualityPoints / totalCredits;
};