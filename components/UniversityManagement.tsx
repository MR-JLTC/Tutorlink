import React, { useState, useEffect, useCallback } from 'react';
import { University } from '../types';
import apiClient from '../services/api';
import Card from './ui/Card';
import Button from './ui/Button';
import Modal from './ui/Modal';
import { Edit, Plus } from 'lucide-react';

const UniversityManagement: React.FC = () => {
  const [universities, setUniversities] = useState<University[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUniversity, setCurrentUniversity] = useState<Partial<University> | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const fetchUniversities = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/universities');
      setUniversities(response.data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUniversities();
  }, [fetchUniversities]);

  const handleOpenModal = (university: Partial<University> | null = null) => {
    setCurrentUniversity(university ? { ...university } : { name: '', acronym: '', email_domain: '', status: 'active' });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentUniversity(null);
  };

  const handleSave = async () => {
    if (!currentUniversity || !currentUniversity.name || !(currentUniversity as any).email_domain) {
      alert('Please fill out all fields.');
      return;
    }
    setIsSaving(true);
    try {
      if (currentUniversity.university_id) {
        await apiClient.patch(`/universities/${currentUniversity.university_id}`, currentUniversity);
      } else {
        await apiClient.post('/universities', currentUniversity);
      }
      handleCloseModal();
      fetchUniversities();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this university? This cannot be undone.')) return;
    try {
      await apiClient.delete(`/universities/${id}`);
      fetchUniversities();
    } catch (err: any) {
      const apiMsg = err?.response?.data?.message;
      // alert(apiMsg || 'Cannot delete this university because it has existing courses/subjects. Please remove those first or set status to Inactive.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentUniversity((prev) => (prev ? { ...prev, [name]: value } : null));
  };

  const inputStyles = 'mt-1 block w-full px-3 py-2 rounded-md shadow-sm border border-slate-600 bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600';

  return (
    <>
      <Card>
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-slate-800">University Management</h1>
          <p className="text-slate-500 mt-1">Manage supported universities/schools used for email domain verification.</p>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex-1 flex gap-2">
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-600"
              placeholder="Search by name, acronym or domain..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="border border-slate-300 rounded-md px-3 py-2 focus:outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <Button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 h-10 px-4 shadow-sm"
            title="Add a new university"
          >
            <Plus className="h-4 w-4" />
            <span>Add University</span>
          </Button>
        </div>
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto bg-white text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="py-3 px-6 text-left font-semibold tracking-wide">Name</th>
                  <th className="py-3 px-6 text-left font-semibold tracking-wide">Acronym</th>
                  <th className="py-3 px-6 text-left font-semibold tracking-wide">Email Domain</th>
                  <th className="py-3 px-6 text-left font-semibold tracking-wide">Status</th>
                  <th className="py-3 px-6 text-center font-semibold tracking-wide w-48">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {universities
                  .filter((u) => {
                    const q = query.toLowerCase();
                    const statusOk = statusFilter === 'all' || u.status === statusFilter;
                    return (
                      statusOk && (
                        u.name.toLowerCase().includes(q) ||
                        ((u as any).acronym || '').toLowerCase().includes(q) ||
                        ((u as any).email_domain || '').toLowerCase().includes(q)
                      )
                    );
                  })
                  .map((uni) => (
                    <tr key={uni.university_id} className="hover:bg-slate-50 transition-colors odd:bg-white even:bg-slate-50/40">
                      <td className="py-4 px-6 font-medium text-slate-800">{uni.name}</td>
                      <td className="py-4 px-6">{(uni as any).acronym || '-'}</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-2">
                          <span className="text-slate-700">{(uni as any).email_domain}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${uni.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {uni.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="inline-flex items-center gap-2 justify-center">
                          <Button
                            variant="secondary"
                            className="h-8 px-3 py-1 text-xs font-medium"
                            onClick={() => handleOpenModal(uni)}
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="danger"
                            className="h-8 px-3 py-1 text-xs font-medium"
                            onClick={() => handleDelete(uni.university_id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {universities.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">No universities added yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={currentUniversity?.university_id ? 'Edit University' : 'Add University'}
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
          </>
        }
      >
        {currentUniversity && (
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-slate-700">University Name</label>
                <input type="text" name="name" id="name" value={currentUniversity.name || ''} onChange={handleChange} className={inputStyles} placeholder="e.g., De La Salle University" />
              </div>
              <div>
                <label htmlFor="acronym" className="block text-sm font-medium text-slate-700">Acronym</label>
                <input type="text" name="acronym" id="acronym" value={(currentUniversity as any).acronym || ''} onChange={handleChange} className={inputStyles} placeholder="e.g., DLSU" />
              </div>
              <div>
                <label htmlFor="email_domain" className="block text-sm font-medium text-slate-700">Email Domain</label>
                <input type="text" name="email_domain" id="email_domain" value={(currentUniversity as any).email_domain || ''} onChange={handleChange} className={inputStyles} placeholder="e.g., dlsu.edu.ph" />
                <p className="mt-1 text-xs text-slate-500">The domain used for student/tutor verification.</p>
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-slate-700">Status</label>
                <select name="status" id="status" value={currentUniversity.status} onChange={handleChange} className={inputStyles}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
};

export default UniversityManagement;
