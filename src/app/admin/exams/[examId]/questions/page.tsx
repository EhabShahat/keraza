"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useCallback, use } from "react";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// Note: ReactQuill removed due to React 18 compatibility issues
// Using simple textarea with HTML formatting support instead

interface QuestionRow {
  id: string;
  exam_id: string;
  question_text: string;
  question_type: "true_false" | "single_choice" | "multiple_choice" | "multi_select" | "paragraph";
  options: string[] | null;
  correct_answers: unknown;
  required: boolean;
  points: number;
  order_index: number | null;
}

export default function AdminQuestionsPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  const qc = useQueryClient();
  const toast = useToast();
  
  // Modal states
  const [editingQuestion, setEditingQuestion] = useState<QuestionRow | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "questions", examId],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}/questions`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load failed");
      return (j.items as QuestionRow[]).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    },
  });

  // Local working list to support drag-and-drop without flicker
  const [rows, setRows] = useState<QuestionRow[] | null>(null);
  useEffect(() => {
    setRows(data ?? null);
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const [reordering, setReordering] = useState(false);
  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (!rows) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = rows.findIndex((r) => r.id === active.id);
      const newIndex = rows.findIndex((r) => r.id === over.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const newRows = arrayMove(rows, oldIndex, newIndex);
      setRows(newRows);
      setReordering(true);
      try {
        await authFetch(`/api/admin/exams/${examId}/questions/reorder`, {
          method: "PATCH",
          body: JSON.stringify({ items: newRows.map((r: QuestionRow, idx: number) => ({ id: r.id, order_index: idx + 1 })) }),
        });
        qc.invalidateQueries({ queryKey: ["admin", "questions", examId] });
        toast.success({ title: "Questions reordered", message: "Order updated successfully" });
      } catch (e: unknown) {
        toast.error({ title: "Reorder failed", message: (e as Error)?.message || "Unknown error" });
      } finally {
        setReordering(false);
      }
    },
    [rows, examId, qc, toast]
  );

  const updateQ = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<QuestionRow> }) => {
      const res = await authFetch(`/api/admin/exams/${examId}/questions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Update failed");
      return j.item as QuestionRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "questions", examId] });
      setEditingQuestion(null);
      toast.success({ title: "Question updated", message: "Changes saved successfully" });
    },
    onError: (e: unknown) => toast.error({ title: "Update failed", message: (e as Error)?.message || "Unknown error" }),
  });

  const deleteQ = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/admin/exams/${examId}/questions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error || "Delete failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "questions", examId] });
      toast.success({ title: "Question deleted", message: "Removed successfully" });
    },
    onError: (e: unknown) => toast.error({ title: "Delete failed", message: (e as Error)?.message || "Unknown error" }),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Questions</h1>
          <p className="text-muted-foreground mt-1">
            {rows?.length || 0} question{(rows?.length || 0) !== 1 ? 's' : ''} in this exam
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowImportModal(true)}
            className="btn btn-outline"
          >
            📁 Import
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
          >
            ➕ Add Question
          </button>
        </div>
      </div>

      {/* Reordering indicator */}
      {reordering && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center gap-2 text-blue-700">
            <span className="spinner" />
            Reordering questions...
          </div>
        </div>
      )}

      {/* Questions List */}
      {rows && rows.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {rows.map((question, index) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  index={index}
                  onEdit={() => setEditingQuestion(question)}
                  onDelete={() => {
                    if (confirm("Delete this question? This cannot be undone.")) {
                      deleteQ.mutate(question.id);
                    }
                  }}
                  isDeleting={deleteQ.isPending}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <EmptyState onAddQuestion={() => setShowAddModal(true)} />
      )}

      {/* Modals */}
      {showAddModal && (
        <AddQuestionModal
          examId={examId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            qc.invalidateQueries({ queryKey: ["admin", "questions", examId] });
          }}
        />
      )}

      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSave={(patch) => updateQ.mutate({ id: editingQuestion.id, patch })}
          isSaving={updateQ.isPending}
        />
      )}

      {showImportModal && (
        <ImportQuestionsModal
          examId={examId}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            qc.invalidateQueries({ queryKey: ["admin", "questions", examId] });
          }}
        />
      )}
    </div>
  );
}

