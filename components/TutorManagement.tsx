import React, { useEffect, useState } from 'react';
import apiClient from '../services/api';
import { Tutor } from '../types';
import Card from './ui/Card';
import Button from './ui/Button';
import Modal from './ui/Modal';
import { Check, X, FileText, User, Mail, School, Book } from 'lucide-react';

const TutorManagement: React.FC = () => {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{tutor.user?.name}</td>
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
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Application: ${selectedTutor.user?.name}`}
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
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Applicant Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <p className="flex items-center"><User className="mr-2 h-4 w-4 text-slate-500"/><strong>Name:</strong> <span className="ml-2">{selectedTutor.user?.name}</span></p>
                <p className="flex items-center"><Mail className="mr-2 h-4 w-4 text-slate-500"/><strong>Email:</strong> <span className="ml-2">{selectedTutor.user?.email}</span></p>
                <p className="flex items-center"><School className="mr-2 h-4 w-4 text-slate-500"/><strong>University:</strong> <span className="ml-2">{selectedTutor.user?.university?.name}</span></p>
                <p className="flex items-center"><Book className="mr-2 h-4 w-4 text-slate-500"/><strong>Course:</strong> <span className="ml-2">{selectedTutor.user?.course?.course_name}</span></p>
            </div>
            <div>
              <h4 className="font-semibold">Bio:</h4>
              <p className="text-gray-700 bg-gray-50 p-3 rounded-md mt-1">{selectedTutor.bio}</p>
            </div>
            <div>
              <h4 className="font-semibold">Submitted Documents:</h4>
              <ul className="mt-2 space-y-2">
                {selectedTutor.documents.map(doc => (
                  <li key={doc.document_id} className="flex items-center">
                     <FileText className="h-5 w-5 mr-2 text-primary-600"/>
                     <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                      {doc.file_name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default TutorManagement;
