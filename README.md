# CGPACalc.pro | BRACU Student Toolkit (v2.0)

**CGPACalc.pro** is an advanced, privacy-first web suite designed specifically for BRAC University students. It transforms the unofficial USIS transcript PDF into an interactive dashboard for degree auditing and CGPA planning.

![Version](https://img.shields.io/badge/version-2.0--toolkit-blue?style=for-the-badge)
![Privacy](https://img.shields.io/badge/Data_Privacy-100%25_Local-emerald?style=for-the-badge)

---

## 🚀 Key Features

### 1. Multi-Page Architecture
* **Gateway Launchpad:** A centralized landing page to choose between high-level analytics or granular semester planning.
* **User Manual:** Integrated guide explaining data security, official BRACU rules, and tool usage.
* **Seamless Routing:** Fast, Single-Page Application (SPA) experience for instant switching between tools without page reloads.

### 2. Degree Analytics & Auditor
* **Auto-Program Detection:** Automatically identifies if you are in the **CSE (136 Cr)**, **CS (124 Cr)**, or **M.Sc (36 Cr)** track.
* **University Core Breakdown:** Maps your GenEd courses into the 5 official BRACU streams (Writing, Math/Science, Humanities, Social Sciences, Communities) with specific sub-headers.
* **Official Trend Graph:** A dynamic Chart.js visualization using official USIS data. 
    * 🟢 **Green Segments:** Performance improvement or stable trend.
    * 🔴 **Red Segments:** Performance decrease from the previous semester.

### 3. CGPA Predictor (Fresher Friendly)
* **Fresher Bypass:** Start planning from Semester 1 without needing an existing transcript.
* **Dynamic Retake Logic:** Select old courses from a dynamic dropdown; the engine automatically handles credit replacement math (perfect for replacing 'F' or 'D' grades).
* **History Editor:** Manually remove or adjust previous courses to see how your "Base CGPA" changes in real-time.
* **Active Semester Highlight:** Visual indicators (Emerald glow) for the most recent semester's performance.

---

## 🛡️ Privacy & Security
**Your data is yours.**
* **Zero Server Uploads:** PDF parsing is done entirely in the browser using `PDF.js`.
* **Local Storage:** Data is saved in your browser's local cache. 
* **Developer Transparency:** Data stays strictly on your device. Nothing is sent to the developer.

---

## 📖 How to Use
1.  **Launch:** Open the app via the gateway page.
2.  **Import:** Upload your **Unofficial Transcript PDF** from USIS.
    * *Alternative:* Use the **"Paste Raw Text"** side-door if your browser blocks direct PDF uploads.
3.  **Audit:** Check the "Detailed Audit" tab to see exactly which GenEd streams you are missing.
4.  **Plan:** Go to the Predictor to simulate your next semester's grades and see your projected CGPA.

---

## 🛠️ Tech Stack
* **Frontend:** Tailwind CSS (Modern Styling), FontAwesome (Icons)
* **Charts:** Chart.js (Official Performance Visuals)
* **Parsing:** PDF.js (Local PDF Extraction)
* **Redundancy:** Integrated Domain Fallback (monowar.me / mono.pro.bd / monowar.pro.bd)

---

## 👤 Developer
**Monowar Husain Omi** 🔗 [monowar.me](https://monowar.me) | [mono.bro.bd](https://mono.bro.bd) | [monowar.pro.bd](https://monowar.pro.bd)

---

### 📝 Release Notes (v2.0)
* Implemented Multi-Page routing system (Gateway -> Apps).
* Added "History Editor" to the Predictor for granular course management.
* Implemented dynamic retake course selection via dropdown.
* Added User Manual and Feedback Modal (Discord integration) to the Launch Page.
* Restored Official Graph with official USIS data and Red/Green trend detection.
* Grouped Auditor categories under "University Core (39 Credits)".
