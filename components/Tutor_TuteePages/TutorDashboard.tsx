import React, { useEffect, useMemo, useState } from 'react';
import apiClient, { getFileUrl } from '../../services/api';
import Button from '../ui/Button';

type DayAvailability = { available: boolean; startTime: string; endTime: string };
const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TutorDashboard: React.FC = () => {
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [bio, setBio] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<{ subject_id: number; subject_name: string }[]>([]);
  const [subjectToAdd, setSubjectToAdd] = useState('');
  const [otherSubject, setOtherSubject] = useState('');
  const [documents, setDocuments] = useState<File[]>([]);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>(
    daysOfWeek.reduce((acc, day) => {
      (acc as any)[day] = { available: false, startTime: '09:00', endTime: '17:00' };
      return acc;
    }, {} as Record<string, DayAvailability>)
  );

  useEffect(() => {
    // Try to extract tutorId previously stored after application
    const stored = localStorage.getItem('tutor_id');
    if (stored) setTutorId(Number(stored));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/subjects');
        setAvailableSubjects(res.data);
      } catch (e) {}
    })();
  }, []);

  const normalizedSelected = useMemo(
    () => new Set(subjects.map((s) => s.toLowerCase())),
    [subjects]
  );

  const addSelectedSubject = () => {
    if (subjectToAdd && !normalizedSelected.has(subjectToAdd.toLowerCase())) {
      setSubjects((prev) => [...prev, subjectToAdd]);
      setSubjectToAdd('');
    }
  };

  const addOtherSubject = () => {
    const trimmed = otherSubject.trim();
    if (trimmed && !normalizedSelected.has(trimmed.toLowerCase())) {
      setSubjects((prev) => [...prev, trimmed]);
      setOtherSubject('');
    }
  };

  const removeSubject = (name: string) => {
    setSubjects((prev) => prev.filter((s) => s !== name));
  };

  const handleDocsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setDocuments(Array.from(e.target.files));
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setProfileImage(f);
  };

  const toggleAvailability = (day: string) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...prev[day], available: !prev[day].available },
    }));
  };

  const setTime = (day: string, key: 'startTime' | 'endTime', val: string) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...prev[day], [key]: val },
    }));
  };

  const saveProfile = async () => {
    if (!tutorId) {
      const notify = (window as any).__notify as ((m: string, t?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('Tutor not found. Please complete application first.', 'error');
      return;
    }
    try {
      if (profileImage) {
        const pf = new FormData();
        pf.append('file', profileImage);
        await apiClient.post(`/tutors/${tutorId}/profile-image`, pf, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      // Documents
      if (documents.length > 0) {
        const form = new FormData();
        documents.forEach((f) => form.append('files', f));
        await apiClient.post(`/tutors/${tutorId}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      // Subjects
      if (subjects.length > 0) {
        await apiClient.post(`/tutors/${tutorId}/subjects`, { subjects });
      }
      const notify = (window as any).__notify as ((m: string, t?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('Profile updated.', 'success');
    } catch (e) {
      const notify = (window as any).__notify as ((m: string, t?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('Failed to update profile.', 'error');
    }
  };

  const saveAvailability = async () => {
    if (!tutorId) return;
    const slots = Object.entries(availability)
      .filter(([, d]) => (d as any).available)
      .map(([day, d]) => ({ day_of_week: day, start_time: (d as any).startTime, end_time: (d as any).endTime }));
    try {
      await apiClient.post(`/tutors/${tutorId}/availability`, { slots });
      const notify = (window as any).__notify as ((m: string, t?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('Availability saved.', 'success');
    } catch (e) {
      const notify = (window as any).__notify as ((m: string, t?: 'success' | 'error' | 'info') => void) | undefined;
      if (notify) notify('Failed to save availability.', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-slate-800 mb-6">TutorDashboard</h1>

      <div className="space-y-8">
        <section className="bg-white rounded-lg shadow p-6 border">
          <h2 className="text-xl font-semibold mb-4">TutorApplication & Verification</h2>
          <p className="text-sm text-slate-600 mb-4">Upload proof documents and select your subjects of expertise. Your application may require admin approval.</p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Subjects of Expertise</label>
            <div className="flex items-center gap-2 mb-2">
              <select
                className="flex-grow border border-slate-300 rounded px-3 py-2"
                value={subjectToAdd}
                onChange={(e) => setSubjectToAdd(e.target.value)}
              >
                <option value="">Select a subject...</option>
                {availableSubjects.filter((s) => !normalizedSelected.has(s.subject_name.toLowerCase())).map((s) => (
                  <option key={s.subject_id} value={s.subject_name}>{s.subject_name}</option>
                ))}
              </select>
              <Button onClick={addSelectedSubject} disabled={!subjectToAdd}>Add</Button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input className="flex-grow border border-slate-300 rounded px-3 py-2" placeholder="Not in the list? Type a subject" value={otherSubject} onChange={(e) => setOtherSubject(e.target.value)} />
              <Button variant="secondary" onClick={addOtherSubject} disabled={!otherSubject.trim()}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <span key={s} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs flex items-center gap-2">
                  {s}
                  <button type="button" onClick={() => removeSubject(s)} className="text-blue-700">×</button>
                </span>
              ))}
              {subjects.length === 0 && <span className="text-sm text-slate-500">No subjects selected.</span>}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Proof Documents (PDF, PNG, JPG, JPEG)</label>
            <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => handleDocsChange(e)} className="border border-slate-300 rounded px-3 py-2 w-full" />
            {documents.length > 0 && (
              <ul className="list-disc list-inside text-sm text-slate-600 mt-2">
                {documents.map((f, i) => <li key={i}>{f.name}</li>)}
              </ul>
            )}
          </div>

          <Button onClick={saveProfile}>Submit / Update</Button>
        </section>

        <section className="bg-white rounded-lg shadow p-6 border">
          <h2 className="text-xl font-semibold mb-4">TutorProfile Setup</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={5} className="w-full border border-slate-300 rounded px-3 py-2" placeholder="Describe your experience and specialties" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Profile Photo</label>
              <input type="file" accept="image/*" onChange={handleProfileChange} className="w-full border border-slate-300 rounded px-3 py-2" />
              {profileImage && <p className="text-xs text-slate-500 mt-1">Selected: {profileImage.name}</p>}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">GCash details and ratings display require backend endpoints; will appear when available.</p>
        </section>

        <section className="bg-white rounded-lg shadow p-6 border">
          <h2 className="text-xl font-semibold mb-4">TutorAvailability Scheduling</h2>
          <div className="space-y-3">
            {daysOfWeek.map((day) => (
              <div key={day} className={`grid grid-cols-1 md:grid-cols-3 items-center gap-4 p-3 border rounded ${availability[day].available ? 'bg-white' : 'bg-slate-50'}`}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={availability[day].available} onChange={() => toggleAvailability(day)} />
                  <span className="font-medium text-slate-800">{day}</span>
                </label>
                <div className={`flex items-center gap-2 md:col-span-2 ${!availability[day].available ? 'opacity-50 pointer-events-none' : ''}`}>
                  <input type="time" value={availability[day].startTime} onChange={(e) => setTime(day, 'startTime', e.target.value)} className="border rounded px-2 py-1" />
                  <span className="text-slate-500">-</span>
                  <input type="time" value={availability[day].endTime} onChange={(e) => setTime(day, 'endTime', e.target.value)} className="border rounded px-2 py-1" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Button onClick={saveAvailability}>Save Availability</Button>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6 border">
          <h2 className="text-xl font-semibold mb-4">TutorSession Handling</h2>
          <p className="text-sm text-slate-600">Booking, accept/decline, and payment proof review endpoints are pending in the backend. This section will display requests and actions once available.</p>
        </section>

        <section className="bg-white rounded-lg shadow p-6 border">
          <h2 className="text-xl font-semibold mb-4">TutorEarnings & History</h2>
          <p className="text-sm text-slate-600">Payments summary and completed sessions will appear here once tutor-scoped endpoints are exposed.</p>
        </section>
      </div>
    </div>
  );
};

export default TutorDashboard;


