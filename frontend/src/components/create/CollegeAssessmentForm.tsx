import React, { useCallback, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FileDropzone } from "@/components/create/FileDropzone";
import { useAssignmentStore } from "@/store/useAssignmentStore";

interface CollegeAssessmentFormProps {
  onCancel: () => void;
}

export function CollegeAssessmentForm({ onCancel }: CollegeAssessmentFormProps) {
  const router = useRouter();
  
  const {
    form,
    setFormField,
    setFile,
    isSubmitting,
    submitError,
    submitAssignment,
  } = useAssignmentStore();

  // Initialize college specific fields
  useEffect(() => {
    if (!form.year) setFormField("year", "1st Year");
    if (!form.semester) setFormField("semester", "Semester 1");
    // Clear school fields
    setFormField("grade", "");
  }, [form.year, form.semester, setFormField]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const assignmentId = await submitAssignment();
      if (assignmentId) {
        router.push(`/output/${assignmentId}`);
      }
    },
    [submitAssignment, router]
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="card create-card animate-fadeIn">
        <div className="create-card-header">
          <h4>
            <span className="hide-on-mobile">College / University Details</span>
            <span className="show-on-mobile">Assignment Details</span>
          </h4>
          <p>
            <span className="hide-on-mobile">Set up assessment for higher education modules</span>
            <span className="show-on-mobile">Basic information about your assignment</span>
          </p>
        </div>

        {/* Title */}
        <div className="form-group">
          <label className="form-label" htmlFor="title">
            Title (Institution Name)
          </label>
          <input
            id="title"
            className={`form-input-text ${form.errors.title ? "error" : ""}`}
            type="text"
            value={form.title}
            onChange={(e) => setFormField("title", e.target.value)}
            placeholder="e.g. Stanford University"
          />
          {form.errors.title && (
            <span className="form-error">{form.errors.title}</span>
          )}
        </div>

        {/* Department */}
        <div className="form-group">
          <label className="form-label" htmlFor="department">
            Department
          </label>
          <input
            id="department"
            className={`form-input-text ${form.errors.department ? "error" : ""}`}
            type="text"
            value={form.department || ""}
            onChange={(e) => setFormField("department", e.target.value)}
            placeholder="e.g. Computer Science"
          />
          {form.errors.department && (
            <span className="form-error">{form.errors.department}</span>
          )}
        </div>

        {/* File Upload */}
        <FileDropzone file={form.file} onFileChange={setFile} />

        <div className="form-grid-three-col" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          {/* Subject */}
          <div className="form-group">
            <label className="form-label" htmlFor="subject">
              Course / Subject
            </label>
            <input
              id="subject"
              className={`form-input-text ${form.errors.subject ? "error" : ""}`}
              type="text"
              value={form.subject}
              onChange={(e) => setFormField("subject", e.target.value)}
              placeholder="e.g. Data Structures"
            />
            {form.errors.subject && (
              <span className="form-error">{form.errors.subject}</span>
            )}
          </div>

          {/* Year */}
          <div className="form-group">
            <label className="form-label" htmlFor="year">
              Year
            </label>
            <select
              id="year"
              className={`form-input-select ${form.errors.year ? "error" : ""}`}
              value={form.year}
              onChange={(e) => setFormField("year", e.target.value)}
            >
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
              <option value="3rd Year">3rd Year</option>
              <option value="4th Year">4th Year</option>
              <option value="5th Year">5th Year</option>
            </select>
            {form.errors.year && (
              <span className="form-error">{form.errors.year}</span>
            )}
          </div>

          {/* Semester */}
          <div className="form-group">
            <label className="form-label" htmlFor="semester">
              Semester
            </label>
            <select
              id="semester"
              className={`form-input-select ${form.errors.semester ? "error" : ""}`}
              value={form.semester}
              onChange={(e) => setFormField("semester", e.target.value)}
            >
              {[1,2,3,4,5,6,7,8,9,10].map(sem => (
                <option key={sem} value={`Semester ${sem}`}>Semester {sem}</option>
              ))}
            </select>
            {form.errors.semester && (
              <span className="form-error">{form.errors.semester}</span>
            )}
          </div>

          {/* Due Date */}
          <div className="form-group">
            <label className="form-label" htmlFor="dueDate">
              Due Date
            </label>
            <div className="date-input-container">
              <input
                id="dueDate"
                className={`form-input-date ${form.errors.dueDate ? "error" : ""} ${!form.dueDate ? "empty" : ""}`}
                type="date"
                value={form.dueDate}
                onChange={(e) => setFormField("dueDate", e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                placeholder="DD-MM-YYYY"
              />
              <span className="date-calendar-icon">
                <Image src="/assets/icons/icon-calendar.svg" alt="Calendar" width={20} height={20} />
              </span>
            </div>
            {form.errors.dueDate && (
              <span className="form-error">{form.errors.dueDate}</span>
            )}
          </div>
        </div>

        {/* Exam Structure */}
        <div className="exam-structure-section">
          <div className="exam-structure-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h5 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>Exam Structure (Auto-Generated)</h5>
            <label className="toggle-switch-container" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
              <span className="toggle-label" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Include Part C (Core Question)</span>
              <div className="toggle-switch" style={{ position: 'relative', width: '44px', height: '24px' }}>
                <input 
                  type="checkbox" 
                  checked={!!form.includePartC}
                  onChange={(e) => setFormField("includePartC", e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <span className={`toggle-slider ${form.includePartC ? 'active' : ''}`} style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: form.includePartC ? 'var(--primary)' : 'var(--gray-300)',
                  transition: '.3s', borderRadius: '24px'
                }}>
                  <span className="toggle-knob" style={{
                    position: 'absolute', content: '""', height: '18px', width: '18px', left: '3px', bottom: '3px',
                    backgroundColor: 'white', transition: '.3s', borderRadius: '50%',
                    transform: form.includePartC ? 'translateX(20px)' : 'translateX(0)'
                  }}></span>
                </span>
              </div>
            </label>
          </div>

          <div className="structure-summary-card">
            <div className="structure-part">
              <div className="part-header">Part A (Short Answer)</div>
              <div className="part-details">10 Questions × 2 Marks = 20 Marks</div>
            </div>
            
            <div className="structure-part">
              <div className="part-header">Part B (Long Answer, Either/Or Choice)</div>
              <div className="part-details">
                {form.includePartC ? "5 Questions × 13 Marks = 65 Marks" : "5 Questions × 16 Marks = 80 Marks"}
              </div>
            </div>

            {form.includePartC && (
              <div className="structure-part">
                <div className="part-header">Part C (Case Study / Core, Either/Or Choice)</div>
                <div className="part-details">1 Question × 15 Marks = 15 Marks</div>
              </div>
            )}
            
            <div className="structure-totals">
              <div>Total Questions : {form.includePartC ? 16 : 15}</div>
              <div>Total Marks : 100</div>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="form-group">
          <label className="form-label" htmlFor="additionalInstructions">
            Additional Information (For better output)
          </label>
          <div className="textarea-container">
            <textarea
              id="additionalInstructions"
              className="form-textarea"
              placeholder="e.g Generate a question paper for 3 hour exam duration.."
              value={form.additionalInstructions}
              onChange={(e) => setFormField("additionalInstructions", e.target.value)}
              rows={3}
            />
            <button type="button" className="btn-voice-input" aria-label="Voice input">
              <Image src="/assets/icons/icon-mic.svg" alt="Microphone" width={9} height={12} />
            </button>
          </div>
        </div>

        {/* Submit Error */}
        {submitError && (
          <div
            style={{
              padding: "var(--space-3) var(--space-4)",
              background: "rgba(239, 68, 68, 0.06)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "var(--radius-md)",
              color: "var(--error)",
              fontSize: "0.875rem",
            }}
          >
            {submitError}
          </div>
        )}
      </div>

      <div className="create-page-footer-actions">
        <button
          type="button"
          className="btn-previous"
          onClick={onCancel}
        >
          <Image src="/assets/icons/icon-arrow-prev.svg" alt="" width={16} height={16} />
          <span className="hide-on-mobile">Change Type</span>
          <span className="show-on-mobile">Previous</span>
        </button>

        <button
          type="submit"
          className="btn-next"
          disabled={isSubmitting}
          id="submit-assignment"
        >
          {isSubmitting ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Generating...
            </>
          ) : (
            <>
              Next
              <Image src="/assets/icons/icon-arrow-next.svg" alt="" width={16} height={16} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
