import React, { useState, useMemo } from 'react';
import { Page } from '../../types';
import { SUBJECTS } from '../../constants';
import { CheckCircleIcon } from '../../components/icons/CheckCircleIcon';
import { DocumentArrowUpIcon } from '../../components/icons/DocumentArrowUpIcon';

interface TutorRegistrationPageProps {
  onNavigate: (page: Page) => void;
}

interface DayAvailability {
  available: boolean;
  startTime: string;
  endTime: string;
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TutorRegistrationPage: React.FC<TutorRegistrationPageProps> = ({ onNavigate }) => {
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [subjectToAdd, setSubjectToAdd] = useState('');
  const [otherSubject, setOtherSubject] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>(
    daysOfWeek.reduce((acc, day) => {
      acc[day] = { available: false, startTime: '09:00', endTime: '17:00' };
      return acc;
    }, {} as Record<string, DayAvailability>)
  );

  const availableSubjects = useMemo(() => 
    SUBJECTS.filter(s => !selectedSubjects.has(s)),
    [selectedSubjects]
  );

  const handleAddSubject = () => {
    if (subjectToAdd && !selectedSubjects.has(subjectToAdd)) {
        setSelectedSubjects(prev => new Set(prev).add(subjectToAdd));
        setSubjectToAdd('');
    }
  };

  const handleAddOtherSubject = () => {
    const trimmedSubject = otherSubject.trim();
    if (trimmedSubject && !selectedSubjects.has(trimmedSubject)) {
        setSelectedSubjects(prev => new Set(prev).add(trimmedSubject));
        setOtherSubject('');
    }
  };

  const handleRemoveSubject = (subjectToRemove: string) => {
    setSelectedSubjects(prev => {
        const newSubjects = new Set(prev);
        newSubjects.delete(subjectToRemove);
        return newSubjects;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleAvailabilityToggle = (day: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: { ...prev[day], available: !prev[day].available }
    }));
  };

  const handleTimeChange = (day: string, type: 'startTime' | 'endTime', value: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: { ...prev[day], [type]: value }
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSubjects.size > 0 && uploadedFiles.length > 0) {
      const finalAvailability = Object.entries(availability)
        .filter(([, details]) => details.available)
        .reduce((acc, [day, details]) => {
          acc[day] = { startTime: details.startTime, endTime: details.endTime };
          return acc;
        }, {} as Record<string, { startTime: string; endTime: string }>);

      console.log('Tutor Application Data:', {
        subjects: Array.from(selectedSubjects),
        files: uploadedFiles.map(f => f.name),
        availability: finalAvailability,
      });
      setIsSubmitted(true);
    } else {
        alert('Please select at least one subject and upload at least one document.');
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-[calc(100vh-68px)] flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full text-center bg-white p-10 rounded-xl shadow-lg">
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-3xl font-bold text-slate-800 mt-4">Application Submitted!</h2>
          <p className="text-slate-600 mt-2">
            Thank you for your application. Our team will review your documents and you will be notified via email once your account is approved.
          </p>
          <button
            onClick={() => onNavigate(Page.Landing)}
            className="mt-8 w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-68px)] flex flex-col items-center justify-center bg-gradient-to-br from-indigo-200 to-sky-100 p-4">
      <div className="max-w-3xl w-full bg-white/80 backdrop-blur-lg p-8 rounded-2xl shadow-xl border border-white/50">
        <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Tutor Application</h1>
            <p className="text-slate-600 mb-6">Share your expertise and start earning.</p>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Subjects of Expertise */}
          <div>
            <h2 className="block text-slate-700 font-semibold mb-2 text-lg">1. Subjects of Expertise</h2>
            <div className="flex flex-wrap gap-2 mb-4 min-h-[2.5rem] items-center">
              {Array.from(selectedSubjects).map(subject => (
                <div key={subject} className="flex items-center bg-indigo-100 text-indigo-800 text-sm font-medium pl-3 pr-2 py-1 rounded-full">
                  {subject}
                  <button
                    type="button"
                    onClick={() => handleRemoveSubject(subject)}
                    className="ml-2 flex-shrink-0 bg-indigo-200 hover:bg-indigo-300 text-indigo-800 rounded-full p-0.5"
                    aria-label={`Remove ${subject}`}
                  >
                    <svg className="h-3 w-3" stroke="currentColor" fill="none" viewBox="0 0 8 8"><path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" /></svg>
                  </button>
                </div>
              ))}
              {selectedSubjects.size === 0 && (
                <p className="text-sm text-slate-500">No subjects selected yet.</p>
              )}
            </div>
            
            <div className="flex items-center gap-2 mb-4">
              <select
                value={subjectToAdd}
                onChange={(e) => setSubjectToAdd(e.target.value)}
                className="flex-grow w-full px-4 py-2 border border-slate-600 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-label="Select a subject to add"
              >
                <option value="">Select a subject...</option>
                {availableSubjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
              </select>
              <button
                type="button"
                onClick={handleAddSubject}
                disabled={!subjectToAdd}
                className="bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-600 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>

            <div>
              <label htmlFor="other-subject" className="block text-slate-600 text-sm mb-1">Not in the list? Add another subject (optional):</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  id="other-subject"
                  value={otherSubject}
                  onChange={(e) => setOtherSubject(e.target.value)}
                  placeholder="e.g., Astrophysics"
                  className="flex-grow w-full px-4 py-2 border border-slate-600 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={handleAddOtherSubject}
                  disabled={!otherSubject.trim()}
                  className="bg-slate-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </div>
          </div>


           {/* Availability Scheduling */}
          <div className="mt-8">
            <h2 className="block text-slate-700 font-semibold mb-2 text-lg">2. Weekly Availability</h2>
            <div className="space-y-3">
              {daysOfWeek.map(day => (
                <div key={day} className={`grid grid-cols-1 md:grid-cols-3 items-center gap-4 p-3 border rounded-lg transition-all ${availability[day].available ? 'bg-white' : 'bg-slate-50'}`}>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
                      checked={availability[day].available}
                      onChange={() => handleAvailabilityToggle(day)}
                    />
                    <span className="font-medium text-slate-800 w-24">{day}</span>
                  </label>
                  <div className={`flex items-center gap-2 md:col-span-2 ${!availability[day].available ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input
                      type="time"
                      aria-label={`${day} start time`}
                      value={availability[day].startTime}
                      onChange={(e) => handleTimeChange(day, 'startTime', e.target.value)}
                      disabled={!availability[day].available}
                      className="w-full px-2 py-1 border border-slate-600 bg-slate-700 text-white rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      style={{ colorScheme: 'dark' }}
                    />
                    <span className="text-slate-500">-</span>
                    <input
                      type="time"
                      aria-label={`${day} end time`}
                      value={availability[day].endTime}
                      onChange={(e) => handleTimeChange(day, 'endTime', e.target.value)}
                      disabled={!availability[day].available}
                      className="w-full px-2 py-1 border border-slate-600 bg-slate-700 text-white rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Document Upload */}
          <div className="mt-8">
            <h2 className="block text-slate-700 font-semibold mb-2 text-lg">3. Proof Documents</h2>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-slate-400" />
                <div className="flex text-sm text-slate-600">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                    <span>Upload your files</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-slate-500">PDF, PNG, JPG, JPEG up to 10MB</p>
              </div>
            </div>
            {uploadedFiles.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-slate-700">Selected files:</h4>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-slate-600">
                  {uploadedFiles.map((file, index) => <li key={index}>{file.name}</li>)}
                </ul>
              </div>
            )}
          </div>
          
          <button type="submit" className="mt-8 w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-400">
            Submit Application
          </button>
        </form>
      </div>
    </div>
  );
};

export default TutorRegistrationPage;