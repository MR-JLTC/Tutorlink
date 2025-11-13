import React, { useState, useEffect } from 'react';
import apiClient, { getFileUrl } from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useVerification } from '../../context/VerificationContext';
import { User, Camera, CreditCard, Star, Edit, Save, X, CheckCircle, Clock } from 'lucide-react';
import { updateRoleUser } from '../../utils/authRole';

interface TutorProfile {
  bio: string;
  profile_photo: string;
  gcash_number: string;
  gcash_qr: string;
  subjects: string[];
  rating: number;
  total_reviews: number;
}

const ProfileSetup: React.FC = () => {
  const { user } = useAuth();
  const { isVerified, applicationStatus } = useVerification();
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [profile, setProfile] = useState<TutorProfile>({
    bio: '',
    profile_photo: '',
    gcash_number: '',
    gcash_qr: '',
    subjects: [],
    rating: 0,
    total_reviews: 0
  });
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [gcashQR, setGcashQR] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      // Prefer tutor_id from user context if available
      const contextTutorId = (user as any)?.tutor_profile?.tutor_id ?? (user as any)?.tutor_id;
      if (contextTutorId) {
        const parsed = Number(contextTutorId);
        if (!Number.isNaN(parsed)) {
          setTutorId(parsed);
          return;
        }
      }

      const uid = (user as any)?.id ?? (user as any)?.user_id;
      if (!uid) return;

      const fetchTutorId = async () => {
        try {
          const response = await apiClient.get(`/tutors/by-user/${uid}/tutor-id`);
          const raw = response?.data ?? {};
          const extracted = raw.tutor_id ?? raw.tutorId ?? raw.id ?? raw.data?.tutor_id ?? raw.data?.tutorId;
          const actualTutorId = extracted != null ? Number(extracted) : null;
          console.log('Fetched tutor_id via by-user:', raw, 'resolved:', actualTutorId, 'for uid:', uid);
          if (actualTutorId) {
            setTutorId(actualTutorId);
            return;
          }
          throw new Error('Tutor ID not present in response');
        } catch (error: any) {
          console.error('Failed to fetch tutor ID via by-user endpoint:', error?.response?.data || error?.message);
          setTutorId(null);
        }
      };
      fetchTutorId();
    }
  }, [user]);

  useEffect(() => {
    if (tutorId) {
      fetchProfile();
    }
  }, [tutorId]);

  const fetchProfile = async () => {
    if (!tutorId) return;
    try {
      const response = await apiClient.get(`/tutors/${tutorId}/profile`);
      console.log('Profile response data:', response.data);
      console.log('Profile photo URL from API:', response.data.profile_photo);
      console.log('User profile_image_url:', user?.profile_image_url);
      
      // Prefer API value, then keep existing state if already updated, then fallback to user context
      setProfile(prev => {
        let profilePhotoUrl = response.data.profile_photo || prev.profile_photo || user?.profile_image_url || '';
        // Keep cache-busting token if present
        if (profilePhotoUrl && typeof profilePhotoUrl === 'string' && !/\?t=/.test(profilePhotoUrl) && prev.profile_photo?.includes('?t=')) {
          const ts = prev.profile_photo.split('?t=')[1];
          if (ts) profilePhotoUrl = `${profilePhotoUrl}?t=${ts}`;
        }
        console.log('Setting profile photo URL to:', profilePhotoUrl);
        return { ...prev, ...response.data, profile_photo: profilePhotoUrl };
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const handleInputChange = (field: keyof TutorProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) setProfileImage(file);
  };

  const handleGcashQRChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) setGcashQR(file);
  };

  const saveProfile = async () => {
    // Basic client-side validation
    const bioToSave = (profile.bio || '').trim();
    const gcashToSave = (profile.gcash_number || '').trim();
    const bioValid = !bioToSave || /^[A-Za-z\s]+$/.test(bioToSave);
    const gcashValid = !gcashToSave || /^09\d{9}$/.test(gcashToSave);
    if (!bioValid) {
      alert('Bio can contain letters and spaces only.');
      return;
    }
    if (!gcashValid) {
      alert('GCash number must be 11 digits and start with 09.');
      return;
    }

    // Ensure we have a tutorId before proceeding
    const ensureTutorId = async (): Promise<number | null> => {
      if (tutorId) return tutorId;
      try {
        const ctxTid = (user as any)?.tutor_profile?.tutor_id ?? (user as any)?.tutor_id;
        if (ctxTid) {
          const parsed = Number(ctxTid);
          if (!Number.isNaN(parsed)) {
            setTutorId(parsed);
            return parsed;
          }
        }
        const uid = (user as any)?.id ?? (user as any)?.user_id;
        if (uid) {
          const res = await apiClient.get(`/tutors/by-user/${uid}/tutor-id`);
          const raw = res?.data ?? {};
          const extracted = raw.tutor_id ?? raw.tutorId ?? raw.id ?? raw.data?.tutor_id ?? raw.data?.tutorId;
          const resolved = extracted != null ? Number(extracted) : null;
          if (resolved) {
            setTutorId(resolved);
            return resolved;
          }
        }
      } catch (e) {
        /* keep null if cannot resolve authoritatively */
      }
      return null; // Require real tutor_id
    };

    const id = await ensureTutorId();
    if (!id) {
      console.warn('Tutor ID could not be resolved. Will proceed with user-only updates (e.g., profile image) if available.');
      // Allow profile image upload via user id even if tutor id is missing
      if (profileImage) {
        setLoading(true);
        try {
          const userIdForUpload = (user as any)?.user_id ?? (user as any)?.id;
          const formData = new FormData();
          formData.append('file', profileImage);
          const profileResponse = await apiClient.post(`/users/${userIdForUpload}/profile-image`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          const profilePhotoUrl = profileResponse.data.profile_image_url || profileResponse.data?.data?.profile_image_url;
          if (profilePhotoUrl) {
            setProfile(prev => ({ ...prev, profile_photo: profilePhotoUrl }));
            if (user) {
              const updatedUser = { ...user, profile_image_url: profilePhotoUrl } as any;
              localStorage.setItem('user', JSON.stringify(updatedUser));
              updateRoleUser(updatedUser);
            }
          }
          setIsEditing(false);
          setProfileImage(null);
          alert('Profile image updated successfully!');
        } catch (e) {
          console.error('Failed user profile image upload without tutorId:', e);
          alert('Failed to upload profile image.');
        } finally {
          setLoading(false);
        }
      }
      return;
    }

    setLoading(true);
    try {
      console.log('Saving profile with tutorId:', id, 'user:', user);
      // Update basic profile info with authoritative endpoint first
      let updatedBasics = false;
      try {
        await apiClient.put(`/tutors/${id}`, {
          bio: bioToSave,
          gcash_number: gcashToSave
        });
        updatedBasics = true;
      } catch (ePrimary: any) {
        console.warn('PUT /tutors/:id failed', ePrimary?.response?.data || ePrimary?.message);
        // Fallback endpoint
        try {
          await apiClient.put(`/tutors/${id}/profile`, {
            bio: bioToSave,
            gcash_number: gcashToSave
          });
          updatedBasics = true;
        } catch (eFallback: any) {
          console.error('Fallback update failed', eFallback?.response?.data || eFallback?.message);
        }
      }

      // Upload profile image using USER ID (not tutor id)
      if (profileImage) {
        try {
          const userIdForUpload = (user as any)?.user_id ?? (user as any)?.id;
          console.log('Uploading profile image for user:', userIdForUpload);
          const formData = new FormData();
          formData.append('file', profileImage);
          const profileResponse = await apiClient.post(`/users/${userIdForUpload}/profile-image`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          console.log('Profile image upload response:', profileResponse.data);
          
          // The backend returns { success: true, profile_image_url: fileUrl }
          let profilePhotoUrl = profileResponse.data.profile_image_url || profileResponse.data?.data?.profile_image_url;
          if (profilePhotoUrl) {
            // Cache-bust to force image refresh
            if (!/\?t=/.test(profilePhotoUrl)) {
              profilePhotoUrl = `${profilePhotoUrl}?t=${Date.now()}`;
            }
            console.log('Setting profile photo URL to:', profilePhotoUrl);
            setProfile(prev => ({ ...prev, profile_photo: profilePhotoUrl }));
            
            // Also update user context if available
            if (user) {
              const updatedUser = { ...user, profile_image_url: profilePhotoUrl };
              localStorage.setItem('user', JSON.stringify(updatedUser));
              updateRoleUser(updatedUser);
            }
          } else {
            console.warn('Profile image URL not found in response:', profileResponse.data);
          }
        } catch (profileError: any) {
          console.error('Failed to upload profile image:', profileError);
          console.error('Error details:', profileError?.response?.data);
          // Non-blocking: continue saving other fields
        }
      } else if (user?.profile_image_url && !profileImage) {
        // If no new image is selected and user already has one, keep it
        setProfile(prev => ({ ...prev, profile_photo: user.profile_image_url }));
      }

      // Upload GCash QR if changed
      if (gcashQR) {
        try {
          console.log('Uploading GCash QR for tutor:', id);
          const formData = new FormData();
          formData.append('file', gcashQR);
          const gcashResponse = await apiClient.post(`/tutors/${id}/gcash-qr`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          console.log('GCash QR upload response:', gcashResponse.data);
          
          // The backend returns { success: true, gcash_qr_url: fileUrl }
          let gcashQRUrl = gcashResponse.data.gcash_qr_url || gcashResponse.data?.data?.gcash_qr_url;
          if (gcashQRUrl) {
            // Cache-bust to force image refresh
            if (!/\?t=/.test(gcashQRUrl)) {
              gcashQRUrl = `${gcashQRUrl}?t=${Date.now()}`;
            }
            console.log('Setting GCash QR URL to:', gcashQRUrl);
            setProfile(prev => ({ ...prev, gcash_qr: gcashQRUrl }));
          } else {
            console.warn('GCash QR URL not found in response:', gcashResponse.data);
          }
        } catch (gcashError: any) {
          console.error('Failed to upload GCash QR:', gcashError);
          console.error('Error details:', gcashError?.response?.data);
          // Non-blocking: proceed without QR update
        }
      }

      setIsEditing(false);
      setProfileImage(null);
      setGcashQR(null);
      
      // Refresh profile from server to ensure accurate persisted values
      await fetchProfile();
      
      alert('Profile updated successfully!');
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      const errorMessage = (error?.response?.data?.message || error?.message || '').toString();
      // Suppress noisy backend message
      if (errorMessage.toLowerCase().includes('tutor not found')) {
        console.warn('Tutor not found during save. Suppressing alert.');
      } else {
        alert(errorMessage || 'Failed to save profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Profile Setup</h1>
            <p className="text-blue-100">Manage your public profile and payment information</p>
          </div>
          <div className="flex items-center gap-3 bg-white/95 backdrop-blur-sm rounded-xl p-2 shadow-md">
            <div className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold text-slate-800 border flex items-center space-x-2 ${applicationStatus === 'approved' ? 'border-green-300' : 'border-red-300'}`}>
              {applicationStatus === 'approved' ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Approved</span>
                </>
              ) : (
                <>
                  <X className="h-4 w-4 text-red-600" />
                  <span>Not Approved</span>
                </>
              )}
            </div>
            <div className="flex space-x-2">
              {isEditing ? (
                <>
                  <Button variant="secondary" onClick={() => setIsEditing(false)} className="!px-3 !py-2">
                    Cancel
                  </Button>
                  <Button onClick={saveProfile} disabled={loading} className="!px-3 !py-2 bg-blue-600 text-white hover:bg-blue-700 shadow-sm">
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)} className="!px-3 !py-2 bg-blue-600 text-white hover:bg-blue-700 shadow-sm flex items-center space-x-2">
                  <Edit className="h-4 w-4" />
                  <span>Edit Profile</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Overview */}
      <Card className="p-5">
        <div className="mb-5">
          {/* Profile Image */}
          <div className="flex justify-center mb-4">
            {profileImage ? (
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-slate-100">
                  <img
                    src={URL.createObjectURL(profileImage)}
                    alt="Profile Preview"
                    className="w-full h-full object-cover"
                    style={{aspectRatio: '1/1'}}
                  />
                </div>
                {applicationStatus === 'approved' && (
                  <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full border-2 border-white">
                    ✓
                  </div>
                )}
                {isEditing && (
                  <div className="absolute bottom-0 right-0 flex space-x-1">
                    <label className="bg-blue-600 text-white rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-colors">
                      <Camera className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageChange}
                        className="hidden"
                      />
                    </label>
                    {profileImage && (
                      <button
                        onClick={() => setProfileImage(null)}
                        className="bg-red-600 text-white rounded-full p-2 hover:bg-red-700 transition-colors"
                        title="Remove selected image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : profile.profile_photo || user?.profile_image_url ? (
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-slate-100">
                  <img
                    src={getFileUrl(profile.profile_photo || (user as any)?.profile_image_url || '')}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    style={{aspectRatio: '1/1'}}
                    onError={(e) => {
                      console.error('Failed to load profile image. Original URL:', profile.profile_photo || (user as any)?.profile_image_url);
                      console.error('Constructed URL:', getFileUrl(profile.profile_photo || (user as any)?.profile_image_url || ''));
                      // Fallback to initials avatar
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent((user as any)?.name || 'Tutor')}&background=random`;
                    }}
                    onLoad={() => {
                      console.log('Profile image loaded successfully:', getFileUrl(profile.profile_photo || (user as any)?.profile_image_url || ''));
                    }}
                  />
                </div>
                {applicationStatus === 'approved' ? (
                  <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full border-2 border-white">
                    ✓
                  </div>
                ) : (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full border-2 border-white">
                    <X className="h-4 w-4" />
                  </div>
                )}
                {isEditing && (
                  <div className="absolute bottom-0 right-0 flex space-x-1">
                    <label className="bg-blue-600 text-white rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-colors">
                      <Camera className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageChange}
                        className="hidden"
                      />
                    </label>
                    {profileImage && (
                      <button
                        onClick={() => setProfileImage(null)}
                        className="bg-red-600 text-white rounded-full p-2 hover:bg-red-700 transition-colors"
                        title="Remove selected image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="relative w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center border-4 border-white shadow-lg">
                <User className="h-12 w-12 text-slate-400" />
                {isEditing && (
                  <div className="absolute bottom-0 right-0 flex space-x-1">
                    <label className="bg-blue-600 text-white rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-colors">
                      <Camera className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Tutor Name and Email - Below Profile Image */}
          <div className="text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-1">
              {user?.name || 'Tutor'}
            </h3>
            <p className="text-sm text-slate-600">
              {user?.email || ''}
            </p>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-4 mb-2">
            <h2 className="text-2xl font-bold text-slate-800">Your Profile</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-green-800">Approved Subjects</p>
              <p className="text-lg font-bold text-green-600">{profile.subjects.length}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-green-800">Rating</p>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                {renderStars(profile.rating)}
              </div>
              <span className="text-sm text-slate-600">
                {profile.total_reviews > 0 ? profile.rating.toFixed(1) : 'No ratings yet'}
              </span>
            </div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-purple-800">Reviews</p>
              <p className="text-lg font-bold text-purple-600">{profile.total_reviews}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Bio Section */}
      <Card className="p-5">
        <h2 className="text-xl font-semibold mb-3 flex items-center">
          <User className="h-5 w-5 mr-2 text-blue-600" />
          Bio & Description
        </h2>
        
        {isEditing ? (
          <>
            <textarea
              className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
              rows={4}
              placeholder="Tell students about your teaching experience, specialties, and approach..."
              value={profile.bio}
              onChange={(e) => {
                const filtered = e.target.value.replace(/[^A-Za-z\s]/g, '');
                handleInputChange('bio', filtered);
              }}
            />
            {profile.bio && /[^A-Za-z\s]/.test(profile.bio) && (
              <p className="text-xs text-red-600 mt-1">Bio can contain letters and spaces only.</p>
            )}
          </>
        ) : (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            {profile.bio ? (
              <p className="text-slate-700 whitespace-pre-wrap">{profile.bio}</p>
            ) : (
              <p className="text-slate-500 italic">No bio added yet. Click "Edit Profile" to add one.</p>
            )}
          </div>
        )}
      </Card>

      {/* Subjects Section */}
      <Card className="p-5">
        <h2 className="text-xl font-semibold mb-3 flex items-center">
          <Star className="h-5 w-5 mr-2 text-blue-600" />
          Approved Subjects of Expertise
        </h2>
        <div className="flex flex-wrap gap-2">
          {profile.subjects.map((subject, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center space-x-1"
            >
              <CheckCircle className="h-3 w-3" />
              <span>{subject}</span>
            </span>
          ))}
          {profile.subjects.length === 0 && (
            <div className="w-full text-center py-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-yellow-800 font-medium">No approved subjects yet</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Your subject expertise applications are being reviewed by our admin team.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Only subjects approved by our admin team will appear here. 
            To add new subjects or check the status of your applications, go to the Application & Verification section.
          </p>
        </div>
      </Card>

      {/* Payment Information */}
      <Card className="p-5">
        <h2 className="text-xl font-semibold mb-3 flex items-center">
          <CreditCard className="h-5 w-5 mr-2 text-green-600" />
          Payment Information
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              GCash Number
            </label>
            {isEditing ? (
              <>
                <input
                  type="text"
                  className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                  placeholder="09XX XXX XXXX"
                  value={profile.gcash_number}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, '');
                    // Enforce max length 11
                    const limited = digits.slice(0, 11);
                    handleInputChange('gcash_number', limited);
                  }}
                />
                {profile.gcash_number && (!/^09\d{9}$/.test(profile.gcash_number) || profile.gcash_number.length !== 11) && (
                  <p className="text-xs text-red-600 mt-1">GCash number must be 11 digits, start with 09.</p>
                )}
              </>
            ) : (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-slate-700">
                  {profile.gcash_number || 'No GCash number added yet'}
                </p>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              GCash QR Code
            </label>
            {isEditing ? (
              <div>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGcashQRChange}
                    className="flex-1 border-2 border-slate-300 rounded-lg px-3 py-2 bg-white shadow-sm"
                  />
                  {gcashQR && (
                    <button
                      onClick={() => setGcashQR(null)}
                      className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors"
                      title="Remove selected QR code"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {gcashQR && (
                  <p className="text-sm text-slate-600 mt-1">Selected: {gcashQR.name}</p>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                {gcashQR ? (
                  <img
                    src={URL.createObjectURL(gcashQR)}
                    alt="GCash QR Preview"
                    className="w-32 h-32 object-contain border border-slate-200 rounded bg-white"
                  />
                ) : profile.gcash_qr ? (
                  <img
                    src={getFileUrl(profile.gcash_qr)}
                    alt="GCash QR Code"
                    className="w-32 h-32 object-contain border border-slate-200 rounded bg-white"
                  />
                ) : (
                  <p className="text-slate-500 italic">No GCash QR code uploaded yet</p>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Recent Reviews */}
      {profile.total_reviews > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Student Feedback</h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <div className="flex items-center space-x-1">
                {renderStars(profile.rating)}
              </div>
              <span className="font-medium text-yellow-800">
                {profile.rating.toFixed(1)} out of 5.0
              </span>
            </div>
            <p className="text-sm text-yellow-700">
              Based on {profile.total_reviews} student review{profile.total_reviews !== 1 ? 's' : ''}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ProfileSetup;