// Question Card Component
function QuestionCard({ 
  question, 
  index, 
  onEdit, 
  onDelete, 
  isDeleting 
}: { 
  question: QuestionRow; 
  index: number; 
  onEdit: () => void; 
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: question.id 
  });
  
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };

  const getQuestionTypeLabel = (type: string) => {
    const labels = {
      true_false: "True/False",
      single_choice: "Single Choice",
      multiple_choice: "Multiple Choice", 
      multi_select: "Multi Select",
      paragraph: "Essay/Paragraph"
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getQuestionTypeColor = (type: string) => {
    const colors = {
      true_false: "bg-blue-100 text-blue-800 border-blue-200",
      single_choice: "bg-green-100 text-green-800 border-green-200",
      multiple_choice: "bg-purple-100 text-purple-800 border-purple-200",
      multi_select: "bg-orange-100 text-orange-800 border-orange-200",
      paragraph: "bg-gray-100 text-gray-800 border-gray-200"
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-4">
        {/* Drag Handle */}
        <div 
          {...attributes} 
          {...listeners}
          className="drag-handle mt-1 p-2 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          ⠿
        </div>

        {/* Question Number */}
        <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm">
          {index + 1}
        </div>

        {/* Question Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <div 
                className="text-foreground font-medium leading-relaxed"
                dangerouslySetInnerHTML={{ 
                  __html: question.question_text.length > 150 
                    ? question.question_text.substring(0, 150) + "..." 
                    : question.question_text 
                }}
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`badge ${getQuestionTypeColor(question.question_type)}`}>
                {getQuestionTypeLabel(question.question_type)}
              </span>
              {question.required && (
                <span className="badge badge-red">Required</span>
              )}
              <span className="text-sm text-muted-foreground">
                {question.points} pt{question.points !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Options Preview */}
          {(question.options?.length ?? 0) > 0 && (
            <div className="mb-3">
              <div className="text-sm text-muted-foreground mb-1">Options:</div>
              <div className="flex flex-wrap gap-2">
                {(question.options ?? []).slice(0, 4).map((option, idx) => (
                  <span key={idx} className="badge badge-outline text-xs">
                    {option.length > 20 ? option.substring(0, 20) + "..." : option}
                  </span>
                ))}
                {(question.options ?? []).length > 4 && (
                  <span className="badge badge-outline text-xs">
                    +{(question.options ?? []).length - 4} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Correct Answer Preview */}
          {question.correct_answers != null && (
            <div className="mb-3">
              <div className="text-sm text-muted-foreground mb-1">Correct answer:</div>
              <span className="badge badge-green text-xs">
                {formatCorrectAnswer(question)}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onEdit}
            className="btn btn-sm btn-outline"
            title="Edit question"
          >
            ✏️ Edit
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="btn btn-sm btn-destructive"
            title="Delete question"
          >
            {isDeleting ? <span className="spinner" /> : "🗑️"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper function to format correct answers
function formatCorrectAnswer(question: QuestionRow): string {
  if (question.question_type === "true_false") {
    return String(question.correct_answers);
  }
  if (Array.isArray(question.correct_answers)) {
    return question.correct_answers.join(", ");
  }
  return String(question.correct_answers || "");
}

// Loading State Component
function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-48 mt-2 animate-pulse"></div>
        </div>
        <div className="flex gap-3">
          <div className="h-10 bg-gray-200 rounded w-20 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mt-2 animate-pulse"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Error State Component
function ErrorState({ message }: { message: string }) {
  return (
    <div className="card bg-red-50 border-red-200">
      <div className="text-center py-8">
        <div className="text-red-600 text-lg font-semibold mb-2">
          Failed to load questions
        </div>
        <div className="text-red-500 text-sm">{message}</div>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState({ onAddQuestion }: { onAddQuestion: () => void }) {
  return (
    <div className="card bg-gray-50 border-dashed border-2">
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No questions yet
        </h3>
        <p className="text-muted-foreground mb-6">
          Get started by adding your first question or importing from a file.
        </p>
        <div className="flex justify-center gap-3">
          <button onClick={onAddQuestion} className="btn btn-primary">
            ➕ Add First Question
          </button>
        </div>
      </div>
    </div>
  );
}

// Add Question Modal Component
function AddQuestionModal({ 
  examId, 
  onClose, 
  onSuccess 
}: { 
  examId: string; 
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const toast = useToast();
  const [formData, setFormData] = useState<Partial<QuestionRow>>({
    question_text: "",
    question_type: "single_choice",
    options: [],
    correct_answers: null,
    required: true,
    points: 1,
  });

  const saveNew = useMutation({
    mutationFn: async (payload: Partial<QuestionRow>) => {
      const res = await authFetch(`/api/admin/exams/${examId}/questions`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Create failed");
      return j.item as QuestionRow;
    },
    onSuccess: () => {
      toast.success({ title: "Question added", message: "Question created successfully" });
      onSuccess();
    },
    onError: (e: unknown) => toast.error({ title: "Add failed", message: (e as Error)?.message || "Unknown error" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question_text?.trim()) {
      toast.error({ title: "Validation error", message: "Question text is required" });
      return;
    }
    saveNew.mutate(formData);
  };

  return (
    <Modal title="Add New Question" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <QuestionForm 
          formData={formData} 
          setFormData={setFormData}
        />
        
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={saveNew.isPending || !formData.question_text?.trim()}
            className="btn btn-primary"
          >
            {saveNew.isPending ? (
              <span className="inline-flex items-center gap-2">
                <span className="spinner" />
                Adding...
              </span>
            ) : (
              "Add Question"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Edit Question Modal Component
function EditQuestionModal({ 
  question, 
  onClose, 
  onSave, 
  isSaving 
}: { 
  question: QuestionRow; 
  onClose: () => void; 
  onSave: (patch: Partial<QuestionRow>) => void;
  isSaving: boolean;
}) {
  const toast = useToast();
  const [formData, setFormData] = useState<Partial<QuestionRow>>({
    question_text: question.question_text,
    question_type: question.question_type,
    options: question.options || [],
    correct_answers: question.correct_answers,
    required: question.required,
    points: question.points,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question_text?.trim()) {
      toast.error({ title: "Validation error", message: "Question text is required" });
      return;
    }
    onSave(formData);
  };

  return (
    <Modal title="Edit Question" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <QuestionForm 
          formData={formData} 
          setFormData={setFormData}
        />
        
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isSaving || !formData.question_text?.trim()}
            className="btn btn-primary"
          >
            {isSaving ? (
              <span className="inline-flex items-center gap-2">
                <span className="spinner" />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Question Form Component (shared between Add and Edit)
function QuestionForm({ 
  formData, 
  setFormData 
}: { 
  formData: Partial<QuestionRow>; 
  setFormData: (data: Partial<QuestionRow>) => void; 
}) {
  const updateField = (field: keyof QuestionRow, value: unknown) => {
    setFormData({ ...formData, [field]: value });
  };

  const addOption = () => {
    const options = formData.options || [];
    updateField('options', [...options, '']);
  };

  const updateOption = (index: number, value: string) => {
    const options = [...(formData.options || [])];
    options[index] = value;
    updateField('options', options);
  };

  const removeOption = (index: number) => {
    const options = [...(formData.options || [])];
    options.splice(index, 1);
    updateField('options', options);
  };

  const needsOptions = ['single_choice', 'multiple_choice', 'multi_select'].includes(formData.question_type || '');

  return (
    <div className="space-y-6">
      {/* Question Type */}
      <div>
        <label className="label">Question Type</label>
        <select 
          className="select" 
          value={formData.question_type}
          onChange={(e) => updateField('question_type', e.target.value)}
        >
          <option value="true_false">True/False</option>
          <option value="single_choice">Single Choice (radio buttons - one answer)</option>
          <option value="multiple_choice">Multiple Choice (radio buttons - multiple correct)</option>
          <option value="multi_select">Multi Select (checkboxes - multiple answers)</option>
          <option value="paragraph">Essay/Paragraph (text input)</option>
        </select>
        <div className="text-xs text-muted-foreground mt-1">
          {formData.question_type === "single_choice" && "Students can select only one option, and only one is correct."}
          {formData.question_type === "multiple_choice" && "Students can select only one option, but multiple options can be marked as correct."}
          {formData.question_type === "multi_select" && "Students can select multiple options using checkboxes."}
          {formData.question_type === "true_false" && "Simple true or false question."}
          {formData.question_type === "paragraph" && "Open-ended text response question."}
        </div>
      </div>

      {/* Question Text */}
      <div>
        <label className="label">Question Text</label>
        {formData.question_type === "paragraph" ? (
          <RichTextEditor
            value={formData.question_text || ""}
            onChange={(value: string) => updateField('question_text', value)}
            placeholder="Enter your question..."
          />
        ) : (
          <textarea
            className="textarea"
            rows={3}
            placeholder="Enter your question..."
            value={formData.question_text || ""}
            onChange={(e) => updateField('question_text', e.target.value)}
          />
        )}
      </div>

      {/* Options (for choice questions) */}
      {needsOptions && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="label">Answer Options</label>
            <button 
              type="button" 
              onClick={addOption}
              className="btn btn-sm btn-outline"
            >
              ➕ Add Option
            </button>
          </div>
          <div className="space-y-3">
            {(formData.options || []).map((option, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-10 bg-gray-100 rounded flex items-center justify-center text-sm font-medium">
                  {String.fromCharCode(65 + index)}
                </div>
                <input
                  className="input flex-1"
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="btn btn-sm btn-destructive"
                  title="Remove option"
                >
                  🗑️
                </button>
              </div>
            ))}
            {(!formData.options || formData.options.length === 0) && (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                No options yet. Click &quot;Add Option&quot; to get started.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Correct Answer */}
      <div>
        <label className="label">Correct Answer (Optional)</label>
        {formData.question_type === "true_false" ? (
          <select 
            className="select" 
            value={String(formData.correct_answers || "")}
            onChange={(e) => updateField('correct_answers', e.target.value === "true")}
          >
            <option value="">Select correct answer</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        ) : needsOptions ? (
          <div>
            <div className="text-sm text-muted-foreground mb-2">
              {formData.question_type === "single_choice" 
                ? "Select the correct option:" 
                : "Select one or more correct options:"}
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {(formData.options || []).map((option, index) => (
                <label key={index} className="flex items-center gap-3 p-2 border rounded hover:bg-gray-50">
                  <input
                    type={formData.question_type === "single_choice" ? "radio" : "checkbox"}
                    name="correct_answer"
                    checked={
                      formData.question_type === "single_choice" 
                        ? formData.correct_answers === option
                        : Array.isArray(formData.correct_answers) && formData.correct_answers.includes(option)
                    }
                    onChange={(e) => {
                      if (formData.question_type === "single_choice") {
                        updateField('correct_answers', e.target.checked ? option : null);
                      } else {
                        const current = Array.isArray(formData.correct_answers) ? formData.correct_answers : [];
                        if (e.target.checked) {
                          updateField('correct_answers', [...current, option]);
                        } else {
                          updateField('correct_answers', current.filter(a => a !== option));
                        }
                      }
                    }}
                  />
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-medium">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1">{option || `Option ${String.fromCharCode(65 + index)}`}</span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <input
            className="input"
            placeholder="Enter the correct answer..."
            value={String(formData.correct_answers || "")}
            onChange={(e) => updateField('correct_answers', e.target.value)}
          />
        )}
      </div>

      {/* Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Points</label>
          <input
            type="number"
            min={0}
            step={0.5}
            className="input"
            value={formData.points || 1}
            onChange={(e) => updateField('points', Number(e.target.value))}
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.required ?? true}
              onChange={(e) => updateField('required', e.target.checked)}
            />
            <span className="label">Required question</span>
          </label>
        </div>
      </div>
    </div>
  );
}

// Import Questions Modal Component
function ImportQuestionsModal({ 
  examId, 
  onClose, 
  onSuccess 
}: { 
  examId: string; 
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const toast = useToast();
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<QuestionRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const templateCsv = useMemo(() => (
    "question_text,question_type,options,correct_answers,required,points\n" +
    "What is 2+2?,single_choice,2|3|4|5,4,true,1\n" +
    "Sky is blue?,true_false,,true,true,1\n" +
    "Select primes,multi_select,2|3|4|5,2|3|5,true,2\n"
  ), []);

  async function handleFile(file: File) {
    setImportErrors([]);
    setPreview([]);
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".csv")) {
        const txt = await file.text();
        const rows = await parseCsv(txt);
        const mapped = mapRows(rows);
        setPreview(mapped);
      } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const buf = await file.arrayBuffer();
        const rows = await parseXlsx(buf);
        const mapped = mapRows(rows);
        setPreview(mapped);
      } else {
        setImportErrors(["Unsupported file type. Use CSV or XLSX."]);
      }
    } catch (e: unknown) {
      setImportErrors([(e as Error)?.message || "Import failed"]);
      toast.error({ title: "Import failed", message: (e as Error)?.message || "Unknown error" });
    }
  }

  async function commitImport() {
    if (!preview.length) return;
    setIsImporting(true);
    try {
      const payload = preview.map(({ id: _id, exam_id: _examId, ...rest }) => ({ ...rest, exam_id: examId }));
      const res = await authFetch(`/api/admin/exams/${examId}/questions`, {
        method: "POST",
        body: JSON.stringify({ items: payload }),
      });
      const j = await res.json();
      if (!res.ok) {
        setImportErrors([j?.error || "Bulk import failed"]);
        return;
      }
      const n = j.items?.length ?? 0;
      toast.success({ title: "Import complete", message: `Imported ${n} questions` });
      onSuccess();
    } catch (e: unknown) {
      setImportErrors([(e as Error)?.message || "Import failed"]);
    } finally {
      setIsImporting(false);
    }
  }

  function downloadTemplate() {
    try {
      const blob = new Blob([templateCsv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "questions-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Ignore errors
    }
  }

  function onDropZone(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }

  function onDragOverZone(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeaveZone(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
  }

  function mapRows(rows: unknown[][]): QuestionRow[] {
    const [header, ...dataRows] = rows;
    if (!header) throw new Error("Empty file");
    const idx = (name: string) => header.findIndex((h: unknown) => String(h).trim().toLowerCase() === name);
    const qi = idx("question_text");
    const ti = idx("question_type");
    const oi = idx("options");
    const ci = idx("correct_answers");
    const ri = idx("required");
    const pi = idx("points");
    if (qi < 0 || ti < 0) throw new Error("Missing required headers: question_text, question_type");

    const out: QuestionRow[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const question_text = String(r[qi] ?? "").trim();
      const question_type = String(r[ti] ?? "").trim() as QuestionRow["question_type"];
      if (!question_text || !question_type) continue;
      let options: string[] | null = null;
      if (oi >= 0 && r[oi]) options = String(r[oi]).split("|").map((s) => String(s).trim()).filter(Boolean);
      let correct: unknown = null;
      if (ci >= 0 && r[ci] != null) {
        const raw = String(r[ci]);
        if (question_type === "multiple_choice" || question_type === "multi_select") correct = raw.split("|").map((s) => s.trim());
        else if (question_type === "true_false") correct = raw.toLowerCase() === "true";
        else correct = raw;
      }
      const required = ri >= 0 ? String(r[ri]).toLowerCase() !== "false" : true;
      const points = pi >= 0 ? Number(r[pi]) || 1 : 1;
      // Generate UUID using browser's crypto API or fallback to a simple random string
      const generateUUID = () => {
        try {
          return window.crypto.randomUUID();
        } catch (e) {
          // Simple fallback for browsers without randomUUID support
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        }
      };
      
      out.push({
        id: generateUUID(),
        exam_id: examId,
        question_text,
        question_type,
        options,
        correct_answers: correct,
        required,
        points,
        order_index: out.length + 1,
      });
    }
    return out;
  }

  async function parseCsv(text: string): Promise<unknown[][]> {
    try {
      const Papa = (await import("papaparse")).default as { parse: (text: string, options: { skipEmptyLines: boolean }) => { data: unknown[][] } };
      const res = Papa.parse(text.trim(), { skipEmptyLines: true });
      return [res.data[0] as unknown[], ...res.data.slice(1)];
    } catch {
      const lines = text.split(/\r?\n/).filter(Boolean);
      const rows = lines.map((l) => l.split(","));
      return rows;
    }
  }

  async function parseXlsx(buf: ArrayBuffer): Promise<unknown[][]> {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
      return rows;
    } catch (e) {
      throw new Error("Install 'xlsx' to import Excel files");
    }
  }

  return (
    <Modal title="Import Questions" onClose={onClose} size="large">
      <div className="space-y-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Import Instructions</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Upload a CSV or Excel file with your questions</li>
            <li>• Required columns: question_text, question_type</li>
            <li>• Optional columns: options, correct_answers, required, points</li>
            <li>• For options and multiple correct answers, separate with | (pipe)</li>
          </ul>
        </div>

        {/* File Upload */}
        <div>
          <div 
            className={`dropzone ${dragOver ? "dragover" : ""}`} 
            onDrop={onDropZone} 
            onDragOver={onDragOverZone} 
            onDragLeave={onDragLeaveZone}
          >
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📁</div>
              <div className="text-lg font-semibold mb-2">Drop your file here</div>
              <div className="text-muted-foreground mb-4">or click to browse</div>
              <input 
                type="file" 
                accept=".csv,.xlsx,.xls" 
                onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                className="hidden"
                id="file-input"
              />
              <label htmlFor="file-input" className="btn btn-outline">
                Choose File
              </label>
            </div>
          </div>
        </div>

        {/* Template Download */}
        <div className="flex justify-center">
          <button onClick={downloadTemplate} className="btn btn-outline btn-sm">
            📥 Download Template CSV
          </button>
        </div>

        {/* Errors */}
        {importErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-2">Import Errors</h3>
            <ul className="text-sm text-red-800 space-y-1">
              {importErrors.map((error, i) => (
                <li key={i}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-green-900">
                Preview: {preview.length} question{preview.length !== 1 ? 's' : ''} ready to import
              </h3>
              <button 
                onClick={commitImport}
                disabled={isImporting}
                className="btn btn-primary"
              >
                {isImporting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="spinner" />
                    Importing...
                  </span>
                ) : (
                  `Import ${preview.length} Questions`
                )}
              </button>
            </div>
            
            <div className="max-h-60 overflow-y-auto">
              <div className="space-y-2">
                {preview.slice(0, 5).map((q, i) => (
                  <div key={i} className="bg-white border rounded p-3 text-sm">
                    <div className="font-medium mb-1">{q.question_text}</div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Type: {q.question_type}</span>
                      <span>Points: {q.points}</span>
                      {q.options && <span>Options: {q.options.length}</span>}
                    </div>
                  </div>
                ))}
                {preview.length > 5 && (
                  <div className="text-center text-sm text-muted-foreground py-2">
                    ... and {preview.length - 5} more questions
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button onClick={onClose} className="btn btn-outline">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Modal Component
function Modal({ 
  title, 
  children, 
  onClose, 
  size = "default" 
}: { 
  title: string; 
  children: React.ReactNode; 
  onClose: () => void;
  size?: "default" | "large";
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const sizeClasses = {
    default: "max-w-2xl",
    large: "max-w-4xl"
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden`}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button 
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

// Rich Text Editor Component with React 18 compatibility
function RichTextEditor({ 
  value, 
  onChange, 
  placeholder 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  placeholder?: string; 
}) {
  const [isClient, setIsClient] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsClient(true);
    // Add a small delay to ensure ReactQuill loads properly
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Fallback to textarea for better compatibility
  const renderTextarea = () => (
    <textarea
      className="textarea"
      rows={5}
      placeholder={placeholder || "Enter your question..."}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );

  if (!isClient || isLoading) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="animate-pulse text-muted-foreground">Loading rich text editor...</div>
      </div>
    );
  }

  if (hasError) {
    return renderTextarea();
  }

  // Use a simple textarea with formatting hints for better compatibility
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        You can use basic HTML tags: &lt;b&gt;bold&lt;/b&gt;, &lt;i&gt;italic&lt;/i&gt;, &lt;u&gt;underline&lt;/u&gt;, &lt;br&gt; for line breaks
      </div>
      <textarea
        className="textarea"
        rows={6}
        placeholder={placeholder || "Enter your question... (HTML formatting supported)"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="text-xs text-muted-foreground">
        Preview: <span dangerouslySetInnerHTML={{ __html: value || "Your formatted text will appear here..." }} />
      </div>
    </div>
  );

  /* 
  // Uncomment this when ReactQuill is fully React 18 compatible
  try {
    return (
      <div className="border rounded-lg overflow-hidden">
        <ReactQuill 
          theme="snow" 
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          modules={{
            toolbar: [
              [{ 'header': [1, 2, 3, false] }],
              ['bold', 'italic', 'underline'],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              ['link'],
              ['clean']
            ],
          }}
          formats={[
            'header', 'bold', 'italic', 'underline',
            'list', 'bullet', 'link'
          ]}
        />
      </div>
    );
  } catch (error) {
    console.error('ReactQuill error:', error);
    setHasError(true);
    return renderTextarea();
  }
  */
}