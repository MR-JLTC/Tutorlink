import React, { useState, useEffect, useCallback } from 'react';
import { University } from '../../types';
import apiClient, { getFileUrl } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { Edit, Plus } from 'lucide-react';

const UniversityManagement: React.FC = () => {
  const [universities, setUniversities] = useState<University[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUniversity, setCurrentUniversity] = useState<Partial<University> | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [logoFile, setLogoFile] = useState<File | null>(null);

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
    setLogoFile(null);
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
        const res = await apiClient.patch(`/universities/${currentUniversity.university_id}`, currentUniversity);
        if (logoFile) {
          const form = new FormData();
          form.append('file', logoFile);
          try {
            await apiClient.post(`/universities/${currentUniversity.university_id}/logo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
          } catch (e: any) {
            // Fallback path variant if proxy rewrites: /universities/logo/:id
            await apiClient.post(`/universities/logo/${currentUniversity.university_id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
          }
        }
      } else {
        const created = await apiClient.post('/universities', currentUniversity);
        const newId = created?.data?.university_id;
        if (newId && logoFile) {
          const form = new FormData();
          form.append('file', logoFile);
          try {
            await apiClient.post(`/universities/${newId}/logo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
          } catch (e: any) {
            await apiClient.post(`/universities/logo/${newId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
          }
        }
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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">University Management</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Manage supported universities/schools used for email domain verification.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex-1 flex flex-col sm:flex-row gap-2">
            <input
              className="w-full sm:flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              placeholder="Search by name, acronym or domain..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="w-full sm:w-auto border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none min-w-[120px]"
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
            className="inline-flex items-center justify-center gap-2 h-10 px-3 sm:px-4 shadow-sm text-sm sm:text-base w-full sm:w-auto"
            title="Add a new university"
          >
            <Plus className="h-4 w-4" />
            <span>Add University</span>
          </Button>
        </div>
        {isLoading ? (
          <p className="text-sm sm:text-base">Loading...</p>
        ) : (
          <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
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
                      <td className="py-4 px-6 font-medium text-slate-800">
                        <div className="flex items-center gap-3 min-w-0">
                          {((uni as any).logo_url) ? (
                            <img
                              src={getFileUrl((uni as any).logo_url)}
                              alt={(uni as any).acronym || uni.name}
                              className="h-8 w-8 rounded-full object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex-shrink-0" />
                          )}
                          <span className="truncate" title={uni.name}>{uni.name}</span>
                        </div>
                      </td>
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
                            className="h-8 px-3 py-0 text-xs font-medium flex items-center justify-center whitespace-nowrap"
                            onClick={() => handleOpenModal(uni)}
                          >
                            <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
                          </Button>

                          <Button
                            variant="danger"
                            className="h-8 px-3 py-0 text-xs font-medium flex items-center justify-center"
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
          
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
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
                <Card key={uni.university_id} className="p-4">
                  <div className="space-y-3">
                    {/* University Header */}
                    <div className="flex items-center gap-3">
                      {((uni as any).logo_url) ? (
                        <img
                          src={getFileUrl((uni as any).logo_url)}
                          alt={(uni as any).acronym || uni.name}
                          className="h-12 w-12 rounded-full object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-slate-100 border border-slate-200 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">{uni.name}</h3>
                        {(uni as any).acronym && (
                          <p className="text-sm text-slate-500">{(uni as any).acronym}</p>
                        )}
                      </div>
                    </div>

                    {/* University Details */}
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-slate-500 text-xs mb-1">Email Domain</p>
                        <p className="font-medium text-slate-900">{(uni as any).email_domain || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">Status</p>
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${uni.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {uni.status}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                      <Button
                        variant="secondary"
                        className="flex-1 text-sm h-9"
                        onClick={() => handleOpenModal(uni)}
                      >                                                           
                        {/* <Edit className="h-4 w-4 mr-1" /> */}
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        className="flex-1 text-sm h-9"
                        onClick={() => handleDelete(uni.university_id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            {universities.filter((u) => {
              const q = query.toLowerCase();
              const statusOk = statusFilter === 'all' || u.status === statusFilter;
              return (
                statusOk && (
                  u.name.toLowerCase().includes(q) ||
                  ((u as any).acronym || '').toLowerCase().includes(q) ||
                  ((u as any).email_domain || '').toLowerCase().includes(q)
                )
              );
            }).length === 0 && (
              <p className="text-center text-slate-500 py-6">No universities found.</p>
            )}
          </div>
          </>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Logo (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                  className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300"
                />
                {logoFile && <p className="text-xs text-slate-500 mt-1">Selected: {logoFile.name}</p>}
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
