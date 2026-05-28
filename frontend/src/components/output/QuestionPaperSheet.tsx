"use client";

import type { GeneratedPaper } from "@/types";

interface QuestionPaperSheetProps {
  paper: GeneratedPaper;
  title?: string;
  grade?: string;
}

const formatSectionLabel = (label: string, index: number) => {
  const cleanLabel = label?.trim() || String.fromCharCode(65 + index);
  if (/^(section|part)/i.test(cleanLabel)) {
    return cleanLabel;
  }
  return `Section ${cleanLabel}`;
};

const isGradeAfterFifth = (gradeStr?: string): boolean => {
  if (!gradeStr) return false;
  
  const normalized = gradeStr.trim().toUpperCase();
  const lower = normalized.toLowerCase();

  // Check for college or competitive exam markers
  if (
    lower.includes("year") || 
    lower.includes("semester") || 
    lower.includes("college") || 
    lower.includes("n/a")
  ) {
    return true;
  }

  // Try to find regular digits first
  const match = gradeStr.match(/\d+/);
  if (match) {
    return parseInt(match[0], 10) > 5;
  }
  
  // If no digits, normalized string and check for Roman numerals or words
  
  // Check Roman numerals from VI to XII (after 5th)
  const romanMatch = normalized.match(/\b(VI|VII|VIII|IX|X|XI|XII)\b/);
  if (romanMatch) {
    return true;
  }
  
  // Check Roman numerals I to V (below/equal 5th)
  const romanLowMatch = normalized.match(/\b(I|II|III|IV|V)\b/);
  if (romanLowMatch) {
    return false;
  }

  // Check common school terms for lower grades
  if (
    lower.includes("nursery") ||
    lower.includes("kindergarten") ||
    lower.includes("lkg") ||
    lower.includes("ukg") ||
    lower.includes("preschool")
  ) {
    return false;
  }
  
  return false;
};

const formatCollegeGrade = (gradeStr?: string): string => {
  if (!gradeStr) return "";
  const match = gradeStr.match(/Year\s*(\d+),\s*Semester\s*(\d+)/i);
  if (match) {
    const yearNum = parseInt(match[1], 10);
    const semNum = parseInt(match[2], 10);

    const yearSuffix = (num: number): string => {
      if (num === 1) return "1st";
      if (num === 2) return "2nd";
      if (num === 3) return "3rd";
      if (num === 4) return "4th";
      return `${num}th`;
    };

    const romanNumeral = (num: number): string => {
      const mapping = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
      return mapping[num] || String(num);
    };

    return `${yearSuffix(yearNum)} Year, ${romanNumeral(semNum)} Semester`;
  }
  return gradeStr;
};

const cleanCollegeInstruction = (instruction?: string): string => {
  if (!instruction) return "";
  // Strip patterns like " (10 x 2 = 20 Marks)" or " (5 x 13 = 65 Marks)" or " (10 x 2 = 20 marks)" or " (1 x 15 = 15 Marks)"
  return instruction.replace(/\s*\(\d+\s*x\s*\d+\s*=\s*\d+\s*marks\)/i, "").trim();
};

interface ChoiceQuestion {
  choiceA: string;
  choiceB: string;
}

const parseChoiceQuestion = (text: string): ChoiceQuestion | null => {
  const parts = text.split(/\s+\b(?:or|OR)\b\s+/);
  if (parts.length === 2) {
    let choiceA = parts[0].trim();
    let choiceB = parts[1].trim();

    const cleanPrefix = (str: string, letter: string) => {
      const regex = new RegExp(`^(?:\\d*${letter}\\s*[:\\)\\.\\-]|${letter}\\s*[:\\)\\.\\-])\\s*`, 'i');
      return str.replace(regex, '').trim();
    };

    choiceA = cleanPrefix(choiceA, 'A');
    choiceB = cleanPrefix(choiceB, 'B');

    return { choiceA, choiceB };
  }
  return null;
};

/**
 * High-fidelity A4-style question paper rendering.
 * Matches the Figma output screenshot with school name, subject, class,
 * time/marks row, instructions, student info fields, and numbered sections/questions.
 */
