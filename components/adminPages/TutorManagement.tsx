import React, { useEffect, useState } from 'react';
import apiClient from '../../services/api';
import { Tutor } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { Check, X, FileText, User, Mail, School, Book } from 'lucide-react';
import { getFileUrl } from '../../services/api';

const TutorManagement: React.FC = () => {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewType, setPreviewType] = useState<string>('');

  const fetchTutors = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/tutors/applications');
      setTutors(response.data);
    } catch (e) {
      setError('Failed to fetch tutor applications.');
      console.error(e);
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('Unable to load tutor applications. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTutors();
  }, []);
  
  const handleViewDetails = (tutor: Tutor) => {
    setSelectedTutor(tutor);
    setIsModalOpen(true);
  };

  const handleStatusUpdate = async (status: 'approved' | 'rejected') => {
    if (!selectedTutor) return;
    setIsUpdating(true);
    try {
      await apiClient.patch(`/tutors/${selectedTutor.tutor_id}/status`, { status });
      setIsModalOpen(false);
      // Refetch tutors to update the list
      await fetchTutors();
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify(`Application ${status === 'approved' ? 'approved' : 'rejected'} successfully.`, 'success');
    } catch (err) {
      console.error("Failed to update status", err);
      const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('Failed to update application status. Please try again.', 'error');
    } finally {
        setIsUpdating(false);
    }
  };

  const handleOpenDocument = (fileUrl: string, fileType?: string) => {
    const normalizedType = (fileType || '').toLowerCase();
    if (normalizedType.startsWith('image/') || normalizedType === 'application/pdf') {
      setPreviewUrl(fileUrl);
      setPreviewType(normalizedType);
      setIsPreviewOpen(true);
      return;
    }
    // Fallback: try extension-based handling
    const lower = fileUrl.toLowerCase();
    if (lower.endsWith('.pdf')) {
      setPreviewUrl(fileUrl);
      setPreviewType('application/pdf');
      setIsPreviewOpen(true);
      return;
    }
    if (/(\.png|\.jpg|\.jpeg|\.gif|\.webp)$/.test(lower)) {
      setPreviewUrl(fileUrl);
      setPreviewType('image/*');
      setIsPreviewOpen(true);
      return;
    }
    // As a last resort, open in new tab
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };


  if (loading) return <div>Loading applications...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-6">Tutor Application Management</h1>
      
      <Card>
        <h2 className="text-xl font-semibold mb-4">Pending Applications ({tutors.length})</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">University</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tutors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No pending applications found.</td>
                </tr>
              ) : (
                tutors.map((tutor) => (
                  <tr key={tutor.tutor_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        {(tutor as any).profile_image_url ? (
                          <img src={getFileUrl((tutor as any).profile_image_url)} alt="Tutor" className="h-8 w-8 rounded-full object-cover border" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-slate-200 border" />
                        )}
                        <span className="truncate max-w-[200px]">{tutor.user?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tutor.user?.university?.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tutor.user?.course?.course_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button onClick={() => handleViewDetails(tutor)}>View Details</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedTutor && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Application Details`}
          footer={
            <>
              <Button onClick={() => handleStatusUpdate('rejected')} variant="danger" disabled={isUpdating}>
                <X className="mr-2 h-4 w-4" /> {isUpdating ? 'Rejecting...' : 'Reject'}
              </Button>
              <Button onClick={() => handleStatusUpdate('approved')} variant="primary" disabled={isUpdating}>
                <Check className="mr-2 h-4 w-4" /> {isUpdating ? 'Approving...' : 'Approve'}
              </Button>
            </>
          }
        >
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-800">{selectedTutor.user?.name}</h3>
                <p className="text-sm text-slate-500">{selectedTutor.user?.email}</p>
              </div>
              <div className="text-right text-sm text-slate-600">
                <div className="font-medium">{selectedTutor.user?.university?.name || 'No university'}</div>
                <div className="mt-0.5">Course: {selectedTutor.user?.course?.course_name || 'No course'}</div>
              </div>
            </div>

            {/* Content grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {(selectedTutor as any).profile_image_url && (
                  <div>
                    <h4 className="font-semibold">Profile Image</h4>
                    <div className="mt-2">
                      <img src={getFileUrl((selectedTutor as any).profile_image_url)} alt="Tutor Profile" className="h-32 w-32 rounded-full object-cover border" />
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="font-semibold">Bio</h4>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-md mt-1 min-h-[72px]">{selectedTutor.bio || 'No bio provided.'}</p>
                </div>
                <div>
                  <h4 className="font-semibold">Expert Subjects</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedTutor.subjects?.length ? selectedTutor.subjects.map((ts) => (
                      <span key={(ts as any).tutor_subject_id} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{(ts as any).subject?.subject_name}</span>
                    )) : <span className="text-sm text-gray-500">No subjects submitted.</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold">Submitted Documents</h4>
                  <ul className="mt-2 space-y-2">
                    {selectedTutor.documents?.length ? selectedTutor.documents.map(doc => (
                      <li key={doc.document_id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                        <div className="flex items-center min-w-0">
                          <FileText className="h-5 w-5 mr-2 text-primary-600 flex-shrink-0"/>
                          <button
                            type="button"
                            onClick={() => handleOpenDocument(getFileUrl(doc.file_url), (doc as any).file_type)}
                            className="text-primary-600 hover:underline truncate text-left"
                            title="Open file"
                          >
                            {doc.file_name}
                          </button>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                          <button
                            type="button"
                            onClick={() => handleOpenDocument(getFileUrl(doc.file_url), (doc as any).file_type)}
                            className="text-sm text-slate-600 hover:text-slate-900"
                          >
                            Open
                          </button>
                          <a href={getFileUrl(doc.file_url)} download className="text-sm text-slate-600 hover:text-slate-900">Download</a>
                        </div>
                      </li>
                    )) : <li className="text-sm text-gray-500">No documents uploaded.</li>}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold">Availability</h4>
                  <ul className="mt-2 grid grid-cols-1 gap-2 text-sm">
                    {selectedTutor.availabilities?.length ? selectedTutor.availabilities.map((a) => (
                      <li key={(a as any).availability_id} className="flex justify-between bg-gray-50 p-2 rounded">
                        <span className="font-medium">{(a as any).day_of_week}</span>
                        <span className="text-gray-700">{(a as any).start_time} - {(a as any).end_time}</span>
                      </li>
                    )) : <li className="text-gray-500">No availability submitted.</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* File Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={previewType.startsWith('image/') ? 'Image Preview' : previewType === 'application/pdf' ? 'PDF Preview' : 'File Preview'}
        footer={
          <>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600">Open in new tab</a>
          </>
        }
      >
        <div className="w-full h-[70vh] bg-gray-100 rounded overflow-hidden flex items-center justify-center">
          {previewType === 'application/pdf' ? (
            <iframe title="PDF" src={previewUrl} className="w-full h-full" />
          ) : previewType.startsWith('image/') || previewType === 'image/*' ? (
            <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="text-sm text-slate-600 p-4 text-center">
              Preview not available. You can open the file in a new tab.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default TutorManagement;
