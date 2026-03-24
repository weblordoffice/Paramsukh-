'use client';

import { useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, HelpCircle, X, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';

interface Question {
    _id?: string;
    questionText: string;
    type: 'mcq' | 'input';
    options: string[];
    correctAnswer: string;
    explanation?: string;
}

interface Assignment {
    _id: string;
    title: string;
    description?: string;
    questions: Question[];
    order: number;
    isStandalone: boolean;
}

interface AssignmentsTabProps {
    courseId: string;
    assignments: Assignment[];
    onUpdate: () => void;
}

export default function AssignmentsTab({ courseId, assignments, onUpdate }: AssignmentsTabProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        order: 0,
        questions: [] as Question[],
    });
    const [submitting, setSubmitting] = useState(false);
    const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null);

    const openModal = (assignment?: Assignment) => {
        if (assignment) {
            setEditingAssignment(assignment);
            setFormData({
                title: assignment.title,
                description: assignment.description || '',
                order: assignment.order,
                questions: assignment.questions || [],
            });
        } else {
            setEditingAssignment(null);
            setFormData({
                title: '',
                description: '',
                order: assignments.length,
                questions: [],
            });
        }
        setIsModalOpen(true);
    };

    const addQuestion = () => {
        setFormData(prev => ({
            ...prev,
            questions: [
                ...prev.questions,
                { questionText: '', type: 'mcq', options: ['', ''], correctAnswer: '', explanation: '' }
            ]
        }));
    };

    const updateQuestion = (index: number, field: keyof Question, value: any) => {
        const newQuestions = [...formData.questions];
        newQuestions[index] = { ...newQuestions[index], [field]: value };
        setFormData({ ...formData, questions: newQuestions });
    };

    const removeQuestion = (index: number) => {
        setFormData(prev => ({
            ...prev,
            questions: prev.questions.filter((_, i) => i !== index)
        }));
    };

    const addOption = (qIndex: number) => {
        const newQuestions = [...formData.questions];
        newQuestions[qIndex].options.push('');
        setFormData({ ...formData, questions: newQuestions });
    };

    const updateOption = (qIndex: number, oIndex: number, value: string) => {
        const newQuestions = [...formData.questions];
        newQuestions[qIndex].options[oIndex] = value;
        setFormData({ ...formData, questions: newQuestions });
    };

    const removeOption = (qIndex: number, oIndex: number) => {
        const newQuestions = [...formData.questions];
        newQuestions[qIndex].options = newQuestions[qIndex].options.filter((_, i) => i !== oIndex);
        setFormData({ ...formData, questions: newQuestions });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingAssignment) {
                await apiClient.put(`/courses/${courseId}/assignments/${editingAssignment._id}`, formData);
                toast.success('Assignment updated');
            } else {
                await apiClient.post(`/courses/${courseId}/assignments`, { ...formData, isStandalone: true });
                toast.success('Assignment added');
            }
            onUpdate();
            setIsModalOpen(false);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save assignment');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this assignment?')) return;
        try {
            await apiClient.delete(`/courses/${courseId}/assignments/${id}`);
            toast.success('Assignment deleted');
            onUpdate();
        } catch (error) {
            toast.error('Failed to delete assignment');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Course Assignments</h3>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus size={20} /> Add Assignment
                </button>
            </div>

            <div className="grid gap-4">
                {assignments.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl border-gray-200">
                        <HelpCircle className="mx-auto text-gray-400 mb-2" size={48} />
                        <p className="text-gray-500">No assignments added yet.</p>
                    </div>
                ) : (
                    assignments.sort((a, b) => a.order - b.order).map((assignment) => (
                        <div key={assignment._id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                                        <HelpCircle size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">{assignment.title}</h4>
                                        <p className="text-sm text-gray-500">{assignment.questions.length} Questions • Order: {assignment.order}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setExpandedAssignment(expandedAssignment === assignment._id ? null : assignment._id)}
                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    >
                                        {expandedAssignment === assignment._id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </button>
                                    <button
                                        onClick={() => openModal(assignment)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <Edit size={20} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(assignment._id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>

                            {expandedAssignment === assignment._id && (
                                <div className="px-4 pb-4 border-t pt-4 space-y-4 bg-gray-50">
                                    {assignment.questions.map((q, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded-lg border shadow-sm">
                                            <p className="font-medium text-gray-800">Q{idx + 1}: {q.questionText}</p>
                                            <p className="text-xs text-indigo-600 font-semibold mt-1 uppercase">{q.type}</p>
                                            {q.type === 'mcq' && (
                                                <ul className="mt-2 grid grid-cols-2 gap-2">
                                                    {q.options.map((opt, oIdx) => (
                                                        <li key={oIdx} className={`text-sm p-2 rounded border ${opt === q.correctAnswer ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 text-gray-600'}`}>
                                                            {opt} {opt === q.correctAnswer && "✓"}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            {q.type === 'input' && (
                                                <p className="text-sm mt-2 p-2 bg-green-50 border border-green-200 rounded text-green-700">
                                                    Correct: {q.correctAnswer}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-bold text-gray-900">
                                {editingAssignment ? 'Edit Assignment' : 'New Assignment'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Assignment Title</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Introduction Quiz"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Display Order</label>
                                    <input
                                        required
                                        type="number"
                                        className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={formData.order}
                                        onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Description</label>
                                <textarea
                                    className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-20"
                                    placeholder="Brief details about this assignment..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-lg font-bold text-gray-800">Questions</label>
                                    <button
                                        type="button"
                                        onClick={addQuestion}
                                        className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                                    >
                                        <Plus size={18} /> Add Question
                                    </button>
                                </div>

                                {formData.questions.map((q, qIdx) => (
                                    <div key={qIdx} className="p-5 border rounded-2xl bg-gray-50 space-y-4 relative group">
                                        <button
                                            type="button"
                                            onClick={() => removeQuestion(qIdx)}
                                            className="absolute top-4 right-4 text-gray-400 hover:text-red-500"
                                        >
                                            <X size={20} />
                                        </button>

                                        <div className="grid grid-cols-4 gap-4">
                                            <div className="col-span-3 space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Question {qIdx + 1}</label>
                                                <input
                                                    required
                                                    className="w-full p-3 border rounded-xl bg-white"
                                                    placeholder="Enter your question here..."
                                                    value={q.questionText}
                                                    onChange={(e) => updateQuestion(qIdx, 'questionText', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Type</label>
                                                <select
                                                    className="w-full p-3 border rounded-xl bg-white"
                                                    value={q.type}
                                                    onChange={(e) => updateQuestion(qIdx, 'type', e.target.value)}
                                                >
                                                    <option value="mcq">Multiple Choice</option>
                                                    <option value="input">Text Input</option>
                                                </select>
                                            </div>
                                        </div>

                                        {q.type === 'mcq' ? (
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Options & Correct Answer</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {q.options.map((opt, oIdx) => (
                                                        <div key={oIdx} className="flex gap-2">
                                                            <input
                                                                type="radio"
                                                                name={`correct-${qIdx}`}
                                                                checked={q.correctAnswer === opt && opt !== ''}
                                                                onChange={() => updateQuestion(qIdx, 'correctAnswer', opt)}
                                                                className="mt-4"
                                                            />
                                                            <div className="relative flex-1">
                                                                <input
                                                                    required
                                                                    className="w-full p-2 pr-8 border rounded-lg bg-white text-sm"
                                                                    placeholder={`Option ${oIdx + 1}`}
                                                                    value={opt}
                                                                    onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                                                                />
                                                                {q.options.length > 2 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeOption(qIdx, oIdx)}
                                                                        className="absolute right-2 top-2 text-gray-300 hover:text-red-400"
                                                                    >
                                                                        <X size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => addOption(qIdx)}
                                                        className="border-2 border-dashed rounded-lg py-2 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-all font-medium"
                                                    >
                                                        + Add Option
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Correct Answer</label>
                                                <input
                                                    required
                                                    className="w-full p-3 border rounded-xl bg-white"
                                                    placeholder="The exact answer students should input..."
                                                    value={q.correctAnswer}
                                                    onChange={(e) => updateQuestion(qIdx, 'correctAnswer', e.target.value)}
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Explanation (Optional)</label>
                                            <input
                                                className="w-full p-3 border rounded-xl bg-white"
                                                placeholder="Why is this the correct answer?"
                                                value={q.explanation}
                                                onChange={(e) => updateQuestion(qIdx, 'explanation', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ))}
                                
                                {formData.questions.length === 0 && (
                                    <div className="text-center py-8 bg-gray-50 border-2 border-dashed rounded-2xl">
                                        <p className="text-gray-400 mb-2">No questions added yet</p>
                                        <button type="button" onClick={addQuestion} className="text-indigo-600 font-bold">+ Create First Question</button>
                                    </div>
                                )}
                            </div>
                        </form>

                        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2 rounded-xl border font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={submitting}
                                onClick={handleSubmit}
                                className="px-10 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                {submitting ? 'Saving...' : editingAssignment ? 'Update Assignment' : 'Save Assignment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