export function QuestionPaperSheet({ paper, title, grade }: QuestionPaperSheetProps) {
  const isCollege = grade && (
    grade.toLowerCase().includes("semester") ||
    grade.toLowerCase().includes("year") ||
    grade.toLowerCase().includes("college")
  );

  let displayTitle = title || paper.title;
  let department = "";
  if (isCollege && displayTitle && displayTitle.includes(" - ")) {
    const parts = displayTitle.split(" - ");
    displayTitle = parts[0];
    department = parts.slice(1).join(" - ");
  }

  return (
    <div className="paper-sheet animate-fadeIn" id="question-paper">
      {/* School Name */}
      <h2 className="paper-school-name">{displayTitle}</h2>
      {isCollege && department && (
        <p className="paper-department-name">{department}</p>
      )}

      {/* Subject & Class */}
      <p className="paper-sub-header">
        <strong>Subject: {paper.subject}</strong>
      </p>
      {grade && (
        <p className="paper-sub-header">
          <strong>{isCollege ? `Year/Semester: ${formatCollegeGrade(grade)}` : `Grade: ${grade}`}</strong>
        </p>
      )}

      {/* Time Allowed & Maximum Marks */}
      <div className="paper-meta-row">
        <span>Time Allowed: {paper.duration}</span>
        <span>Maximum Marks: {paper.totalMarks}</span>
      </div>

      {/* General Instructions */}
      {isCollege ? (
        <div className="paper-instructions">
          <p>Part A carries 20 marks.</p>
          {paper.sections.some(s => s.sectionLabel.toLowerCase().includes("part c")) ? (
            <>
              <p>Part B carries 65 marks.</p>
              <p>Part C carries 15 marks.</p>
            </>
          ) : (
            <p>Part B carries 80 marks.</p>
          )}
        </div>
      ) : paper.generalInstructions && paper.generalInstructions.length > 0 ? (
        <div className="paper-instructions">
          {paper.generalInstructions.map((inst, idx) => (
            <p key={idx}>{inst}</p>
          ))}
        </div>
      ) : (
        <p className="paper-instructions">
          All questions are compulsory unless stated otherwise.
        </p>
      )}

      {/* Student Info */}
      <div className={`paper-student-info ${isCollege ? "college" : ""}`}>
        <div className="paper-student-field">
          Name:
          <div className="paper-student-line" />
        </div>
        <div className="paper-student-field">
          {isCollege ? "Register Number:" : "Roll Number:"}
          <div className="paper-student-line" />
        </div>
        <div className="paper-student-field">
          {isCollege ? "Section:" : `Class: ${grade || ""} Section:`}
          <div className="paper-student-line" />
        </div>
      </div>

      {/* Sections */}
      {paper.sections.map((section, sIdx) => (
        <div key={sIdx}>
          <h3 className="paper-section-title">
            {formatSectionLabel(section.sectionLabel, sIdx)}
          </h3>
          {(() => {
            const isAfter5th = isGradeAfterFifth(grade);
            if (isAfter5th && section.questions.length > 0) {
              const n = section.questions.length;
              const m = section.questions[0].marks;
              const y = section.questions.reduce((sum, q) => sum + q.marks, 0);
              return (
                <p className="paper-section-type">
                  {section.sectionTitle} [{m} x {n} questions = {y} marks]
                </p>
              );
            }
            return <p className="paper-section-type">{section.sectionTitle}</p>;
          })()}
          <p className="paper-section-instruction">
            {isCollege ? cleanCollegeInstruction(section.instruction) : section.instruction}
          </p>

          <ol className="paper-question-list">
            {section.questions.map((q, qIdx) => {
              const isAfter5th = isGradeAfterFifth(grade);
              const choice = isCollege ? parseChoiceQuestion(q.questionText) : null;

              if (choice) {
                return (
                  <li key={qIdx} value={q.questionNumber} className="paper-question-item choice-question">
                    <span className="paper-question-difficulty">
                      [{q.difficulty}]
                    </span>
                    <div className="choice-options-container">
                      <div className="choice-option">
                        <span className="choice-letter">A.</span> {choice.choiceA}
                      </div>
                      <div className="choice-or">(or)</div>
                      <div className="choice-option">
                        <span className="choice-letter">B.</span> {choice.choiceB}
                      </div>
                    </div>
                    {isAfter5th && (
                      <span className="paper-question-marks-right">[{q.marks}]</span>
                    )}
                  </li>
                );
              }

              return (
                <li key={qIdx} value={q.questionNumber} className="paper-question-item">
                  <span className="paper-question-difficulty">
                    [{q.difficulty}]
                  </span>{" "}
                  {q.questionText}
                  {!isAfter5th && (
                    <>
                      {" "}
                      <span className="paper-question-marks">
                        [{q.marks} Marks]
                      </span>
                    </>
                  )}
                  {isAfter5th && (
                    <span className="paper-question-marks-right">[{q.marks}]</span>
                  )}
                  {/* MCQ Options */}
                  {q.options && q.options.length > 0 && (
                    <div className="paper-question-options">
                      {q.options.map((opt, oIdx) => (
                        <span key={oIdx}>{opt}</span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}

      {/* End of Question Paper */}
      <div className="paper-end-text">End of Question Paper</div>

      {/* Answer Key */}
      {paper.sections.some(s => s.questions.some(q => q.correctAnswer)) && (
        <div className="paper-answer-key-section">
          <h3 className="paper-answer-key-title">Answer Key:</h3>
          <ol className="paper-answer-key-list">
            {paper.sections.flatMap(section => section.questions).map((q, qIdx) => (
              <li key={qIdx} value={q.questionNumber} className="paper-answer-key-item">
                {q.correctAnswer || "No answer key available."}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
