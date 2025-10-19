import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { Calendar, Clock, Edit, Save, X, AlertCircle } from 'lucide-react';

interface DayAvailability {
  available: boolean;
  startTime: string;
  endTime: string;
}

interface AvailabilityChangeRequest {
  id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  admin_notes?: string;
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const AvailabilityScheduling: React.FC = () => {
  const { user } = useAuth();
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>(
    daysOfWeek.reduce((acc, day) => {
      acc[day] = { available: false, startTime: '09:00', endTime: '17:00' };
      return acc;
    }, {} as Record<string, DayAvailability>)
  );
  const [isEditing, setIsEditing] = useState(false);
  const [changeRequests, setChangeRequests] = useState<AvailabilityChangeRequest[]>([]);
  const [showChangeRequestForm, setShowChangeRequestForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [changeReason, setChangeReason] = useState('');

  useEffect(() => {
    if (user?.user_id) {
      setTutorId(user.user_id);
      fetchCurrentAvailability();
      fetchChangeRequests();
    }
  }, [user]);

  const fetchCurrentAvailability = async () => {
    if (!tutorId) return;
    try {
      const response = await apiClient.get(`/tutors/${tutorId}/availability`);
      const slots = response.data;
      
      const newAvailability = { ...availability };
      slots.forEach((slot: any) => {
        newAvailability[slot.day_of_week] = {
          available: true,
          startTime: slot.start_time,
          endTime: slot.end_time
        };
      });
      
      setAvailability(newAvailability);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
    }
  };

  const fetchChangeRequests = async () => {
    if (!tutorId) return;
    try {
      const response = await apiClient.get(`/tutors/${tutorId}/availability-change-requests`);
      setChangeRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch change requests:', error);
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

  const saveAvailability = async () => {
    if (!tutorId) {
      alert('Tutor not found.');
      return;
    }

    try {
      const slots = Object.entries(availability)
        .filter(([, d]) => d.available)
        .map(([day, d]) => ({ 
          day_of_week: day, 
          start_time: d.startTime, 
          end_time: d.endTime 
        }));

      await apiClient.post(`/tutors/${tutorId}/availability`, { slots });
      setIsEditing(false);
      alert('Availability updated successfully!');
    } catch (error) {
      console.error('Failed to save availability:', error);
      alert('Failed to save availability. Please try again.');
    }
  };

  const submitChangeRequest = async () => {
    if (!tutorId || !selectedDay || !newStartTime || !newEndTime || !changeReason.trim()) {
      alert('Please fill in all fields.');
      return;
    }

    try {
      await apiClient.post(`/tutors/${tutorId}/availability-change-request`, {
        day_of_week: selectedDay,
        start_time: newStartTime,
        end_time: newEndTime,
        reason: changeReason.trim()
      });

      alert('Change request submitted successfully! Awaiting admin approval.');
      setShowChangeRequestForm(false);
      setSelectedDay('');
      setNewStartTime('');
      setNewEndTime('');
      setChangeReason('');
      fetchChangeRequests();
    } catch (error) {
      console.error('Failed to submit change request:', error);
      alert('Failed to submit change request. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50 border-green-200';
      case 'rejected': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <Clock className="h-4 w-4" />;
      case 'rejected': return <X className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Availability Scheduling</h1>
          <p className="text-slate-600">Manage your weekly availability and request schedule changes</p>
        </div>
        <div className="flex space-x-3">
          <Button 
            variant="secondary"
            onClick={() => setShowChangeRequestForm(true)}
            className="flex items-center space-x-2"
          >
            <Edit className="h-4 w-4" />
            <span>Request Change</span>
          </Button>
          {isEditing ? (
            <Button onClick={saveAvailability} className="flex items-center space-x-2">
              <Save className="h-4 w-4" />
              <span>Save Changes</span>
            </Button>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="flex items-center space-x-2">
              <Edit className="h-4 w-4" />
              <span>Edit Schedule</span>
            </Button>
          )}
        </div>
      </div>

      {/* Current Schedule */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-blue-600" />
            Current Weekly Schedule
          </h2>
          {isEditing && (
            <div className="flex space-x-2">
              <Button variant="secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {daysOfWeek.map(day => (
            <div 
              key={day} 
              className={`grid grid-cols-1 md:grid-cols-3 items-center gap-4 p-4 border rounded-lg transition-all ${
                availability[day].available 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={availability[day].available}
                  onChange={() => handleAvailabilityToggle(day)}
                  disabled={!isEditing}
                />
                <span className="font-medium text-slate-800 w-24">{day}</span>
              </label>
              
              <div className={`flex items-center gap-2 md:col-span-2 ${
                !availability[day].available || !isEditing ? 'opacity-50' : ''
              }`}>
                <input
                  type="time"
                  value={availability[day].startTime}
                  onChange={(e) => handleTimeChange(day, 'startTime', e.target.value)}
                  disabled={!availability[day].available || !isEditing}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-slate-500 font-medium">to</span>
                <input
                  type="time"
                  value={availability[day].endTime}
                  onChange={(e) => handleTimeChange(day, 'endTime', e.target.value)}
                  disabled={!availability[day].available || !isEditing}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          ))}
        </div>

        {isEditing && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">Editing Mode</p>
                <p className="text-sm text-blue-600 mt-1">
                  Make your changes and click "Save Changes" to update your availability. 
                  For major schedule changes, consider using the "Request Change" feature for admin approval.
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Change Request Form */}
      {showChangeRequestForm && (
        <Card className="p-6 border-2 border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-orange-800">Request Schedule Change</h3>
            <button
              onClick={() => setShowChangeRequestForm(false)}
              className="text-slate-500 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Day of Week
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
              >
                <option value="">Select a day...</option>
                {daysOfWeek.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  New Start Time
                </label>
                <input
                  type="time"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  New End Time
                </label>
                <input
                  type="time"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Reason for Change
              </label>
              <textarea
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                rows={3}
                placeholder="Please explain why you need this schedule change (e.g., hectic schedule, personal commitments, etc.)"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
              />
            </div>
            
            <div className="flex space-x-3">
              <Button onClick={submitChangeRequest}>
                Submit Request
              </Button>
              <Button variant="secondary" onClick={() => setShowChangeRequestForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Change Requests History */}
      {changeRequests.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Schedule Change Requests</h2>
          <div className="space-y-3">
            {changeRequests.map(request => (
              <div key={request.id} className="p-4 bg-slate-50 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="font-medium text-slate-800">{request.day_of_week}</span>
                    <span className="text-slate-600">
                      {request.start_time} - {request.end_time}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(request.status)}
                        <span>{request.status.charAt(0).toUpperCase() + request.status.slice(1)}</span>
                      </div>
                    </span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {new Date(request.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="text-sm text-slate-600 mb-2">
                  <strong>Reason:</strong> {request.reason}
                </div>
                
                {request.admin_notes && (
                  <div className="text-sm text-slate-600 bg-white p-2 rounded border">
                    <strong>Admin Notes:</strong> {request.admin_notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Schedule Summary */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Schedule Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-800 mb-2">Available Days</h3>
            <p className="text-2xl font-bold text-blue-600">
              {Object.values(availability).filter(day => day.available).length}
            </p>
            <p className="text-sm text-blue-600">out of 6 days</p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-medium text-green-800 mb-2">Total Hours</h3>
            <p className="text-2xl font-bold text-green-600">
              {Object.values(availability)
                .filter(day => day.available)
                .reduce((total, day) => {
                  const start = new Date(`2000-01-01T${day.startTime}`);
                  const end = new Date(`2000-01-01T${day.endTime}`);
                  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                  return total + (hours > 0 ? hours : 0);
                }, 0)
                .toFixed(1)}
            </p>
            <p className="text-sm text-green-600">hours per week</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AvailabilityScheduling;