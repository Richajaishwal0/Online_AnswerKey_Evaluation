import React, { useState, useEffect } from 'react';
import { useEvaluationStore } from '../../store/evaluation.js';
import { useNavigate } from 'react-router-dom';
import {
  Save, Send, Loader, AlertCircle, CheckCircle2,
  RefreshCw, Plus, Trash2,
} from 'lucide-react';

// ─── uid helper ───────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

// ─── empty question factory ───────────────────────────────────────────────────
const makeQ = (num = '') => ({
  _id: uid(),
  questionNo: String(num),   // teacher-typed label e.g. "1", "2a", "Bonus"
  maxMarks: '',              // teacher-set max for this question
  obtainedMarks: '',         // marks given
  skipped: false,            // not attempted by student
  error: null,
});

// ─── single question row ──────────────────────────────────────────────────────
function QuestionRow({ q, index, readOnly, onChange, onRemove }) {
  const obtained = parseFloat(q.obtainedMarks) || 0;
  const max      = parseFloat(q.maxMarks)      || 0;

  return (
    <div
      className={`rounded-xl border p-3 transition-all ${
        q.skipped
          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 opacity-60'
          : q.error
          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
      {/* ── row header: Q label + max marks + skip + remove ── */}
      <div className="flex items-center gap-2 mb-2">

        {/* Question number / label */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">Q</span>
          <input
            type="text"
            value={q.questionNo}
            onChange={(e) => onChange({ ...q, questionNo: e.target.value })}
            disabled={readOnly}
            placeholder={String(index + 1)}
            className="input w-14 text-center text-sm font-semibold px-2 py-1.5"
          />
        </div>

        {/* Max marks */}
        <div className="flex items-center gap-1 flex-1">
          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">/ Max</span>
          <input
            type="number"
            min="0"
            value={q.maxMarks}
            onChange={(e) => onChange({ ...q, maxMarks: e.target.value, error: null })}
            disabled={readOnly || q.skipped}
            placeholder="10"
            className="input text-center text-sm px-2 py-1.5"
          />
        </div>

        {/* Skip toggle */}
        {!readOnly && (
          <button
            type="button"
            onClick={() => onChange({ ...q, skipped: !q.skipped, obtainedMarks: q.skipped ? '' : '0', error: null })}
            title={q.skipped ? 'Mark as attempted' : 'Mark as not attempted'}
            className={`shrink-0 text-xs px-2 py-1 rounded-lg border font-medium transition-colors ${
              q.skipped
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'
                : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400'
            }`}
          >
            {q.skipped ? 'Skipped' : 'Skip'}
          </button>
        )}

        {/* Remove */}
        {!readOnly && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* ── obtained marks input ── */}
      {!q.skipped && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max={max || undefined}
            value={q.obtainedMarks}
            onChange={(e) => onChange({ ...q, obtainedMarks: e.target.value })}
            disabled={readOnly}
            placeholder="Obtained marks"
            className="input"
          />
          {max > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">
              / {max}
            </span>
          )}
        </div>
      )}

      {q.skipped && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">Not attempted — excluded from total</p>
      )}

      {q.error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{q.error}</p>}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function EvaluationPanel({ answerSheetId, paper }) {
  const navigate = useNavigate();
  const { evaluation, saveDraft, submitEvaluation, isSaving, error, clearError } = useEvaluationStore();

  // All questions are teacher-defined
  // shape: [{ _id, questionNo, maxMarks, obtainedMarks, skipped, error }]
  const [questions, setQuestions]           = useState([]);
  const [localRemarks, setLocalRemarks]     = useState('');
  const [targetMarks, setTargetMarks]       = useState('');
  const [convertedResult, setConvertedResult] = useState(null);
  const [successMsg, setSuccessMsg]         = useState('');

  const isReadOnly = evaluation?.status === 'SUBMITTED';

  // ── derived totals (only non-skipped questions) ───────────────────────────
  const activeQs      = questions.filter((q) => !q.skipped);
  const totalObtained = activeQs.reduce((s, q) => s + (parseFloat(q.obtainedMarks) || 0), 0);
  const totalMax      = activeQs.reduce((s, q) => s + (parseFloat(q.maxMarks)      || 0), 0);
  const skippedCount  = questions.length - activeQs.length;

  // ── seed questions on first load ──────────────────────────────────────────
  // Priority: saved customMarks → DB questions → 1 blank row
  useEffect(() => {
    if (evaluation) {
      // restore from saved customMarks
      if (Array.isArray(evaluation.customMarks) && evaluation.customMarks.length) {
        setQuestions(
          evaluation.customMarks.map((c) => ({
            _id:          uid(),
            questionNo:   c.questionNo   ?? c.label ?? '',
            maxMarks:     String(c.maxMarks      ?? ''),
            obtainedMarks: String(c.obtainedMarks ?? ''),
            skipped:      c.skipped      ?? false,
            error:        null,
          })),
        );
        if (evaluation.remarks)     setLocalRemarks(evaluation.remarks);
        if (evaluation.targetMarks) setTargetMarks(String(evaluation.targetMarks));
        return;
      }
      if (evaluation.remarks)     setLocalRemarks(evaluation.remarks);
      if (evaluation.targetMarks) setTargetMarks(String(evaluation.targetMarks));
    }

    // seed from DB questions if no saved data yet
    if (paper.questions?.length) {
      setQuestions(
        paper.questions.map((q) => makeQ(q.questionNumber)),
      );
    } else {
      setQuestions([makeQ(1)]);
    }
  }, [evaluation]);

  // ── question CRUD ─────────────────────────────────────────────────────────
  const addQuestion = () => {
    const nextNum = questions.length + 1;
    setQuestions((prev) => [...prev, makeQ(nextNum)]);
    setConvertedResult(null);
  };

  const updateQuestion = (id, updated) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q._id !== id) return q;
        if (updated.skipped) return { ...updated, _id: id, error: null };
        const obtained = parseFloat(updated.obtainedMarks) || 0;
        const max      = parseFloat(updated.maxMarks)      || 0;
        let err = null;
        if (obtained < 0)               err = 'Cannot be negative';
        else if (max > 0 && obtained > max) err = `Cannot exceed ${max}`;
        return { ...updated, _id: id, error: err };
      }),
    );
    setConvertedResult(null);
    clearError();
  };

  const removeQuestion = (id) => {
    setQuestions((prev) => prev.filter((q) => q._id !== id));
    setConvertedResult(null);
  };

  // ── conversion ────────────────────────────────────────────────────────────
  const handleConvert = () => {
    const target = parseFloat(targetMarks);
    if (!target || target <= 0 || totalMax <= 0) return;
    const converted = ((totalObtained / totalMax) * target).toFixed(2);
    setConvertedResult({ obtained: totalObtained, outOf: totalMax, target, converted });
  };

  // ── payload builder ───────────────────────────────────────────────────────
  // Everything goes as customMarks; marks[] stays empty (no DB question FK needed)
  const getCustomArray = () =>
    questions.map((q) => ({
      questionNo:    q.questionNo   || '',
      label:         q.questionNo   || '',   // keep label for backward compat
      maxMarks:      parseFloat(q.maxMarks)      || 0,
      obtainedMarks: q.skipped ? 0 : (parseFloat(q.obtainedMarks) || 0),
      skipped:       q.skipped,
    }));

  const hasErrors = questions.some((q) => q.error);

  // ── save / submit ─────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (hasErrors) return;
    const result = await saveDraft(
      answerSheetId, [], localRemarks,
      parseFloat(targetMarks) || 0, getCustomArray(),
    );
    if (result) { setSuccessMsg('Draft saved!'); setTimeout(() => setSuccessMsg(''), 3000); }
  };

  const handleSubmit = async () => {
    if (hasErrors) return;
    if (questions.length === 0) { alert('Add at least one question before submitting.'); return; }
    if (!window.confirm('Submit this evaluation? It cannot be edited after submission.')) return;
    const result = await submitEvaluation(
      answerSheetId, [], localRemarks,
      parseFloat(targetMarks) || 0, getCustomArray(),
    );
    if (result) { setSuccessMsg('Submitted!'); setTimeout(() => navigate('/papers'), 2000); }
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="shrink-0 px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
        <h2 className="font-bold text-gray-900 dark:text-white text-sm">Evaluation Panel</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {paper.student.rollNumber} · {paper.exam.name}
        </p>
        {isReadOnly && (
          <span className="badge-green mt-2 inline-flex">
            <CheckCircle2 size={11} /> Submitted — Read Only
          </span>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {successMsg && <div className="alert-success"><CheckCircle2 size={14} /> {successMsg}</div>}
        {error      && <div className="alert-error"><AlertCircle size={14} /> {error}</div>}

        {/* Live total bar */}
        <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Total</span>
            <span className="text-lg font-bold text-indigo-800 dark:text-indigo-200">
              {totalObtained} / {totalMax || '—'}
            </span>
          </div>
          {skippedCount > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              {skippedCount} question{skippedCount > 1 ? 's' : ''} skipped / not attempted
            </p>
          )}
          {/* progress bar */}
          {totalMax > 0 && (
            <div className="mt-2 h-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (totalObtained / totalMax) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Questions list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Questions
              <span className="ml-2 text-gray-400 dark:text-gray-600 font-normal normal-case">
                ({questions.length} total{skippedCount > 0 ? `, ${skippedCount} skipped` : ''})
              </span>
            </p>
            {!isReadOnly && (
              <button
                type="button"
                onClick={addQuestion}
                className="btn-secondary text-xs px-2.5 py-1 gap-1"
              >
                <Plus size={12} /> Add
              </button>
            )}
          </div>

          {questions.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 py-8 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">No questions yet.</p>
              {!isReadOnly && (
                <button type="button" onClick={addQuestion} className="btn-primary mt-3 text-xs px-4 py-2">
                  <Plus size={13} /> Add First Question
                </button>
              )}
            </div>
          )}

          {questions.map((q, i) => (
            <QuestionRow
              key={q._id}
              q={q}
              index={i}
              readOnly={isReadOnly}
              onChange={(updated) => updateQuestion(q._id, updated)}
              onRemove={() => removeQuestion(q._id)}
            />
          ))}
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            Remarks (Optional)
          </label>
          <textarea
            value={localRemarks}
            onChange={(e) => setLocalRemarks(e.target.value)}
            disabled={isReadOnly}
            placeholder="Add feedback or remarks..."
            rows={3}
            className="input resize-none"
          />
        </div>

        {/* Mark Conversion */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Mark Conversion
          </p>

          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
              <p className="text-xs text-gray-400 dark:text-gray-500">Obtained</p>
              <p className="text-base font-bold text-gray-900 dark:text-white">
                {totalObtained} / {totalMax || '—'}
              </p>
            </div>
            <span className="text-gray-400 dark:text-gray-600 text-xl font-light">→</span>
            <div className="flex-1">
              <input
                type="number"
                min="1"
                value={targetMarks}
                onChange={(e) => { setTargetMarks(e.target.value); setConvertedResult(null); }}
                disabled={isReadOnly}
                placeholder="Out of?"
                className="input text-center"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">Convert to</p>
            </div>
          </div>

          {!isReadOnly && (
            <button
              onClick={handleConvert}
              disabled={!targetMarks || parseFloat(targetMarks) <= 0 || totalMax <= 0}
              className="btn-primary w-full"
            >
              <RefreshCw size={14} /> Convert Marks
            </button>
          )}

          {convertedResult && (
            <div className="mt-3 bg-indigo-600 rounded-xl p-4 text-center text-white">
              <p className="text-xs opacity-75 mb-1">
                {convertedResult.obtained} / {convertedResult.outOf} → / {convertedResult.target}
              </p>
              <p className="text-4xl font-bold">{convertedResult.converted}</p>
              <p className="text-xs opacity-60 mt-1">out of {convertedResult.target}</p>
            </div>
          )}

          {evaluation?.totalConvertedMarks > 0 && !convertedResult && (
            <div className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 p-3 text-center">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-0.5">Previously converted</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {evaluation.totalConvertedMarks} / {evaluation.targetMarks}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {!isReadOnly && (
        <div className="shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2">
          <button onClick={handleSaveDraft} disabled={isSaving || hasErrors} className="btn-secondary w-full">
            {isSaving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
            Save Draft
          </button>
          <button onClick={handleSubmit} disabled={isSaving || hasErrors} className="btn-primary w-full">
            {isSaving ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
            Submit Evaluation
          </button>
        </div>
      )}
    </div>
  );
}
