import React, { useEffect, useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import apiClient, { getFileUrl } from '../../services/api';
import Modal from '../ui/Modal';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface BookingFormData {
  subject: string;
  date: string;
  time: string;
  duration: number;
  student_notes?: string;
}

type TutorListItem = {
  user_id: number;
  name: string;
  email: string;
  profile_image_url?: string | null;
  university_name?: string | null;
  role?: string;
  created_at?: string;
  tutor_profile?: { 
    tutor_id: number; 
    status?: string;
    rating?: number;
    total_reviews?: number;
  } | null;
};

const TuteeFindAndBookTutors: React.FC = () => {
  const [tutors, setTutors] = useState<TutorListItem[]>([]);
  // searchQuery is the committed query applied to filter results
  const [searchQuery, setSearchQuery] = useState('');
  // searchDraft is the live input value; pressing Enter commits it to searchQuery
  const [searchDraft, setSearchDraft] = useState('');

  // Apply a debounced live-search: when the user types, apply the draft after a short delay
  // This preserves Enter-to-commit while still showing live results during typing.
  useEffect(() => {
    const id = setTimeout(() => {
      // only update if different to avoid extra renders
      const q = (searchDraft || '').trim();
      if (q !== searchQuery) setSearchQuery(q);
    }, 350);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);
  const [filterOption, setFilterOption] = useState<'all' | 'has_subjects' | 'top_rated' | 'with_reviews' | 'newest'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTutorProfile, setSelectedTutorProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    const fetchTutors = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/users');
        // backend maps tutor role to 'tutor' and student to 'student'
        const all: TutorListItem[] = res.data || [];
        // Only show users that are tutors and have been approved
        const tutorsOnly = all.filter(u => u.tutor_profile && (u.tutor_profile.status || '').toLowerCase() === 'approved');
        // Sort by rating (higher first) and then by creation date if ratings are equal
        const sortedTutors = tutorsOnly.sort((a, b) => {
          const ratingA = a.tutor_profile?.rating || 0;
          const ratingB = b.tutor_profile?.rating || 0;
          if (ratingB !== ratingA) {
            return ratingB - ratingA;
          }
          // If ratings are equal, sort by creation date (oldest first)
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateA - dateB;
        });
        // Enrich each tutor with their public profile (which contains subjects)
        try {
          const enriched = await Promise.all(sortedTutors.map(async (u) => {
            const tutorId = (u as any).tutor_profile?.tutor_id;
            if (!tutorId) return u;
            try {
              const profileRes = await apiClient.get(`/tutors/${tutorId}/profile`);
              return { ...u, profile: profileRes.data };
            } catch (err) {
              // If profile fetch fails, return the original item without profile
              console.warn('Failed to fetch tutor profile for', tutorId, err);
              return u;
            }
          }));
          setTutors(enriched as TutorListItem[]);
        } catch (err) {
          // If enrichment fails for any reason, fall back to the basic list
          console.warn('Failed to enrich tutors with profile data', err);
          setTutors(sortedTutors);
        }
      } catch (err) {
        console.error('Failed to fetch tutors', err);
        setError('Failed to load tutors. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchTutors();
  }, []);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [bookingForm, setBookingForm] = useState<{ subject: string; date: string; time: string; duration: number; student_notes?: string }>({ subject: '', date: '', time: '', duration: 1 });
  const [bookingErrors, setBookingErrors] = useState<{ subject?: string; date?: string; time?: string; duration?: string; student_notes?: string }>({});
  // Controls whether the booking input fields are visible inside the profile modal
  const [showBookingForm, setShowBookingForm] = useState(false);

  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [myBookingsLoading, setMyBookingsLoading] = useState(false);
  const [myBookingsError, setMyBookingsError] = useState<string | null>(null);
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [bookingErrorModalOpen, setBookingErrorModalOpen] = useState(false);
  const [bookingErrorModalMessage, setBookingErrorModalMessage] = useState<string | null>(null);

  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [allowedDurations, setAllowedDurations] = useState<number[]>([]);

  // Add useEffect for managing available time slots
  useEffect(() => {
    if (bookingForm.date && selectedTutorProfile?.availability) {
      const date = new Date(bookingForm.date);
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      const dayAvailability = selectedTutorProfile.availability.find(
        (a: any) => a.day_of_week.toLowerCase() === dayOfWeek.toLowerCase()
      );
      
      if (dayAvailability) {
        const slots = generateTimeSlots(dayAvailability.start_time, dayAvailability.end_time);
        setAvailableTimeSlots(slots);
        // Clear time if not in available slots
        if (bookingForm.time && !slots.includes(bookingForm.time)) {
          setBookingForm(prev => ({ ...prev, time: '' }));
        }
      } else {
        setAvailableTimeSlots([]);
        setBookingForm(prev => ({ ...prev, time: '' }));
      }
    }
  }, [bookingForm.date, selectedTutorProfile?.availability]);

  // Recompute allowed durations whenever the selected time or date or availability changes
  useEffect(() => {
    const computeAllowedDurations = () => {
      setAllowedDurations([]);
      if (!selectedTutorProfile?.availability || !bookingForm.date) return;

      const date = new Date(bookingForm.date);
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      const dayAvailability = selectedTutorProfile.availability.find(
        (a: any) => a.day_of_week.toLowerCase() === dayOfWeek.toLowerCase()
      );
      if (!dayAvailability) return;

      // If time is selected, compute remaining minutes from that time to end_time
      // Otherwise, compute total window length
      const windowStart = new Date(`1970-01-01T${dayAvailability.start_time}`);
      const windowEnd = new Date(`1970-01-01T${dayAvailability.end_time}`);
      if (isNaN(windowStart.getTime()) || isNaN(windowEnd.getTime()) || windowEnd <= windowStart) return;

      let maxMinutes = (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60);

      if (bookingForm.time) {
        const selected = new Date(`1970-01-01T${bookingForm.time}`);
        if (isNaN(selected.getTime())) return;
        // If selected time is before window start, treat selected as window start
        const effectiveStart = selected < windowStart ? windowStart : selected;
        maxMinutes = (windowEnd.getTime() - effectiveStart.getTime()) / (1000 * 60);
      }

      // Allowed durations: 1, 1.5, and whole numbers 2..8 (in hours), but only those that fit in maxMinutes
      const candidates: number[] = [];
      const maxHours = Math.floor(maxMinutes / 60);
      if (maxMinutes >= 60) candidates.push(1);
      if (maxMinutes >= 90) candidates.push(1.5);
      for (let h = 2; h <= Math.min(8, maxHours); h++) {
        if (maxMinutes >= h * 60) candidates.push(h);
      }

      setAllowedDurations(candidates);

      // If current duration is not allowed, set to first allowed option
      if (candidates.length > 0) {
        if (!candidates.includes(bookingForm.duration)) {
          setBookingForm(prev => ({ ...prev, duration: candidates[0] }));
        }
      } else {
        // No allowed durations — clear duration
        setBookingForm(prev => ({ ...prev, duration: 0 }));
      }
    };

    computeAllowedDurations();
  }, [bookingForm.time, bookingForm.date, selectedTutorProfile?.availability]);

  // When the booking form is shown, proactively mark required fields as errors so
  // the user sees which fields need input even before pressing Submit.
  useEffect(() => {
    if (!showBookingForm) return;
    const errs: any = {};
    if (!bookingForm.subject) errs.subject = 'Subject is required';
    if (!bookingForm.date) errs.date = 'Date is required';
    if (!bookingForm.time) errs.time = 'Time is required';
    // For duration, only show an error if a duration has been selected but it
    // doesn't fit within allowed durations. Do not proactively show 'required' here.
    if (bookingForm.duration && bookingForm.duration > 0 && allowedDurations.length > 0 && !allowedDurations.includes(bookingForm.duration)) {
      errs.duration = 'Selected duration does not fit within the tutor\'s availability for the chosen date/time';
    }

    setBookingErrors(prev => ({ ...prev, ...errs }));
  // Only run when the form is revealed or when availability-derived allowedDurations change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBookingForm, allowedDurations]);

  // Keep the duration error in sync: if the user selects a duration that exceeds availability
  // add the error; otherwise remove it.
  useEffect(() => {
    if (!showBookingForm) return;
    setBookingErrors(prev => {
      const p = { ...prev } as any;
      if (bookingForm.duration && bookingForm.duration > 0) {
        if (allowedDurations.length > 0 && !allowedDurations.includes(bookingForm.duration)) {
          p.duration = 'Selected duration does not fit within the tutor\'s availability for the chosen date/time';
        } else {
          delete p.duration;
        }
      } else {
        // If no duration selected, don't show a duration error here (we avoid proactive required)
        delete p.duration;
      }
      return p;
    });
  }, [bookingForm.duration, allowedDurations, showBookingForm]);

  const generateTimeSlots = (startTime: string, endTime: string): string[] => {
    const slots: string[] = [];
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    
    // Validate input times
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error('Invalid time format:', { startTime, endTime });
      return slots;
    }

    // Ensure end time is after start time
    if (end <= start) {
      console.error('End time must be after start time:', { startTime, endTime });
      return slots;
    }

    // Get current time for same-day validation
    const now = new Date();
    const isToday = bookingForm.date === now.toISOString().split('T')[0];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    try {
      while (start <= end) {
        const timeStr = start.toTimeString().substring(0, 5);
        
        // For today's slots, only include future times (with 30 min buffer)
        if (!isToday || (
          start.getHours() * 60 + start.getMinutes() > currentMinutes + 30
        )) {
          slots.push(timeStr);
        }
        
        start.setMinutes(start.getMinutes() + 30); // 30-minute intervals
      }
    } catch (error) {
      console.error('Error generating time slots:', error);
    }
    
    return slots;
  };

  // Given a weekday name like 'Monday', return the next calendar date (YYYY-MM-DD)
  const nextDateForWeekday = (weekdayName: string, fromDate = new Date()): string => {
    const names = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const target = names.indexOf(String(weekdayName).toLowerCase());
    if (target === -1) return '';
    const fd = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const current = fd.getDay();
    let delta = target - current;
    if (delta <= 0) delta += 7; // next occurrence (not today)
    const result = new Date(fd.getTime() + delta * 24 * 60 * 60 * 1000);
    return result.toISOString().split('T')[0];
  };

  // Filter and search tutors client-side by name or subject
  const filteredTutors = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    let list = tutors.slice();

    if (q) {
      list = list.filter(t => {
        const name = (t.name || '').toLowerCase();
        if (name.includes(q)) return true;
        // check subjects if profile is available on this list item
        const subjects: string[] = (t as any).profile?.subjects || (t as any).tutor_profile?.subjects || [];
        if (Array.isArray(subjects)) {
          for (const s of subjects) {
            if (String(s).toLowerCase().includes(q)) return true;
          }
        }
        return false;
      });
    }

    // Apply filter option
    if (filterOption === 'has_subjects') {
      list = list.filter(t => {
        const subjects: string[] = (t as any).profile?.subjects || (t as any).tutor_profile?.subjects || [];
        return Array.isArray(subjects) && subjects.length > 0;
      });
    } else if (filterOption === 'top_rated') {
      list = list.sort((a, b) => (b.tutor_profile?.rating || 0) - (a.tutor_profile?.rating || 0));
    } else if (filterOption === 'with_reviews') {
      list = list.filter(t => (t.tutor_profile?.total_reviews || 0) > 0).sort((a, b) => (b.tutor_profile?.rating || 0) - (a.tutor_profile?.rating || 0));
    } else if (filterOption === 'newest') {
      list = list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }

    return list;
  }, [tutors, searchQuery, filterOption]);

  const handleBook = () => {
    const isValid = validateBookingForm();
    if (isValid) {
      setConfirmationOpen(true);
    }
  };

  const handleCancelBooking = () => {
    setCancelConfirmationOpen(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedTutorProfile?.user?.tutor_profile) {
      console.error('handleConfirmBooking: No tutor profile found');
      toast.error('Tutor profile not found. Please try again.');
      return;
    }
    
    setBookingLoading(true);
    try {
      const tutorId = selectedTutorProfile.user.tutor_profile.tutor_id;
      console.log('Creating booking request:', {
        tutorId,
        bookingForm,
        tutorName: selectedTutorProfile.user.name
      });
      
      const response = await apiClient.post(`/tutors/${tutorId}/booking-requests`, bookingForm);
      
      console.log('Booking request response:', response.data);
      
      // Show success toast at center
      toast.success('Booking request submitted successfully!', {
        position: 'top-center',
        autoClose: 3000,
      });
      
      // Close modals after a brief delay to show toast
      setTimeout(() => {
        setIsProfileOpen(false);
        setConfirmationOpen(false);
        setBookingForm({
          subject: '',
          date: '',
          time: '',
          duration: 1,
          student_notes: ''
        });
      }, 100);
    } catch (err: any) {
      console.error('Booking request failed:', {
        error: err,
        response: err?.response,
        data: err?.response?.data,
        status: err?.response?.status,
        message: err?.message
      });
      
      const serverMsg = err?.response?.data?.message || err?.message || 'Failed to send booking request. Please try again later.';
      setBookingErrorModalMessage(serverMsg);
      setBookingErrorModalOpen(true);
      toast.error(serverMsg, {
        position: 'top-center',
      });
    } finally {
      setBookingLoading(false);
    }
  };

  const openProfile = async (tutorUser: TutorListItem) => {
    if (!tutorUser.tutor_profile) return;
    setProfileLoading(true);
    setIsProfileOpen(true);
    try {
      const tutorId = tutorUser.tutor_profile.tutor_id;
      const [profileRes, availRes] = await Promise.all([
        apiClient.get(`/tutors/${tutorId}/profile`),
        apiClient.get(`/tutors/${tutorId}/availability`),
      ]);
      setSelectedTutorProfile({
        user: tutorUser,
        profile: profileRes.data,
        availability: availRes.data,
      });
    } catch (err) {
      console.error('Failed to load tutor profile', err);
      setSelectedTutorProfile({ user: tutorUser, profile: null, availability: [] });
    } finally {
      setProfileLoading(false);
    }
  };

  const validateBookingForm = () => {
    const errors: any = {};
    
    // Subject validation — must be one of the tutor's approved subjects
    const tutorSubjects: string[] = (selectedTutorProfile?.profile?.subjects || []).map((s: any) => String(s).trim());
    if (!bookingForm.subject) {
      errors.subject = 'Subject is required';
    } else if (!tutorSubjects.includes(String(bookingForm.subject).trim())) {
      errors.subject = 'Please select a subject from the tutor\'s approved subjects';
    }

    // Date validation
    if (!bookingForm.date) {
      errors.date = 'Date is required';
    } else {
      const selectedDate = new Date(bookingForm.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (isNaN(selectedDate.getTime())) {
        errors.date = 'Invalid date format';
      } else if (selectedDate < today) {
        errors.date = 'Cannot book sessions in the past';
      } else if (selectedDate > new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)) {
        errors.date = 'Cannot book more than 90 days in advance';
      }
    }

    // Time validation
    if (!bookingForm.time) {
      errors.time = 'Time is required';
    } else if (!availableTimeSlots.includes(bookingForm.time)) {
      errors.time = 'Selected time is not available';
    }

    // Duration validation — must be one of the allowedDurations computed from availability
    if (!bookingForm.duration || bookingForm.duration === 0) {
      errors.duration = 'Duration is required';
    } else if (bookingForm.duration <= 0) {
      errors.duration = 'Duration must be greater than 0';
    } else if (!allowedDurations.includes(bookingForm.duration)) {
      errors.duration = 'Selected duration does not fit within the tutor\'s availability for the chosen date/time';
    }

    // Notes validation (optional)
    if (bookingForm.student_notes && bookingForm.student_notes.length > 500) {
      errors.student_notes = 'Notes cannot exceed 500 characters';
    }

    setBookingErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const fetchMyBookings = async () => {
    try {
      setMyBookingsLoading(true);
      setMyBookingsError(null);
      const res = await apiClient.get('/users/me/bookings');
      setMyBookings(res.data || []);
      setShowMyBookings(true);
    } catch (err) {
      console.error('Failed to fetch my bookings', err);
      setMyBookingsError('Failed to load your bookings.');
    } finally {
      setMyBookingsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Search className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-slate-800">Find & Book Tutors</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <p className="text-slate-600">
          Browse tutors filtered by your course subjects, view their profiles,
          ratings, and availability to book a session.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="w-full md:w-2/3">
          <label htmlFor="tutor-search" className="sr-only">Search tutors</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              id="tutor-search"
              placeholder="Search subjects or tutor name (e.g. calculus, John Doe)"
              value={searchDraft}
              onChange={e => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setSearchQuery(searchDraft.trim());
                }
              }}
              className="w-full bg-white border border-slate-200 rounded-full pl-10 pr-10 py-2 shadow-sm focus:shadow-md transition-shadow duration-150 outline-none placeholder:text-slate-400"
            />
            {searchDraft ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => { setSearchDraft(''); setSearchQuery(''); }}
                className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            ) : (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Press Enter</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-1/3">
          <label className="text-sm text-slate-600">Filter:</label>
          <select value={filterOption} onChange={e => setFilterOption(e.target.value as any)} className="border rounded-md px-3 py-2 w-full">
            <option value="all">All</option>
            <option value="has_subjects">Has subjects</option>
            <option value="top_rated">Top rated</option>
            <option value="with_reviews">With reviews</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* My Bookings */}
      {showMyBookings && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h2 className="text-lg font-semibold">My Bookings</h2>
          {myBookingsLoading ? (
            <div className="text-slate-600">Loading your bookings...</div>
          ) : myBookingsError ? (
            <div className="text-red-500">{myBookingsError}</div>
          ) : myBookings.length === 0 ? (
            <div className="text-slate-600">You have no bookings yet.</div>
          ) : (
            <div className="mt-2 space-y-2">
              {myBookings.map(b => (
                <div key={b.id} className="border rounded p-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{b.subject} with {b.tutor?.user?.name || 'Tutor'}</div>
                    <div className="text-sm text-slate-600">{new Date(b.date).toLocaleDateString()} · {b.time} · {b.duration}h</div>
                    {b.student_notes && <div className="text-sm text-slate-500">Notes: {b.student_notes}</div>}
                  </div>
                  <div className="text-sm font-medium">{b.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        {loading ? (
          <div className="text-slate-600">Loading tutors...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : tutors.length === 0 ? (
          <div className="text-slate-600">No tutors found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTutors.map(t => (
              <div key={t.user_id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <img
                    src={getFileUrl(t.profile_image_url || '')}
                    alt={t.name}
                    className="h-14 w-14 rounded-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}`; }}
                  />
                  <div>
                    <div className="font-semibold text-slate-800">{t.name}</div>
                    <div className="text-sm text-slate-500">{t.university_name || 'N/A'}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg
                            key={star}
                            className={`w-4 h-4 ${star <= (t.tutor_profile?.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-sm text-slate-600">
                        {t.tutor_profile?.rating?.toFixed(1) || 'No ratings'} 
                        {t.tutor_profile?.total_reviews ? ` (${t.tutor_profile.total_reviews} reviews)` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-slate-600">Status: <span className="font-medium text-slate-800">{t.tutor_profile?.status || 'pending'}</span></div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openProfile(t)}
                      className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {isProfileOpen && (
        <Modal
          isOpen={true}
          onClose={() => { setIsProfileOpen(false); setShowBookingForm(false); setBookingForm({ subject: '', date: '', time: '', duration: 1, student_notes: '' }); }}
          title={""}
          footer={
            <>
              {!showBookingForm ? (
                <>
                  <button
                    onClick={() => setShowBookingForm(true)}
                    className="ml-2 px-6 py-2.5 rounded-lg text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Book Session
                  </button>
                  <button
                    onClick={() => { setIsProfileOpen(false); setShowBookingForm(false); setBookingForm({ subject: '', date: '', time: '', duration: 1, student_notes: '' }); }}
                    className="px-6 py-2.5 border-2 border-slate-300 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      const ok = validateBookingForm();
                      if (!ok) {
                        toast.error('Please fix booking errors before submitting');
                        return;
                      }
                      setConfirmationOpen(true);
                    }}
                    disabled={bookingLoading}
                    className={`ml-2 px-6 py-2.5 rounded-lg text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 ${bookingLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}
                  >
                    {bookingLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting…
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Submit Booking
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => { setShowBookingForm(false); setBookingForm({ subject: '', date: '', time: '', duration: 1, student_notes: '' }); }}
                    className="px-6 py-2.5 border-2 border-slate-300 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </>
          }
        >
          {profileLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <svg className="animate-spin h-12 w-12 text-indigo-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div className="text-slate-600 font-medium">Loading profile...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Enhanced Header Section */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 text-white relative overflow-hidden">
                  {/* Decorative background pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -mr-32 -mt-32"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full -ml-24 -mb-24"></div>
                  </div>
                  
                  <div className="relative flex items-start gap-6">
                    <div className="relative">
                      <div className="h-28 w-28 rounded-2xl ring-4 ring-white/30 shadow-2xl overflow-hidden flex-shrink-0 bg-white/10 backdrop-blur-sm">
                        <img 
                          src={getFileUrl(selectedTutorProfile?.user?.profile_image_url || '')} 
                          alt={selectedTutorProfile?.user?.name} 
                          className="w-full h-full object-cover" 
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedTutorProfile?.user?.name || 'Tutor')}`; }} 
                        />
                      </div>
                      {selectedTutorProfile?.profile?.is_verified && (
                        <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1.5 ring-4 ring-white shadow-lg">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <h2 className="text-3xl font-bold leading-tight mb-1">{selectedTutorProfile?.user?.name}</h2>
                          <div className="flex items-center gap-2 text-white/90">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0v-5.5a2.5 2.5 0 015 0V21m-5 0h5m-5 0v-5.5a2.5 2.5 0 015 0V21" />
                            </svg>
                            <span className="text-sm font-medium">{selectedTutorProfile?.user?.university_name || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="inline-flex items-center bg-white/20 backdrop-blur-sm text-white text-sm rounded-full px-4 py-2 shadow-lg">
                          <svg className="w-5 h-5 mr-2 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                          </svg>
                          <span className="font-bold text-lg">{selectedTutorProfile?.user?.tutor_profile?.rating?.toFixed(1) || '—'}</span>
                          <span className="text-xs opacity-90 ml-2">
                            {selectedTutorProfile?.user?.tutor_profile?.total_reviews 
                              ? `(${selectedTutorProfile.user.tutor_profile.total_reviews} ${selectedTutorProfile.user.tutor_profile.total_reviews === 1 ? 'review' : 'reviews'})` 
                              : 'No reviews'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content Sections */}
              <div className="space-y-6">
                {/* About Section */}
                <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">About</h3>
                  </div>
                  <p className="text-slate-700 leading-relaxed text-base">{selectedTutorProfile?.profile?.bio || 'No bio provided.'}</p>
                </div>

                {/* Subjects Section */}
                <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Subjects</h3>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {(selectedTutorProfile?.profile?.subjects || []).map((s: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSearchDraft(String(s));
                          setSearchQuery(String(s));
                          setIsProfileOpen(false);
                        }}
                        className="group relative px-4 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-800 rounded-lg hover:from-indigo-200 hover:to-purple-200 transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md border border-indigo-200 hover:border-indigo-300"
                      >
                        <span className="relative z-10">{s}</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg opacity-0 group-hover:opacity-10 transition-opacity"></div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Availability Section */}
                <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 rounded-xl p-6 shadow-lg border border-indigo-100">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="font-semibold text-indigo-900 text-lg">Availability</h4>
                  </div>
                  {(selectedTutorProfile?.availability || []).length === 0 ? (
                    <div className="text-center py-6">
                      <svg className="w-12 h-12 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-slate-500 text-sm">No availability provided.</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(selectedTutorProfile?.availability || []).map((a: any, index: number) => {
                        const dayColors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
                          'Monday': { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800', icon: '📅' },
                          'Tuesday': { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800', icon: '📆' },
                          'Wednesday': { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-800', icon: '📋' },
                          'Thursday': { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-800', icon: '📝' },
                          'Friday': { bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-800', icon: '📌' },
                          'Saturday': { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800', icon: '📊' },
                          'Sunday': { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800', icon: '📑' },
                        };
                        const dayName = a.day_of_week || '';
                        const colors = dayColors[dayName] || { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800', icon: '📅' };
                        const nextDate = nextDateForWeekday(dayName);
                        const isUpcoming = nextDate && new Date(nextDate) >= new Date(new Date().toISOString().split('T')[0]);
                        
                        return (
                          <div 
                            key={a.availability_id || a.day_of_week || index} 
                            className={`${colors.bg} ${colors.border} border-2 rounded-lg p-3 transition-all duration-200 hover:shadow-md hover:scale-[1.02]`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{colors.icon}</span>
                                <div className={`font-bold ${colors.text} text-sm uppercase tracking-wide`}>
                                  {dayName.substring(0, 3)}
                                </div>
                              </div>
                              {isUpcoming && (
                                <span className="text-xs bg-white/70 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                                  Next: {new Date(nextDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <svg className={`w-4 h-4 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div className={`${colors.text} font-semibold text-sm`}>
                                {a.start_time?.substring(0, 5) || a.start_time} - {a.end_time?.substring(0, 5) || a.end_time}
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-white/50">
                              <div className="flex items-center gap-1">
                                <svg className="w-3 h-3 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs text-slate-600">
                                  {(() => {
                                    const start = new Date(`1970-01-01T${a.start_time}`);
                                    const end = new Date(`1970-01-01T${a.end_time}`);
                                    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                    return `${hours.toFixed(1)}h available`;
                                  })()}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div className="mt-4 pt-3 border-t border-indigo-200">
                        <button
                          onClick={() => {
                            if (selectedTutorProfile?.availability?.length > 0) {
                              const firstDay = selectedTutorProfile.availability[0];
                              const suggestedDate = nextDateForWeekday(firstDay.day_of_week);
                              if (suggestedDate) {
                                setBookingForm(prev => ({ ...prev, date: suggestedDate }));
                                setShowBookingForm(true);
                              }
                            }
                          }}
                          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium py-2 px-4 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Book Next Available Slot
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Booking Form (hidden initially; revealed when the user clicks Book) */}
              {showBookingForm && (
                <div className="mt-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 shadow-lg border-2 border-blue-200">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-md">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-800">Book a Session</h3>
                      <p className="text-sm text-slate-600">Fill in the details below to request a tutoring session</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {/* Subject selector */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        Subject
                      </label>
                      <select
                        className={`w-full border-2 ${bookingErrors.subject ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white'} px-4 py-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium`}
                        value={bookingForm.subject}
                        onChange={(e) => {
                          const value = e.target.value;
                          setBookingForm(prev => ({ ...prev, subject: value }));
                          setBookingErrors(prev => { const p = { ...prev }; delete (p as any).subject; return p; });
                        }}
                      >
                        <option value="">Select a subject</option>
                        {(selectedTutorProfile?.profile?.subjects || []).map((s: string, i: number) => (
                          <option key={i} value={s}>{s}</option>
                        ))}
                      </select>
                      {bookingErrors.subject && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-sm text-red-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {bookingErrors.subject}
                        </div>
                      )}
                    </div>

                    {/* Date and Time Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Date
                        </label>
                        <input
                          type="date"
                          className={`w-full border-2 ${bookingErrors.date ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white'} px-4 py-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium`}
                          value={bookingForm.date}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBookingForm(prev => ({ ...prev, date: value }));
                            setBookingErrors(prev => { const p = { ...prev }; delete (p as any).date; delete (p as any).time; return p; });
                          }}
                          min={new Date().toISOString().split('T')[0]}
                        />
                        {bookingErrors.date && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-sm text-red-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {bookingErrors.date}
                          </div>
                        )}
                        {bookingForm.date && !availableTimeSlots.length && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            No available times on this date
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Time {availableTimeSlots.length > 0 && <span className="text-xs font-normal text-slate-500">({availableTimeSlots.length} slots)</span>}
                        </label>
                        <select
                          className={`w-full border-2 ${bookingErrors.time ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white'} ${!bookingForm.date ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''} px-4 py-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium`}
                          value={bookingForm.time}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBookingForm(prev => ({ ...prev, time: value }));
                            setBookingErrors(prev => { const p = { ...prev }; delete (p as any).time; return p; });
                          }}
                          disabled={!bookingForm.date}
                        >
                          <option value="">Select time</option>
                          {availableTimeSlots.map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                        {bookingErrors.time && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-sm text-red-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {bookingErrors.time}
                          </div>
                        )}
                        {!bookingForm.date && (
                          <div className="mt-1.5 text-xs text-slate-500">Please select a date first</div>
                        )}
                      </div>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Duration
                      </label>
                      <select
                        className={`w-full border-2 ${bookingErrors.duration ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white'} ${allowedDurations.length === 0 ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''} px-4 py-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium`}
                        value={bookingForm.duration}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (!isNaN(value)) setBookingForm(prev => ({ ...prev, duration: value }));
                          setBookingErrors(prev => { const p = { ...prev }; delete (p as any).duration; return p; });
                        }}
                        disabled={allowedDurations.length === 0}
                      >
                        <option value={0}>Select duration</option>
                        {allowedDurations.map(d => (
                          <option key={d} value={d}>{d} {d === 1 ? 'hour' : 'hours'}</option>
                        ))}
                      </select>
                      {bookingErrors.duration && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-sm text-red-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {bookingErrors.duration}
                        </div>
                      )}
                      <div className="mt-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                        Choose a duration that fits within the tutor's availability window
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Notes <span className="text-xs font-normal text-slate-500">(optional)</span>
                      </label>
                      <textarea
                        className="w-full border-2 border-slate-300 bg-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                        placeholder="Add any special requests or notes for the tutor..."
                        rows={4}
                        value={bookingForm.student_notes}
                        onChange={(e) => {
                          const value = e.target.value;
                          setBookingForm(prev => ({ ...prev, student_notes: value }));
                          setBookingErrors(prev => { const p = { ...prev }; delete (p as any).student_notes; return p; });
                        }}
                      />
                      {bookingErrors.student_notes && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-sm text-red-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {bookingErrors.student_notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Booking Confirmation Modal */}
      {confirmationOpen && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmationOpen(false)}
          title="Confirm Booking"
          footer={
            <>
              <button
                onClick={handleConfirmBooking}
                disabled={bookingLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-md"
              >
                {bookingLoading ? 'Booking...' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmationOpen(false)}
                className="px-4 py-2 border rounded-md hover:bg-gray-100 ml-2"
              >
                Back
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-indigo-600 to-blue-500 p-4 text-white flex items-center gap-4">
                <div className="h-14 w-14 rounded-full overflow-hidden flex-shrink-0">
                  <img src={getFileUrl(selectedTutorProfile?.user?.profile_image_url || '')} alt={selectedTutorProfile?.user?.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedTutorProfile?.user?.name || 'Tutor')}`; }} />
                </div>
                <div>
                  <div className="font-semibold text-lg">{selectedTutorProfile?.user?.name}</div>
                  <div className="text-sm opacity-90">{selectedTutorProfile?.user?.university_name || ''}</div>
                </div>
                <div className="ml-auto text-sm inline-flex items-center bg-white/20 px-2 py-1 rounded text-white">
                  {selectedTutorProfile?.user?.tutor_profile?.rating ? `${selectedTutorProfile.user.tutor_profile.rating.toFixed(1)} ★` : '—'}
                </div>
              </div>
              <div className="p-4 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="text-sm">
                    <div className="font-medium">Subject</div>
                    <div className="text-slate-700">{bookingForm.subject || '—'}</div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">When</div>
                    <div className="text-slate-700">{bookingForm.date ? new Date(bookingForm.date).toLocaleDateString() : '—'} · {bookingForm.time || '—'}</div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">Duration</div>
                    <div className="text-slate-700">{bookingForm.duration ? `${bookingForm.duration} hour${bookingForm.duration !== 1 ? 's' : ''}` : '—'}</div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">Notes</div>
                    <div className="text-slate-700">{bookingForm.student_notes || 'No notes'}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-500">A confirmation will be sent to your email when the tutor accepts.</div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelConfirmationOpen && (
        <Modal
          isOpen={true}
          onClose={() => setCancelConfirmationOpen(false)}
          title="Cancel Booking"
          footer={
            <>
              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  setCancelConfirmationOpen(false);
                  setBookingForm({ subject: '', date: '', time: '', duration: 1, student_notes: '' });
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Yes, Cancel
              </button>
              <button
                onClick={() => setCancelConfirmationOpen(false)}
                className="px-4 py-2 border rounded-md hover:bg-gray-100"
              >
                No, Keep Editing
              </button>
            </>
          }
        >
          <p className="text-slate-700">
            Are you sure you want to cancel this booking? Any information you've entered will be lost.
          </p>
        </Modal>
      )}

      {/* Error Modal */}
      {bookingErrorModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setBookingErrorModalOpen(false)}
          title="Booking Error"
          footer={
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-md"
              onClick={() => setBookingErrorModalOpen(false)}
            >
              Got it
            </button>
          }
        >
          <div className="py-2 text-slate-700">{bookingErrorModalMessage}</div>
        </Modal>
      )}

      {/* Toast Container */}
      <ToastContainer position="top-center" />
      
    </div>
  );
};

export default TuteeFindAndBookTutors;
