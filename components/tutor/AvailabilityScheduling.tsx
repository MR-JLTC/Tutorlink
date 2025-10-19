import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { Calendar, Edit, Save, X, AlertCircle } from 'lucide-react';

interface DayAvailability {
  available: boolean;
  startTime: string;
  endTime: string;
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
  // Removed change request feature as redundant

  // Set tutorId from logged-in user
  useEffect(() => {
    if (user?.user_id) {
      setTutorId(user.user_id);
    }
  }, [user]);

  // After tutorId is set/changes, fetch current availability and change requests
  useEffect(() => {
    if (!tutorId) return;
    fetchCurrentAvailability();
  }, [tutorId]);

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

  // Change request helpers removed

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Availability Scheduling</h1>
          <p className="text-slate-600">Manage your weekly availability and update schedule anytime</p>
        </div>
        <div className="flex space-x-3">
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

        {/* Removed editing mode info banner */}
      </Card>

      {/* Change request feature removed */}

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