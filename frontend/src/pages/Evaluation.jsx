import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePapersStore } from '../store/papers.js';
import { useEvaluationStore } from '../store/evaluation.js';
import {
  Loader, ArrowLeft, AlertTriangle,
  Maximize2, Minimize2, ClipboardEdit, X, GripVertical,
} from 'lucide-react';
import PDFViewer from '../components/pdf/PDFViewer.jsx';
import EvaluationPanel from '../components/evaluation/EvaluationPanel.jsx';

// ─── Draggable floating panel ────────────────────────────────────────────────
function FloatingPanel({ onClose, answerSheetId, paper }) {
  const panelRef = useRef(null);
  const dragState = useRef({ dragging: false, ox: 0, oy: 0 });
  const [pos, setPos] = useState({ x: window.innerWidth - 440, y: 60 });

  const onMouseDown = (e) => {
    dragState.current = { dragging: true, ox: e.clientX - pos.x, oy: e.clientY - pos.y };
  };

  const onMouseMove = useCallback((e) => {
    if (!dragState.current.dragging) return;
    setPos({ x: e.clientX - dragState.current.ox, y: e.clientY - dragState.current.oy });
  }, []);

  const onMouseUp = useCallback(() => { dragState.current.dragging = false; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  return (
    <div
      ref={panelRef}
      style={{ left: pos.x, top: pos.y, width: 400 }}
      className="fixed z-50 flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
      // max height so it doesn't overflow screen
      // eslint-disable-next-line react/forbid-dom-props
    >
      {/* drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <GripVertical size={15} />
          <span className="text-xs font-semibold uppercase tracking-wider">Marks Panel</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* panel body — fixed height, scrolls inside */}
      <div className="overflow-hidden" style={{ height: 'min(80vh, 700px)' }}>
        <EvaluationPanel answerSheetId={answerSheetId} paper={paper} />
      </div>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────
export default function Evaluation() {
  const { answerSheetId } = useParams();
  const navigate = useNavigate();
  const { fetchPaperDetails } = usePapersStore();
  const { fetchEvaluation, resetEvaluation } = useEvaluationStore();

  const [paper, setPaper]       = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]       = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showPanel, setShowPanel]   = useState(true);

  // Pick answer key: teacher-selected from Papers page takes priority
  const getAnswerKeyUrl = (p) => {
    try {
      const sel = JSON.parse(localStorage.getItem('selectedAnswerKeys') || '{}');
      const chosen = sel[answerSheetId];
      if (chosen?.fileUrl) return `http://localhost:5000${chosen.fileUrl}`;
    } catch {}
    return p?.answerKeyUrl || null;
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await fetchPaperDetails(answerSheetId);
        if (data) { setPaper(data); await fetchEvaluation(answerSheetId); }
        else setError('Paper not found');
      } catch { setError('Failed to load evaluation data'); }
      finally { setIsLoading(false); }
    };
    load();
    return () => resetEvaluation();
  }, [answerSheetId]);

  // hide sidebar + navbar in fullscreen via class on body
  useEffect(() => {
    if (fullscreen) {
      document.body.classList.add('eval-fullscreen');
    } else {
      document.body.classList.remove('eval-fullscreen');
    }
    return () => document.body.classList.remove('eval-fullscreen');
  }, [fullscreen]);

  // ── loading / error states ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="animate-spin text-indigo-600" size={28} />
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="p-8">
        <button onClick={() => navigate('/papers')} className="btn-ghost mb-6 -ml-2">
          <ArrowLeft size={16} /> Back to Papers
        </button>
        <div className="alert-error">
          <AlertTriangle size={18} className="shrink-0" />
          <p className="font-medium">{error || 'Paper not found'}</p>
        </div>
      </div>
    );
  }

  // ── fullscreen layout ───────────────────────────────────────────────────
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-gray-950">
        {/* slim top bar */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-800">
          <button
            onClick={() => setFullscreen(false)}
            className="btn-ghost py-1.5 px-2 text-xs text-gray-300 hover:text-white"
          >
            <Minimize2 size={14} /> Exit Fullscreen
          </button>
          <div className="w-px h-4 bg-gray-700" />
          <span className="text-sm font-semibold text-white truncate flex-1">
            {paper.student.rollNumber} — {paper.student.firstName} {paper.student.lastName}
            <span className="text-gray-400 ml-2 font-normal">· {paper.exam.name}</span>
          </span>

          {/* toggle marks panel */}
          <button
            onClick={() => setShowPanel((v) => !v)}
            className={`btn text-xs px-3 py-1.5 gap-1.5 ${
              showPanel
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
          >
            <ClipboardEdit size={13} />
            {showPanel ? 'Hide Marks' : 'Show Marks'}
          </button>
        </div>

        {/* two PDF columns, full height */}
        <div className="flex-1 grid grid-cols-2 overflow-hidden">
          {/* Student Answer Sheet */}
          <div className="flex flex-col border-r border-gray-800 overflow-hidden">
            <div className="shrink-0 px-4 py-2 bg-gray-800/60 border-b border-gray-800">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Student Answer Sheet
              </p>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-950">
              {paper.answerSheetUrl
                ? <PDFViewer url={paper.answerSheetUrl} />
                : <EmptyPDF label="No answer sheet available" />
              }
            </div>
          </div>

          {/* Answer Key */}
          <div className="flex flex-col overflow-hidden">
            <div className="shrink-0 px-4 py-2 bg-gray-800/60 border-b border-gray-800">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Answer Key
              </p>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-950">
              {getAnswerKeyUrl(paper)
                ? <PDFViewer url={getAnswerKeyUrl(paper)} />
                : (
                  <EmptyPDF label="No answer key uploaded">
                    <a href="/answer-keys" className="text-xs text-indigo-400 hover:underline mt-1">
                      Upload one →
                    </a>
                  </EmptyPDF>
                )
              }
            </div>
          </div>
        </div>

        {/* floating draggable marks panel */}
        {showPanel && (
          <FloatingPanel
            onClose={() => setShowPanel(false)}
            answerSheetId={answerSheetId}
            paper={paper}
          />
        )}
      </div>
    );
  }

  // ── normal layout ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <button onClick={() => navigate('/papers')} className="btn-ghost py-1.5 px-2 text-xs -ml-1">
          <ArrowLeft size={15} /> Back
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-gray-900 dark:text-white text-sm">
            {paper.student.rollNumber} — {paper.student.firstName} {paper.student.lastName}
          </span>
          <span className="text-gray-400 dark:text-gray-500 text-sm ml-2">· {paper.exam.name}</span>
        </div>

        {/* Fullscreen button */}
        <button
          onClick={() => { setFullscreen(true); setShowPanel(true); }}
          className="btn-secondary text-xs px-3 py-1.5 gap-1.5"
          title="Enter fullscreen evaluation mode"
        >
          <Maximize2 size={13} /> Fullscreen
        </button>

        <span className="badge-blue shrink-0">Total: {paper.exam.totalMarks} marks</span>
      </div>

      {/* 3-column layout */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Student Answer Sheet */}
        <div className="col-span-4 flex flex-col border-r border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="shrink-0 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Student Answer Sheet
            </p>
          </div>
          <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900">
            {paper.answerSheetUrl
              ? <PDFViewer url={paper.answerSheetUrl} />
              : <EmptyPDF label="No answer sheet available" />
            }
          </div>
        </div>

        {/* Answer Key */}
        <div className="col-span-4 flex flex-col border-r border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="shrink-0 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Answer Key
            </p>
          </div>
          <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900">
            {getAnswerKeyUrl(paper)
              ? <PDFViewer url={getAnswerKeyUrl(paper)} />
              : (
                <EmptyPDF label="No answer key uploaded">
                  <a href="/answer-keys" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1">
                    Upload one →
                  </a>
                </EmptyPDF>
              )
            }
          </div>
        </div>

        {/* Evaluation Panel */}
        <div className="col-span-4 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
          <EvaluationPanel answerSheetId={answerSheetId} paper={paper} />
        </div>
      </div>
    </div>
  );
}

function EmptyPDF({ label, children }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-1 text-gray-400 dark:text-gray-600">
      <p className="text-sm">{label}</p>
      {children}
    </div>
  );
}
