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


/**
 * High-fidelity A4-style question paper rendering.
 * Matches the Figma output screenshot with school name, subject, class,
 * time/marks row, instructions, student info fields, and numbered sections/questions.
 */
export function QuestionPaperSheet({ paper, title, grade }: QuestionPaperSheetProps) {
  let displayTitle = title || paper.title;

  return (
    <div className="paper-sheet animate-fadeIn" id="question-paper">
      {/* School Name */}
      <h2 className="paper-school-name">{displayTitle}</h2>

      {/* Subject & Class */}
      <p className="paper-sub-header">
        <strong>Subject: {paper.subject}</strong>
      </p>
      {grade && (
        <p className="paper-sub-header">
          <strong>Grade: {grade}</strong>
        </p>
      )}

      {/* Time Allowed & Maximum Marks */}
      <div className="paper-meta-row">
        <span>Time Allowed: {paper.duration}</span>
        <span>Maximum Marks: {paper.totalMarks}</span>
      </div>

      {/* General Instructions */}
      {paper.generalInstructions && paper.generalInstructions.length > 0 ? (
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
      <div className="paper-student-info">
        <div className="paper-student-field">
          Name:
          <div className="paper-student-line" />
        </div>
        <div className="paper-student-field">
          Roll Number:
          <div className="paper-student-line" />
        </div>
        <div className="paper-student-field">
          Class: {grade || ""} Section:
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
            {section.instruction}
          </p>

          <ol className="paper-question-list">
            {section.questions.map((q, qIdx) => {
              const isAfter5th = isGradeAfterFifth(grade);

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
            {paper.sections
              .flatMap(section => section.questions)
              .filter((q): q is typeof q & { correctAnswer: string } => Boolean(q.correctAnswer))
              .map((q) => (
              <li key={`ans-${q.questionNumber}`} value={q.questionNumber} className="paper-answer-key-item">
                {q.correctAnswer}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
