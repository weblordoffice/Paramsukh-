'use client';

import { useMemo, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { X, Upload, Download, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';

type ImportMode = 'create_only' | 'update_existing' | 'upsert';

interface Issue {
  code: string;
  message: string;
}

interface PreviewRow {
  rowNumber: number;
  normalized: {
    displayName: string;
    phone: string;
    email: string;
    subscriptionPlan: string;
    subscriptionStatus: string;
    tags: string[];
    isActive: boolean;
  };
  errors: Issue[];
  warnings: Issue[];
  existingUserId: string | null;
  actionHint: 'create' | 'update' | null;
}

interface PreviewSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  ambiguousRows: number;
}

interface PreviewData {
  sessionId: string;
  checksum: string;
  recognizedHeaders: string[];
  summary: PreviewSummary;
  rows: PreviewRow[];
  expiresAt: string;
}

interface CommitSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

interface CommitRow {
  rowNumber: number;
  displayName: string;
  phone: string;
  email: string;
  subscriptionPlan: string;
  status: 'success' | 'failed' | 'skipped';
  action: string | null;
  userId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

interface CommitData {
  sessionId: string;
  importMode: ImportMode;
  summary: CommitSummary;
  rows: CommitRow[];
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ACCEPTED_FILE_TYPES = '.xlsx,.xls,.csv';

const escapeCsvCell = (value: unknown) => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [commitData, setCommitData] = useState<CommitData | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('upsert');
  const [isUploading, setIsUploading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'valid' | 'invalid'>('all');

  const validRowNumbers = useMemo(() => {
    if (!previewData) {
      return [];
    }

    return previewData.rows
      .filter((row) => row.errors.length === 0)
      .map((row) => row.rowNumber);
  }, [previewData]);

  const filteredRows = useMemo(() => {
    if (!previewData) {
      return [];
    }

    if (filter === 'valid') {
      return previewData.rows.filter((row) => row.errors.length === 0);
    }

    if (filter === 'invalid') {
      return previewData.rows.filter((row) => row.errors.length > 0);
    }

    return previewData.rows;
  }, [previewData, filter]);

  const failedCommitRows = useMemo(() => {
    if (!commitData) {
      return [];
    }

    return commitData.rows.filter((row) => row.status !== 'success');
  }, [commitData]);

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setPreviewData(null);
    setCommitData(null);
    setImportMode('upsert');
    setFilter('all');
    setIsUploading(false);
    setIsCommitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await apiClient.get('/api/user/import/template', {
        responseType: 'blob',
      });
      downloadBlob(response.data, 'user-import-template.csv');
      toast.success('Template downloaded');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to download template');
    }
  };

  const handlePreview = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post('/api/user/import/preview', formData);
      const data: PreviewData | undefined = response.data?.data;

      if (!data) {
        toast.error('Preview response is missing data');
        return;
      }

      setPreviewData(data);
      setStep('preview');
      toast.success('Preview generated');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to preview import file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCommit = async () => {
    if (!previewData) {
      toast.error('Preview data is missing');
      return;
    }

    if (validRowNumbers.length === 0) {
      toast.error('No valid rows available to import');
      return;
    }

    setIsCommitting(true);

    try {
      const response = await apiClient.post('/api/user/import/commit', {
        sessionId: previewData.sessionId,
        mode: importMode,
        selectedRowNumbers: validRowNumbers,
      });

      const data: CommitData | undefined = response.data?.data;
      if (!data) {
        toast.error('Commit response is missing data');
        return;
      }

      setCommitData(data);
      setStep('result');
      onSuccess();
      toast.success('Import completed');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to commit import');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDownloadFailedRows = () => {
    if (!failedCommitRows.length) {
      toast.error('No failed rows to export');
      return;
    }

    const header = ['rowNumber', 'displayName', 'phone', 'email', 'subscriptionPlan', 'status', 'action', 'errorCode', 'errorMessage'];
    const rows = failedCommitRows.map((row) => [
      row.rowNumber,
      row.displayName,
      row.phone,
      row.email,
      row.subscriptionPlan,
      row.status,
      row.action || '',
      row.errorCode || '',
      row.errorMessage || '',
    ]);

    const csvLines = [header, ...rows]
      .map((line) => line.map((value) => escapeCsvCell(value)).join(','))
      .join('\n');

    const blob = new Blob([csvLines], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'user-import-failed-rows.csv');
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-4 sm:p-6">
        <div className="bg-white rounded-2xl w-full max-w-6xl shadow-xl animate-in fade-in zoom-in duration-200 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Bulk User Import</h2>
              <p className="text-sm text-gray-500 mt-0.5">Upload spreadsheet, preview validation, then commit</p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-3 border-b bg-white shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <span className={`px-2 py-1 rounded ${step === 'upload' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>1. Upload</span>
              <span className="text-gray-400">→</span>
              <span className={`px-2 py-1 rounded ${step === 'preview' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>2. Preview</span>
              <span className="text-gray-400">→</span>
              <span className={`px-2 py-1 rounded ${step === 'result' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>3. Result</span>
            </div>
          </div>

          <div className="p-6 overflow-y-auto">
            {step === 'upload' && (
              <div className="space-y-5">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                  Required columns: <span className="font-semibold">displayName, phone, email</span>. Optional: subscriptionPlan, tags, isActive.
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gray-50">
                  <div className="flex items-center gap-3 mb-4">
                    <FileSpreadsheet className="w-6 h-6 text-gray-600" />
                    <p className="text-sm text-gray-700">Choose XLSX, XLS, or CSV file</p>
                  </div>

                  <input
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white hover:file:bg-primary-dark file:cursor-pointer"
                  />

                  {file && (
                    <p className="mt-3 text-sm text-gray-600">
                      Selected: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Template
                  </button>

                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={isUploading || !file}
                    className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {isUploading ? 'Uploading...' : 'Preview Import'}
                  </button>
                </div>
              </div>
            )}

            {step === 'preview' && previewData && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 rounded-lg bg-gray-50 border">
                    <p className="text-xs text-gray-500">Total Rows</p>
                    <p className="text-lg font-bold text-gray-900">{previewData.summary.totalRows}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-xs text-green-700">Valid</p>
                    <p className="text-lg font-bold text-green-800">{previewData.summary.validRows}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-xs text-red-700">Invalid</p>
                    <p className="text-lg font-bold text-red-800">{previewData.summary.invalidRows}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                    <p className="text-xs text-yellow-700">Duplicates</p>
                    <p className="text-lg font-bold text-yellow-800">{previewData.summary.duplicateRows}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <p className="text-xs text-orange-700">Ambiguous</p>
                    <p className="text-lg font-bold text-orange-800">{previewData.summary.ambiguousRows}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Import mode:</label>
                  <select
                    value={importMode}
                    onChange={(event) => setImportMode(event.target.value as ImportMode)}
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="upsert">Upsert (create + update)</option>
                    <option value="create_only">Create only</option>
                    <option value="update_existing">Update existing only</option>
                  </select>

                  <div className="ml-auto flex items-center gap-2">
                    <label className="text-sm text-gray-600">Rows:</label>
                    <select
                      value={filter}
                      onChange={(event) => setFilter(event.target.value as 'all' | 'valid' | 'invalid')}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="all">All</option>
                      <option value="valid">Valid only</option>
                      <option value="invalid">Invalid only</option>
                    </select>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden">
                  <div className="max-h-[420px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0 z-10 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-gray-700">Row</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-700">Name</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-700">Phone</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-700">Plan</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-700">Action</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-700">Issues</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row) => (
                          <tr key={row.rowNumber} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700">{row.rowNumber}</td>
                            <td className="px-3 py-2 text-gray-900 font-medium">{row.normalized.displayName || '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{row.normalized.phone || '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{row.normalized.subscriptionPlan || '-'}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.errors.length === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {row.errors.length === 0 ? (row.actionHint || 'valid') : 'invalid'}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {row.errors.length === 0 && row.warnings.length === 0 ? (
                                <span className="inline-flex items-center gap-1 text-green-700">
                                  <CheckCircle2 className="w-4 h-4" />
                                  OK
                                </span>
                              ) : (
                                <div className="space-y-1">
                                  {row.errors.map((issue) => (
                                    <div key={`${row.rowNumber}-${issue.code}`} className="inline-flex items-center gap-1 text-red-700 mr-2">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      <span className="text-xs">{issue.message}</span>
                                    </div>
                                  ))}
                                  {row.warnings.map((issue) => (
                                    <div key={`${row.rowNumber}-${issue.code}`} className="inline-flex items-center gap-1 text-yellow-700 mr-2">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      <span className="text-xs">{issue.message}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCommit}
                    disabled={isCommitting || validRowNumbers.length === 0}
                    className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {isCommitting ? 'Importing...' : `Import ${validRowNumbers.length} Valid Rows`}
                  </button>
                </div>
              </div>
            )}

            {step === 'result' && commitData && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-xs text-green-700">Created</p>
                    <p className="text-lg font-bold text-green-800">{commitData.summary.created}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-xs text-blue-700">Updated</p>
                    <p className="text-lg font-bold text-blue-800">{commitData.summary.updated}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                    <p className="text-xs text-yellow-700">Skipped</p>
                    <p className="text-lg font-bold text-yellow-800">{commitData.summary.skipped}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-xs text-red-700">Failed</p>
                    <p className="text-lg font-bold text-red-800">{commitData.summary.failed}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 border">
                    <p className="text-xs text-gray-500">Mode</p>
                    <p className="text-sm font-bold text-gray-900 uppercase">{commitData.importMode}</p>
                  </div>
                </div>

                {failedCommitRows.length > 0 ? (
                  <div className="border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700">Failed/Skipped Rows</h3>
                      <button
                        type="button"
                        onClick={handleDownloadFailedRows}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs hover:bg-gray-100 flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                      </button>
                    </div>
                    <div className="max-h-[320px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0 border-b">
                          <tr>
                            <th className="text-left px-3 py-2">Row</th>
                            <th className="text-left px-3 py-2">Name</th>
                            <th className="text-left px-3 py-2">Status</th>
                            <th className="text-left px-3 py-2">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {failedCommitRows.map((row) => (
                            <tr key={row.rowNumber} className="border-b">
                              <td className="px-3 py-2">{row.rowNumber}</td>
                              <td className="px-3 py-2">{row.displayName || '-'}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {row.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-700">{row.errorMessage || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
                    All rows imported successfully.
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetState();
                      setStep('upload');
                    }}
                    className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
                  >
                    Import Another File
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
