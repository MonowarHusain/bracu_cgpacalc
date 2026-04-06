/**
 * BRACU Degree Structures - Precision Stream Breakdown
 */

const CSE_ELECTIVES_MASTER = [
    "CSE250", "CSE251", "CSE310", "CSE320", "CSE341", "CSE342", "CSE350", "CSE360", "CSE390", "CSE391", "CSE392",
    "CSE402", "CSE410", "CSE419", "CSE424", "CSE425", "CSE426", "CSE427", "CSE428", "CSE429", "CSE430", "CSE431",
    "CSE432", "CSE433", "CSE434", "CSE435", "CSE437", "CSE438", "CSE439", "CSE440", "CSE441", "CSE442", "CSE443",
    "CSE444", "CSE445", "CSE446", "CSE447", "CSE449", "CSE450", "CSE451", "CSE452", "CSE453", "CSE454", "CSE455",
    "CSE456", "CSE457", "CSE458", "CSE459", "CSE460", "CSE461", "CSE462", "CSE463", "CSE471", "CSE472", "CSE473",
    "CSE474", "CSE481", "CSE482", "CSE483", "CSE484", "CSE485", "CSE486", "CSE487", "CSE488", "CSE489", "CSE490A",
    "CSE492", "CSE493", "CSE494", "CSE495", "CSE496", "CSE497", "CSE498", "CSE499", "CSE500", "CSE502", "CSE503",
    "CSE504", "CSE505", "CSE506", "CSE507", "CSE586"
];

const GENED_S3_ELECTIVES = ["HUM101", "HUM102", "HST102", "HST103", "HST104", "HUM207", "ENG110", "ENG113", "ENG114", "ENG115", "ENG333"];
const GENED_S4_ELECTIVES = ["PSY101", "SOC101", "ANT101", "POL101", "BUS201", "ECO101", "ECO102", "ECO105", "BUS102", "POL102", "POL103", "POL201", "POL202", "PSY102", "DEV104", "DEV201", "SOC201", "ANT202", "ANT342", "ANT351", "BUS333", "BUS334", "BUS335"];

const UNDERGRAD_CATEGORIES = {
    "Remedial Courses": { req: 0, isRemedial: true, codes: ["ENG091", "MAT092"] },
    "Stream 1: Writing": { req: 6, codes: ["ENG101", "ENG102", "ENG103"] },
    "Stream 2: Math/Science": { req: 9, mandatory: ["MAT110", "PHY111", "STA201"] },
    "Stream 3: Humanities": { req: 9, mandatory: ["HUM103", "BNG103"], matcher: (c) => GENED_S3_ELECTIVES.includes(c) },
    "Stream 4: Social Sciences": { req: 6, mandatory: ["EMB101/DEV101"], matcher: (c) => GENED_S4_ELECTIVES.includes(c) },
    "Stream 5: Communities": { req: 3, matcher: (c) => /^CST\d{3}$/.test(c) },
    "GenEd Electives": { req: 6, matcher: (c) => ["BIO101", "CHE101", "ENV103"].includes(c) },
    "School Core": { req: 12, codes: ["MAT120", "MAT215", "MAT216", "PHY112"] }
};

const DEGREE_DATA = {
    CS: {
        total: 124,
        categories: {
            ...UNDERGRAD_CATEGORIES,
            "Program Core": { req: 48, codes: ["CSE110", "CSE111", "CSE220", "CSE221", "CSE230", "CSE260", "CSE321", "CSE330", "CSE331", "CSE340", "CSE370", "CSE420", "CSE421", "CSE422", "CSE423", "CSE470"] },
            "Program Elective": { req: 21, isElective: true, matcher: (c) => CSE_ELECTIVES_MASTER.includes(c) || /^(CHN|SPN|FRN|JPN)/.test(c) },
            "Thesis / Project": { req: 4, codes: ["CSE400"] }
        }
    },
    CSE: {
        total: 136,
        categories: {
            ...UNDERGRAD_CATEGORIES,
            "Program Core": { req: 75, codes: ["CSE110", "CSE111", "CSE220", "CSE221", "CSE230", "CSE250", "CSE251", "CSE260", "CSE320", "CSE321", "CSE330", "CSE331", "CSE340", "CSE341", "CSE350", "CSE360", "CSE370", "CSE420", "CSE421", "CSE422", "CSE423", "CSE460", "CSE461", "CSE470", "CSE471"] },
            "Program Elective": { req: 6, isElective: true, matcher: (c) => CSE_ELECTIVES_MASTER.includes(c) || /^(CHN|SPN|FRN|JPN)/.test(c) },
            "Thesis / Project": { req: 4, codes: ["CSE400"] }
        }
    },
    MSC: {
        total: 36,
        categories: {
            "Departmental Courses": { req: 30, matcher: (code) => /^CSE7/.test(code) },
            "MBA Electives": { req: 6, matcher: (code) => /^(OPN|HRM|FIN|MKT|BNK|ENT|ITS)/.test(code) }
        }
    }
};