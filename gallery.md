# Gallery Submission Setup: FinAgent

## 1. Quick Meta (Piper Applet Configuration)
- **Title:** FinAgent
- **Slug:** finagent
- **Short Description:** Upload receipts and a managed agent reads, categorizes, stores your spending in a cloud database, and emails an automated report.
- **Tags:** gemini-3.1-pro, data-extraction, financial, agentic

## 2. Submission Justification
This app demonstrates a robust implementation of a multi-agent orchestrated pipeline. It leverages server-side GenAI, file handling, and structured data extraction to deliver actionable financial insights automatically.

## 3. Technical Profile & Capabilities
- **Core Models:** gemini-3.1-pro
- **Media Uploads:** Yes (PCounsel media disclaimer included in UI)
- **Search Grounding:** No
- **Sensory Access Needed:**
  - Camera: No
  - Microphone: No
  - Location: No

## 4. Privacy & Data Handling
- **Server-Side Storage:** Files are passed to the Gemini API for analysis. Transcriptions/extractions are not persistently stored locally except for the session scope.
- **Access & Sharing:** N/A

## 5. Implementation Details
- **Code Generation Source:** Purely AI-assisted using React, Tailwind CSS, Recharts, and Google GenAI SDK.
- **Assets Sourcing:** N/A

## 6. QA & Safety Checklist
- **Abuse Risks:** Low (Financial advice disclaimer recommended if used beyond receipt extraction)
- **UI Responsiveness Verified:** [x] Computer | [ ] Android | [ ] iOS
- **Themes Verified:** [x] Light Mode | [ ] Dark Mode
- **Browsers Verified:** [x] Chrome | [ ] Safari | [ ] Edge | [ ] Firefox
