import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import apiClient, { getFileUrl } from '../../services/api';
import Modal from '../ui/Modal';

type TutorListItem = {
  user_id: number;
  name: string;
  email: string;
  profile_image_url?: string | null;
  university_name?: string | null;
  role?: string;
  tutor_profile?: { tutor_id: number; status?: string } | null;
};

const TuteeFindAndBookTutors: React.FC = () => {
  const [tutors, setTutors] = useState<TutorListItem[]>([]);
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
        setTutors(tutorsOnly);
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
  const [bookingErrors, setBookingErrors] = useState<{ subject?: string; date?: string; time?: string; duration?: string }>({});

  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [myBookingsLoading, setMyBookingsLoading] = useState(false);
  const [myBookingsError, setMyBookingsError] = useState<string | null>(null);
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [bookingErrorModalOpen, setBookingErrorModalOpen] = useState(false);
  const [bookingErrorModalMessage, setBookingErrorModalMessage] = useState<string | null>(null);

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
    if (!bookingForm.subject || bookingForm.subject.trim().length < 3) errors.subject = 'Please enter a subject (3+ chars).';
    if (!bookingForm.date) errors.date = 'Please choose a date.';
    else {
      const d = new Date(bookingForm.date);
      const today = new Date();
      today.setHours(0,0,0,0);
      if (isNaN(d.getTime())) errors.date = 'Invalid date.';
      else if (d < today) errors.date = 'Date must be today or later.';
    }
    if (!bookingForm.time) errors.time = 'Please choose a time.';
    if (!bookingForm.duration || bookingForm.duration <= 0) errors.duration = 'Duration must be greater than 0.';
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
        <div className="ml-auto">
          <button className="px-3 py-1 bg-slate-100 border rounded text-sm" onClick={() => fetchMyBookings()}>{myBookingsLoading ? 'Loading…' : 'My Bookings'}</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <p className="text-slate-600">
          Browse tutors filtered by your course subjects, view their profiles,
          ratings, and availability to book a session.
        </p>
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
            {tutors.map(t => (
              <div key={t.user_id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <img
                    src={getFileUrl(t.profile_image_url || '')}
                    alt={t.name}
                    className="h-14 w-14 rounded-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}`; }}
                  />
                  <div>
                    <div className="font-semibold text-slate-800">{t.name}</div>
                    <div className="text-sm text-slate-500">{t.university_name || 'N/A'}</div>
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
          onClose={() => { setIsProfileOpen(false); setSelectedTutorProfile(null); }}
          title={selectedTutorProfile?.user?.name || 'Tutor Profile'}
          footer={
            <>
              <button onClick={() => { setIsProfileOpen(false); setSelectedTutorProfile(null); }} className="px-4 py-2 border rounded-md">Close</button>
              <button onClick={() => setBookingOpen(true)} className="ml-2 px-4 py-2 bg-green-600 text-white rounded-md">Book</button>
            </>
          }
        >
          {profileLoading ? (
            <div className="text-slate-600">Loading profile...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <img src={getFileUrl(selectedTutorProfile?.user?.profile_image_url || '')} alt={selectedTutorProfile?.user?.name} className="h-20 w-20 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedTutorProfile?.user?.name || 'Tutor')}`; }} />
                <div>
                  <div className="text-xl font-semibold">{selectedTutorProfile?.user?.name}</div>
                  <div className="text-sm text-slate-500">{selectedTutorProfile?.user?.university_name || 'N/A'}</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium">Bio</h4>
                <p className="text-slate-700">{selectedTutorProfile?.profile?.bio || 'No bio provided.'}</p>
              </div>

              <div>
                <h4 className="font-medium">Subjects</h4>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(selectedTutorProfile?.profile?.subjects || []).map((s: string, i: number) => (
                    <span key={i} className="text-sm bg-indigo-100 text-indigo-800 px-2 py-1 rounded">{s}</span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium">Availability</h4>
                <div className="mt-2 space-y-1">
                  {(selectedTutorProfile?.availability || []).length === 0 ? (
                    <div className="text-slate-500 text-sm">No availability provided.</div>
                  ) : (
                    (selectedTutorProfile?.availability || []).map((a: any) => (
                      <div key={a.availability_id} className="text-sm text-slate-700">{a.day_of_week}: {a.start_time} - {a.end_time}</div>
                    ))
                  )}
                </div>
              </div>

              {/* Booking form inline when bookingOpen is true */}
              {bookingOpen && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="font-medium">Request Booking</h4>
                  <div className="space-y-2 mt-2">
                    <input className="w-full border px-2 py-1 rounded" placeholder="Subject" value={bookingForm.subject} onChange={(e) => setBookingForm({ ...bookingForm, subject: e.target.value })} onBlur={validateBookingForm} />
                    {bookingErrors.subject && <div className="text-xs text-red-600">{bookingErrors.subject}</div>}
                    <div className="flex gap-2">
                      <input type="date" className="border px-2 py-1 rounded" value={bookingForm.date} onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })} onBlur={validateBookingForm} />
                      <input type="time" className="border px-2 py-1 rounded" value={bookingForm.time} onChange={(e) => setBookingForm({ ...bookingForm, time: e.target.value })} onBlur={validateBookingForm} />
                      <input type="number" min={0.5} step={0.5} className="w-24 border px-2 py-1 rounded" value={bookingForm.duration} onChange={(e) => setBookingForm({ ...bookingForm, duration: Number(e.target.value) })} onBlur={validateBookingForm} />
                    </div>
                    {bookingErrors.date && <div className="text-xs text-red-600">{bookingErrors.date}</div>}
                    {bookingErrors.time && <div className="text-xs text-red-600">{bookingErrors.time}</div>}
                    {bookingErrors.duration && <div className="text-xs text-red-600">{bookingErrors.duration}</div>}
                    <textarea className="w-full border px-2 py-1 rounded" placeholder="Notes (optional)" value={bookingForm.student_notes || ''} onChange={(e) => setBookingForm({ ...bookingForm, student_notes: e.target.value })} />
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1 bg-blue-600 text-white rounded-md" disabled={bookingLoading} onClick={async () => {
                        if (!selectedTutorProfile?.user?.tutor_profile) return;
                        // Validate before send
                        const valid = validateBookingForm();
                        if (!valid) return;
                        setBookingLoading(true);
                        setBookingMessage(null);
                        try {
                          const tutorId = selectedTutorProfile.user.tutor_profile.tutor_id;
                          const payload = { ...bookingForm };
                          await apiClient.post(`/tutors/${tutorId}/booking-requests`, payload);
                          setBookingMessage('Booking request sent. The tutor will review and respond.');
                          setBookingForm({ subject: '', date: '', time: '', duration: 1 });
                          setBookingOpen(false);
                          // refresh my bookings if visible
                          if (showMyBookings) fetchMyBookings();
                        } catch (err: any) {
                          console.error('Failed to send booking request', err);
                          const serverMsg = err?.response?.data?.message || err?.message || 'Failed to send booking request. Please try again later.';
                          // Show a centered modal for important booking errors (like availability/conflict)
                          const modalErrors = [
                            'Tutor has no availability on the requested day',
                            'Requested time is outside tutor availability',
                            'Requested time conflicts with an existing booking'
                          ];
                          if (modalErrors.includes(serverMsg)) {
                            setBookingErrorModalMessage(serverMsg);
                            setBookingErrorModalOpen(true);
                          } else {
                            setBookingMessage(serverMsg);
                          }
                        } finally {
                          setBookingLoading(false);
                        }
                      }}>{bookingLoading ? 'Sending...' : 'Send Request'}</button>
                      <button className="px-3 py-1 border rounded" onClick={() => { setBookingOpen(false); setBookingMessage(null); }}>Cancel</button>
                    </div>
                    {bookingMessage && <div className="text-sm text-slate-700">{bookingMessage}</div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
      {/* Booking error modal (centered, requires acknowledgement) */}
      {bookingErrorModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => { setBookingErrorModalOpen(false); setBookingErrorModalMessage(null); }}
          title={"Booking error"}
          footer={<button className="px-4 py-2 bg-indigo-600 text-white rounded" onClick={() => { setBookingErrorModalOpen(false); setBookingErrorModalMessage(null); }}>Got it</button>}
        >
          <div className="py-2 text-slate-700">{bookingErrorModalMessage}</div>
        </Modal>
      )}
    </div>
  );
};

export default TuteeFindAndBookTutors;
