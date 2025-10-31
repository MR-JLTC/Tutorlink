import React, { useState, useMemo, useEffect } from 'react';
import Logo from '../../components/Logo';
import apiClient from '../../services/api';
import { Page } from '../../types';
// Subjects now fetched from backend
import { CheckCircleIcon } from '../../components/icons/CheckCircleIcon';
import { DocumentArrowUpIcon } from '../../components/icons/DocumentArrowUpIcon';
import { useToast } from '../../components/ui/Toast';
import * as nsfwjs from 'nsfwjs';

interface TimeSlot {
  startTime: string;
  endTime: string;
}

interface DayAvailability {
  slots: TimeSlot[];
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TutorRegistrationModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const TutorRegistrationPage: React.FC<TutorRegistrationModalProps> = ({ isOpen, onClose }) => {
  const { notify } = useToast();
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set<string>());
  const [warningModal, setWarningModal] = useState<{
    show: boolean;
    message: string;
    type: 'warning' | 'success';
  }>({ show: false, message: '', type: 'warning' });
  
  // Navigation handler placeholder (kept for type compatibility where used internally)
  const handleNavigate = (page: Page) => {};
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [universities, setUniversities] = useState<{ university_id: number; name: string; email_domain: string; status: string }[]>([]);
  const [universityId, setUniversityId] = useState<number | ''>('');
  const [emailDomainError, setEmailDomainError] = useState<string | null>(null);
  const [courses, setCourses] = useState<{ course_id: number; course_name: string; university_id: number }[]>([]);
  const [courseId, setCourseId] = useState<string>(''); // '' | 'other' | course_id as string
  const [courseInput, setCourseInput] = useState<string>('');
  const [subjectToAdd, setSubjectToAdd] = useState<string>('');
  const [availableSubjects, setAvailableSubjects] = useState<{ subject_id: number; subject_name: string }[]>([]);
  const [otherSubject, setOtherSubject] = useState('');
  const [subjectFilesMap, setSubjectFilesMap] = useState<Record<string, File[]>>({});
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [gcashQRImage, setGcashQRImage] = useState<File | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [bio, setBio] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [gcashNumber, setGcashNumber] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [sessionRate, setSessionRate] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [nsfwModel, setNsfwModel] = useState<any>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>({});
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    message: string;
    onConfirm: () => void;
  }>({ show: false, message: '', onConfirm: () => {} });

  const [dayToAdd, setDayToAdd] = useState<string>('');

  const addedDays = useMemo(() => Object.keys(availability), [availability]);
  const remainingDays = useMemo(() => daysOfWeek.filter(d => !addedDays.includes(d)), [addedDays]);

  const addDay = (day: string) => {
    if (!day) return;
    setAvailability(prev => ({ ...prev, [day]: { slots: [{ startTime: '09:00', endTime: '17:00' }] } }));
    setDayToAdd('');
  };

  const removeDay = (day: string) => {
    setConfirmModal({
      show: true,
      message: `Remove ${day} and all its time slots?`,
      onConfirm: () => {
        setAvailability(prev => {
          const next = { ...prev };
          delete next[day];
          return next;
        });
      }
    });
  };

  const [addingSlotFor, setAddingSlotFor] = useState<Record<string, boolean>>({});

  // --- Robust helpers & mutators for availability slots ---

  // Normalizes "H:M", "HH:MM:SS", etc. to "HH:MM"
  const normalizeTime = (raw: string) => {
    if (!raw) return raw;
    const trimmed = raw.trim();
    // keep only HH:MM (ignore seconds if present)
    const [hhmm] = trimmed.split('.');
    const parts = trimmed.split(':').map(p => p.replace(/\D/g, ''));
    const hh = parts[0] ? String(Number(parts[0])).padStart(2, '0') : '00';
    const mm = parts[1] ? String(Math.min(59, Number(parts[1]))).padStart(2, '0') : '00';
    return `${hh}:${mm}`;
  };

  const toMinutes = (time: string) => {
    const t = normalizeTime(time);
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const minutesToTime = (mins: number) => {
    const hh = Math.floor(mins / 60).toString().padStart(2, '0');
    const mm = (mins % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // true only when intervals actually intersect (adjacent allowed)
  const timesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
    const aS = toMinutes(aStart);
    const aE = toMinutes(aEnd);
    const bS = toMinutes(bStart);
    const bE = toMinutes(bEnd);
    return aS < bE && bS < aE;
  };

  // Search for an available slot using the CURRENT state inside caller, so here we accept existing slots explicitly
  const findNonOverlappingSlotFromExisting = (
    existingSlots: { startTime: string; endTime: string }[],
    durationMins = 60,
    earliestMinute = 7 * 60,
    latestMinute = 22 * 60,
    step = 15
  ) => {
    for (let start = earliestMinute; start + durationMins <= latestMinute; start += step) {
      const end = start + durationMins;
      const cand = { startTime: minutesToTime(start), endTime: minutesToTime(end) };
      const conflict = existingSlots.some(s => timesOverlap(s.startTime, s.endTime, cand.startTime, cand.endTime));
      if (!conflict) return cand;
    }
    return null;
  };

  // Add slot (validated against latest state inside updater)
  const addTimeSlot = (day: string, durationMins = 60) => {
    if (!day) return;
    setAvailability(prev => {
      const next = { ...prev };
      const current = next[day] ? { slots: [...next[day].slots] } : { slots: [] };

      // normalize existing times
      current.slots = current.slots.map(s => ({
        startTime: normalizeTime(s.startTime),
        endTime: normalizeTime(s.endTime)
      }));

      const candidate = findNonOverlappingSlotFromExisting(current.slots, durationMins);
      if (!candidate) {
        notify('No available non-overlapping slot could be found for that day.', 'error');
        return prev;
      }

      // add and sort
      current.slots.push(candidate);
      current.slots.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
      next[day] = current;
      return next;
    });
  };

  // Update a slot time safely (validated inside updater)
  const updateSlotTime = (day: string, index: number, type: 'startTime' | 'endTime', rawValue: string) => {
    const value = normalizeTime(rawValue);
    setAvailability(prev => {
      const next = { ...prev };
      const current = next[day];
      if (!current) return prev;

      // clone and normalize
      const slots = current.slots.map(s => ({ startTime: normalizeTime(s.startTime), endTime: normalizeTime(s.endTime) }));

      if (index < 0 || index >= slots.length) return prev;

      slots[index] = { ...slots[index], [type]: value };

      const sMin = toMinutes(slots[index].startTime);
      const eMin = toMinutes(slots[index].endTime);
      if (eMin <= sMin) {
        // invalid end before/equals start -> keep state unchanged, show error
        notify('End time must be after start time', 'error');
        return prev;
      }

      // validate against other slots (do not compare against itself)
      for (let i = 0; i < slots.length; i++) {
        if (i === index) continue;
        if (timesOverlap(slots[index].startTime, slots[index].endTime, slots[i].startTime, slots[i].endTime)) {
          notify('This time overlaps with another slot. Please choose a different time.', 'error');
          return prev;
        }
      }

      // If valid, apply, sort, and return new state
      slots.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
      next[day] = { slots };
      return next;
    });
  };


  const removeTimeSlot = (day: string, index: number) => {
    setConfirmModal({
      show: true,
      message: 'Remove this time slot?',
      onConfirm: () => {
        setAvailability(prev => {
          const next = { ...prev };
          const current = next[day];
          if (!current) return prev;
          current.slots = current.slots.filter((_, i) => i !== index);
          if (current.slots.length === 0) {
            delete next[day];
          } else {
            next[day] = current;
          }
          return next;
        });
      }
    });
  };

  // Load NSFWJS model
  useEffect(() => {
    const loadModel = async () => {
      try {
        console.log('Loading NSFWJS model...');
        const model = await nsfwjs.load();
        setNsfwModel(model);
        console.log('NSFWJS model loaded successfully');
      } catch (error) {
        console.error('Failed to load NSFWJS model:', error);
        notify('Failed to load image analysis model. Please refresh the page.', 'error');
      }
    };
    loadModel();
  }, []);

  // Fetch subjects based on selected university and course; lock when none selected
  useEffect(() => {
    (async () => {
      try {
        if (!universityId) {
          setAvailableSubjects([]);
          return;
        }
        const params: any = { university_id: universityId };
        if (courseId && courseId !== 'other') params.course_id = Number(courseId);
        const res = await apiClient.get(`/subjects`, { params });
        setAvailableSubjects(res.data || []);
      } catch (e) {
        setAvailableSubjects([]);
      }
    })();
  }, [universityId, courseId]);

  const normalizedSelected = useMemo(() => new Set(Array.from(selectedSubjects).map((s: string) => s.toLowerCase())), [selectedSubjects]);
  const otherSubjectExistsInDropdown = useMemo(() => {
    const trimmed = otherSubject.trim().toLowerCase();
    if (!trimmed) return false;
    return availableSubjects.some(s => s.subject_name.toLowerCase() === trimmed);
  }, [otherSubject, availableSubjects]);

  useEffect(() => {
    (async () => { 
      try {
        const res = await apiClient.get('/universities');
        // Filter to only include universities with "active" status
        const activeUniversities = (res.data || []).filter((uni: any) => uni.status === 'active');
        setUniversities(activeUniversities);
        const cr = await apiClient.get('/courses');
        // Normalize courses to always have university_id regardless of backend shape
        const normalized = (Array.isArray(cr.data) ? cr.data : []).map((c: any) => ({
          ...c,
          university_id: c?.university_id ?? c?.university?.university_id ?? c?.universityId ?? null,
        }));
        setCourses(normalized);
      } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    if (!email || !universityId) {
      setEmailDomainError(null);
      setIsEmailVerified(false);
      return;
    }
    const uni = universities.find(u => u.university_id === universityId);
    if (!uni) {
      setEmailDomainError(null);
      setIsEmailVerified(false);
      return;
    }
    const domain = email.split('@')[1] || '';
    if (!domain || domain.toLowerCase() !== uni.email_domain.toLowerCase()) {
      setEmailDomainError(`Email domain must be ${uni.email_domain}`);
      setIsEmailVerified(false);
    } else {
      setEmailDomainError(null);
      // Check if email is already verified
      checkEmailVerificationStatus(email);
    }
  }, [email, universityId, universities]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c: any) => {
      const uid = c?.university_id ?? c?.university?.university_id ?? c?.universityId;
      return !universityId || uid === universityId;
    });
  }, [courses, universityId]);

  // Auto-select course if the typed input matches an existing course in the dropdown (case-insensitive)
  useEffect(() => {
    const trimmed = courseInput.trim().toLowerCase();
    if (!trimmed || courseId) return;
    const match = filteredCourses.find(c => c.course_name.toLowerCase() === trimmed);
    if (match) {
      setCourseId(String(match.course_id));
    }
  }, [courseInput, courseId, filteredCourses]);

  // If university changes and current selected course no longer applies, reset selection and enable input
  useEffect(() => {
    if (!courseId || courseId === 'other') return;
    const stillValid = filteredCourses.some(c => String(c.course_id) === courseId);
    if (!stillValid) {
      setCourseId('');
      setCourseInput('');
    }
  }, [filteredCourses, courseId]);

  // If no university selected, lock course selection and clear any existing selection/input
  useEffect(() => {
    if (!universityId) {
      setCourseId('');
      setCourseInput('');
    }
  }, [universityId]);

  const handleAddSubject = () => {
    if (subjectToAdd && !selectedSubjects.has(subjectToAdd)) {
        setSelectedSubjects(prev => new Set(prev).add(subjectToAdd));
        setSubjectFilesMap(prev => ({ ...prev, [subjectToAdd]: prev[subjectToAdd] || [] }));
        setSubjectToAdd('');
    }
  };

  const handleAddOtherSubject = () => {
    const trimmedSubject = otherSubject.trim();
    if (trimmedSubject && !selectedSubjects.has(trimmedSubject)) {
        setSelectedSubjects(prev => new Set(prev).add(trimmedSubject));
        setSubjectFilesMap(prev => ({ ...prev, [trimmedSubject]: prev[trimmedSubject] || [] }));
        setOtherSubject('');
    }
  };

  const handleRemoveSubject = (subjectToRemove: string) => {
    setSelectedSubjects(prev => {
        const newSubjects = new Set(prev);
        newSubjects.delete(subjectToRemove);
        return newSubjects;
    });
    setSubjectFilesMap(prev => {
      const next = { ...prev };
      delete next[subjectToRemove];
      return next;
    });
  };

  // When available subjects change (due to university change), prune selections not in list
  useEffect(() => {
    if (!availableSubjects || availableSubjects.length === 0) {
      // If no university selected, clear selections
      if (!universityId && selectedSubjects.size > 0) {
        setSelectedSubjects(new Set());
      }
      return;
    }
    const names = new Set(availableSubjects.map(s => s.subject_name));
    setSelectedSubjects(prev => {
      const next = new Set<string>();
      prev.forEach(s => { if (names.has(s)) next.add(s); });
      return next;
    });
  }, [availableSubjects, universityId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const processedFiles: File[] = [];

      for (const file of files) {
        // Check if it's an image file
        if ((file as File).type.startsWith('image/')) {
          const isAppropriate = await analyzeImageContent(file as File);
          if (isAppropriate) {
            processedFiles.push(file as File);
          }
          // If inappropriate, skip the file (it's already rejected in analyzeImageContent)
        } else {
          // For non-image files (like PDFs), add them directly
          processedFiles.push(file as File);
        }
      }

      if (processedFiles.length > 0) {
        setUploadedFiles(prev => [...prev, ...processedFiles]);
        notify(`${processedFiles.length} file(s) uploaded successfully!`, 'success');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter((file: File) => {
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      const validExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      return validTypes.includes(file.type) || validExtensions.includes(fileExtension);
    });
    
    if (validFiles.length > 0) {
      const processedFiles: File[] = [];

      for (const file of validFiles) {
        // Check if it's an image file
        if ((file as File).type.startsWith('image/')) {
          const isAppropriate = await analyzeImageContent(file as File);
          if (isAppropriate) {
            processedFiles.push(file as File);
          }
          // If inappropriate, skip the file (it's already rejected in analyzeImageContent)
        } else {
          // For non-image files (like PDFs), add them directly
          processedFiles.push(file as File);
        }
      }

      if (processedFiles.length > 0) {
        setUploadedFiles(prev => [...prev, ...processedFiles]);
        notify(`${processedFiles.length} file(s) uploaded successfully!`, 'success');
      }
    }
  };

  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      // Check if it's an image file
      if (file.type.startsWith('image/')) {
        // First check if it's appropriate content (NSFWJS analysis)
        const isAppropriate = await analyzeImageContent(file);
        if (!isAppropriate) {
          e.target.value = '';
          return;
        }

        // Then check if it's NOT a QR code using stricter validation for profile images
        const isQRCode = await validateQRCodeForProfile(file);
        if (isQRCode) {
          notify('Profile images cannot be QR codes. Please upload a regular photo of yourself.', 'error');
          e.target.value = '';
          return;
        }

        setProfileImage(file);
        notify('Profile image uploaded successfully!', 'success');
      } else {
        notify('Please select a valid image file.', 'error');
        e.target.value = '';
      }
    }
  };

  const validateQRCodeForProfile = async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Create canvas to analyze the image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(false);
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // Analyze for QR code patterns
          let blackPixels = 0;
          let whitePixels = 0;
          let totalPixels = data.length / 4;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = (r + g + b) / 3;
            
            if (brightness < 128) {
              blackPixels++;
            } else {
              whitePixels++;
            }
          }

          const blackRatio = blackPixels / totalPixels;
          const whiteRatio = whitePixels / totalPixels;

          // Strict QR code detection for profile images:
          // 1. Must be very square (QR codes are square)
          const isSquare = Math.abs(img.width - img.height) / Math.max(img.width, img.height) < 0.15;
          
          // 2. Must have specific black/white balance (QR codes have distinct patterns)
          const isBalanced = blackRatio > 0.25 && blackRatio < 0.75 && whiteRatio > 0.25 && whiteRatio < 0.75;
          
          // 3. Must be mostly black and white (QR codes are not colorful)
          const isNotColorful = Math.abs(blackRatio - whiteRatio) < 0.5;
          
          // 4. Must have reasonable size
          const isReasonableSize = img.width >= 100 && img.width <= 2000 && img.height >= 100 && img.height <= 2000;
          
          // 5. Check for QR code corner patterns (strict)
          const hasQRPatterns = checkForQRPatterns(canvas, img.width, img.height);
          
          // 6. Must have both basic characteristics AND corner patterns (very strict)
          const hasQRCharacteristics = isSquare && isBalanced && isNotColorful && isReasonableSize;
          const isQRCode = hasQRCharacteristics && hasQRPatterns;

          console.log('Profile QR Code validation:', {
            blackRatio: blackRatio.toFixed(3),
            whiteRatio: whiteRatio.toFixed(3),
            isSquare,
            isBalanced,
            isNotColorful,
            isReasonableSize,
            hasQRPatterns,
            isQRCode,
            dimensions: `${img.width}x${img.height}`
          });

          resolve(isQRCode);
        } catch (error) {
          console.error('Error validating QR code for profile:', error);
          resolve(false);
        }
      };

      img.onerror = () => {
        console.error('Failed to load image for profile QR validation');
        resolve(false);
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const validateGCashQRCode = async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Create canvas to analyze the image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(false);
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // Analyze for QR code patterns
          let blackPixels = 0;
          let whitePixels = 0;
          let totalPixels = data.length / 4;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = (r + g + b) / 3;
            
            if (brightness < 128) {
              blackPixels++;
            } else {
              whitePixels++;
            }
          }

          const blackRatio = blackPixels / totalPixels;
          const whiteRatio = whitePixels / totalPixels;

          // Balanced QR code detection for GCash QR uploads:
          // 1. Must be roughly square (QR codes are square)
          const isSquare = Math.abs(img.width - img.height) / Math.max(img.width, img.height) < 0.25;
          
          // 2. Must have reasonable black/white balance (QR codes have patterns)
          const isBalanced = blackRatio > 0.2 && blackRatio < 0.8 && whiteRatio > 0.2 && whiteRatio < 0.8;
          
          // 3. Must be mostly black and white (QR codes are not colorful)
          const isNotColorful = Math.abs(blackRatio - whiteRatio) < 0.6;
          
          // 4. Must have reasonable size
          const isReasonableSize = img.width >= 80 && img.width <= 2500 && img.height >= 80 && img.height <= 2500;
          
          // 5. Check for QR code corner patterns
          const hasQRPatterns = checkForQRPatterns(canvas, img.width, img.height);
          
          // 6. Basic QR code characteristics
          const hasQRCharacteristics = isSquare && isBalanced && isNotColorful && isReasonableSize;
          
          // 7. Accept if it has basic characteristics OR corner patterns (more lenient)
          const isGCashQRCode = hasQRCharacteristics || hasQRPatterns;

          console.log('GCash QR Code validation:', {
            blackRatio: blackRatio.toFixed(3),
            whiteRatio: whiteRatio.toFixed(3),
            isSquare,
            isBalanced,
            isNotColorful,
            isReasonableSize,
            hasQRPatterns,
            isGCashQRCode,
            dimensions: `${img.width}x${img.height}`
          });

          resolve(isGCashQRCode);
        } catch (error) {
          console.error('Error validating GCash QR code:', error);
          resolve(false);
        }
      };

      img.onerror = () => {
        console.error('Failed to load image for GCash QR validation');
        resolve(false);
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const checkForQRPatterns = (canvas: HTMLCanvasElement, width: number, height: number): boolean => {
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      // Sample key areas where QR code corner markers should be
      const sampleSize = Math.min(width, height) * 0.15; // 15% of the smaller dimension
      const cornerSize = Math.floor(sampleSize);

      // Check top-left corner
      const topLeft = ctx.getImageData(0, 0, cornerSize, cornerSize);
      const topLeftPattern = analyzeCornerPattern(topLeft);

      // Check top-right corner
      const topRight = ctx.getImageData(width - cornerSize, 0, cornerSize, cornerSize);
      const topRightPattern = analyzeCornerPattern(topRight);

      // Check bottom-left corner
      const bottomLeft = ctx.getImageData(0, height - cornerSize, cornerSize, cornerSize);
      const bottomLeftPattern = analyzeCornerPattern(bottomLeft);

      // QR codes have distinctive corner markers - need at least 2 corners with strong patterns
      const cornerCount = [topLeftPattern, topRightPattern, bottomLeftPattern].filter(Boolean).length;
      const hasCornerMarkers = cornerCount >= 2;

      return hasCornerMarkers;
    } catch (error) {
      console.error('Error checking QR patterns:', error);
      return false;
    }
  };

  const analyzeCornerPattern = (imageData: ImageData): boolean => {
    const data = imageData.data;
    let blackPixels = 0;
    let whitePixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3;
      
      if (brightness < 128) {
        blackPixels++;
      } else {
        whitePixels++;
      }
    }

    const totalPixels = data.length / 4;
    const blackRatio = blackPixels / totalPixels;
    const whiteRatio = whitePixels / totalPixels;

    // QR corner markers have a specific pattern of black and white
    // They should have a good mix but not be too extreme in either direction
    // More strict: corner markers should have balanced black/white patterns
    const isBalancedCorner = blackRatio > 0.3 && blackRatio < 0.7 && whiteRatio > 0.3 && whiteRatio < 0.7;
    const hasGoodContrast = Math.abs(blackRatio - whiteRatio) < 0.4;
    
    return isBalancedCorner && hasGoodContrast;
  };

  const handleGcashQRImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      // Check if it's an image file
      if (file.type.startsWith('image/')) {
        // Only validate if it's a GCash QR code (no NSFWJS analysis needed)
        const isGCashQRCode = await validateGCashQRCode(file);
        if (isGCashQRCode) {
          setGcashQRImage(file);
          setWarningModal({
            show: true,
            message: 'GCash QR code uploaded successfully!',
            type: 'success'
          });
        } else {
          setWarningModal({
            show: true,
            message: 'Please upload a valid GCash QR code image. This doesn\'t appear to be a GCash QR code.',
            type: 'warning'
          });
          e.target.value = '';
        }
      } else {
        notify('Please select a valid image file.', 'error');
        e.target.value = '';
      }
    }
  };

  // Availability is now managed via addDay / removeDay / addTimeSlot / removeTimeSlot / updateSlotTime

  const checkEmailVerificationStatus = async (emailToCheck: string) => {
    if (!emailToCheck || !universityId) {
      setIsEmailVerified(false);
      return;
    }

    try {
      const response = await apiClient.get(`/auth/email-verification/status?email=${encodeURIComponent(emailToCheck)}&user_type=tutor`);
      if (response.data && response.data.is_verified === 1) {
        setIsEmailVerified(true);
      } else {
        setIsEmailVerified(false);
      }
    } catch (err) {
      // If API call fails, assume email is not verified
      setIsEmailVerified(false);
    }
  };

  const analyzeImageContent = async (file: File): Promise<boolean> => {
    if (!nsfwModel) {
      console.log('NSFWJS model not loaded yet');
      return false;
    }

    try {
      setIsAnalyzingImage(true);
      console.log('Analyzing image:', file.name);

      // Create image element
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      return new Promise((resolve) => {
        img.onload = async () => {
          try {
            // Set canvas dimensions
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw image to canvas
            ctx?.drawImage(img, 0, 0);

            // Get image data
            const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
            if (!imageData) {
              resolve(false);
              return;
            }

            // Analyze with NSFWJS
            const predictions = await nsfwModel.classify(imageData);
            console.log('NSFWJS predictions:', predictions);

            // Check for inappropriate content
            // NSFWJS returns probabilities for: Neutral, Drawing, Hentai, Porn, Sexy
            const [neutral, drawing, hentai, porn, sexy] = predictions;

            // Define balanced thresholds for inappropriate content
            const pornThreshold = 0.2; // 20% confidence threshold for porn
            const hentaiThreshold = 0.2; // 20% confidence threshold for hentai
            const sexyThreshold = 0.3; // 30% confidence threshold for sexy content (bikinis, suggestive poses)
            const drawingThreshold = 0.6; // 60% confidence threshold for drawings/memes/cartoons (more lenient)
            
            // Additional check: if sexy content is significantly higher than neutral, it's likely inappropriate
            const isSexySignificantlyHigher = sexy.probability > (neutral.probability + 0.2);
            
            // Check if it's clearly a drawing/meme/cartoon (not a professional photo)
            const isDrawingOrMeme = drawing.probability > drawingThreshold && drawing.probability > neutral.probability;
            
            // Additional manual checks for common inappropriate patterns
            const fileName = file.name.toLowerCase();
            const inappropriateKeywords = [
              // Inappropriate content
              'bikini', 'swimsuit', 'underwear', 'lingerie', 'nude', 'naked', 'sexy', 'hot',
              'beach', 'pool', 'vacation', 'selfie', 'mirror', 'bedroom', 'bathroom',
              // Memes and fun content
              'meme', 'funny', 'joke', 'lol', 'haha', 'comedy', 'humor', 'laugh',
              'party', 'drunk', 'alcohol', 'beer', 'wine', 'club', 'nightclub',
              'cartoon', 'anime', 'character', 'cosplay', 'costume',
              'game', 'gaming', 'gamer', 'console', 'playstation', 'xbox',
              'food', 'eating', 'restaurant', 'cooking', 'recipe',
              'pet', 'dog', 'cat', 'animal', 'cute', 'adorable',
              'nature', 'landscape', 'travel', 'trip', 'holiday',
              'sport', 'fitness', 'gym', 'workout', 'exercise',
              'music', 'concert', 'band', 'singer', 'artist',
              'movie', 'film', 'cinema', 'actor', 'actress',
              'social', 'instagram', 'facebook', 'snapchat', 'tiktok',
              // Additional meme and non-professional content
              'dank', 'epic', 'fail', 'win', 'awesome', 'cool', 'sick', 'fire',
              'reaction', 'face', 'expression', 'emotion', 'feeling',
              'text', 'caption', 'quote', 'saying', 'phrase',
              'template', 'blank', 'empty', 'space', 'background',
              'edit', 'edited', 'photoshop', 'filter', 'effect',
              'trending', 'viral', 'popular', 'famous', 'celebrity',
              'random', 'weird', 'strange', 'odd', 'bizarre',
              'wtf', 'omg', 'rofl', 'lmao', 'lmfao', 'stfu',
              'yolo', 'fomo', 'bae', 'fam', 'squad', 'goals'
            ];
            
            // Check for common meme file patterns
            const memePatterns = [
              /meme\d*\.(jpg|jpeg|png|gif)/i,
              /funny\d*\.(jpg|jpeg|png|gif)/i,
              /joke\d*\.(jpg|jpeg|png|gif)/i,
              /lol\d*\.(jpg|jpeg|png|gif)/i,
              /dank\d*\.(jpg|jpeg|png|gif)/i,
              /epic\d*\.(jpg|jpeg|png|gif)/i,
              /fail\d*\.(jpg|jpeg|png|gif)/i,
              /win\d*\.(jpg|jpeg|png|gif)/i,
              /reaction\d*\.(jpg|jpeg|png|gif)/i,
              /template\d*\.(jpg|jpeg|png|gif)/i
            ];
            
            const hasInappropriateKeyword = inappropriateKeywords.some(keyword => 
              fileName.includes(keyword)
            );
            
            const hasMemePattern = memePatterns.some(pattern => 
              pattern.test(fileName)
            );

            const isInappropriate = 
              porn.probability > pornThreshold ||
              hentai.probability > hentaiThreshold ||
              sexy.probability > sexyThreshold ||
              isSexySignificantlyHigher ||
              hasInappropriateKeyword ||
              isDrawingOrMeme;

            if (isInappropriate) {
              console.log('Inappropriate content detected:', {
                porn: porn.probability,
                hentai: hentai.probability,
                sexy: sexy.probability,
                neutral: neutral.probability,
                drawing: drawing.probability,
                isSexySignificantlyHigher: isSexySignificantlyHigher,
                hasInappropriateKeyword: hasInappropriateKeyword,
                isDrawingOrMeme: isDrawingOrMeme,
                fileName: fileName
              });
              setWarningModal({
                show: true,
                message: 'This image contains inappropriate content and cannot be uploaded. Please choose a different image.',
                type: 'warning'
              });
              resolve(false);
            } else {
              console.log('Image content is appropriate');
              setWarningModal({
                show: true,
                message: 'Nice! Your photo looks clean and good to go!',
                type: 'success'
              });
              resolve(true);
            }
          } catch (error) {
            console.error('Error analyzing image:', error);
            notify('Failed to analyze image content. Please try again.', 'error');
            resolve(false);
          } finally {
            setIsAnalyzingImage(false);
          }
        };

        img.onerror = () => {
          console.error('Failed to load image for analysis');
          notify('Failed to load image for analysis. Please try again.', 'error');
          setIsAnalyzingImage(false);
          resolve(false);
        };

        // Load image
        img.src = URL.createObjectURL(file);
      });
    } catch (error) {
      console.error('Error in image analysis:', error);
      setIsAnalyzingImage(false);
      notify('Failed to analyze image content. Please try again.', 'error');
      return false;
    }
  };

  const handleSendVerificationCode = async () => {
    if (!email || !universityId) {
      notify('Please enter email and select university first.', 'error');
      return;
    }
    if (emailDomainError) {
      notify(emailDomainError, 'error');
      return;
    }

    setIsSendingCode(true);
    setVerificationError('');

    try {
      console.log('Frontend: Sending verification code to:', email);
      const response = await apiClient.post('/auth/email-verification/send-code', { 
        email, 
        user_type: 'tutor' 
      });
      console.log('Frontend: Verification code response:', response.data);
      
      if (response.data) {
        setShowVerificationModal(true);
        notify('Verification code sent to your email!', 'success');
      }
    } catch (err: any) {
      console.log('Frontend: Verification code error:', err);
      const errorMessage = err.response?.data?.message || 'Failed to send verification code. Please try again.';
      setVerificationError(errorMessage);
      notify(errorMessage, 'error');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setVerificationError('Please enter the verification code');
      return;
    }

    setIsVerifyingCode(true);
    setVerificationError('');

    try {
      console.log('Frontend: Verifying code:', verificationCode);
      const response = await apiClient.post('/auth/email-verification/verify-code', { 
        email, 
        code: verificationCode,
        user_type: 'tutor'
      });
      console.log('Frontend: Verification response:', response.data);
      
      if (response.data) {
        setIsEmailVerified(true);
        setShowVerificationModal(false);
        setVerificationCode('');
        notify('Email verified successfully! You can now submit your application.', 'success');
      }
    } catch (err: any) {
      console.log('Frontend: Verification error:', err);
      const errorMessage = err.response?.data?.message || 'Invalid verification code. Please try again.';
      setVerificationError(errorMessage);
      notify(errorMessage, 'error');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleCloseVerificationModal = () => {
    setShowVerificationModal(false);
    setVerificationCode('');
    setVerificationError('');
  };
  
  const handleCloseTermsModal = () => {
    setShowTermsModal(false);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !universityId || !fullName.trim()) {
      notify('Please enter email, full name, password, and select your university.', 'error');
      return;
    }
    if (emailDomainError) {
      notify(emailDomainError, 'error');
      return;
    }
    if (!isEmailVerified) {
      notify('Please verify your email address before submitting the application.', 'error');
      return;
    }
    if (password.length < 7 || password.length > 21) {
      notify('Password must be between 7 and 21 characters.', 'error');
      return;
    }
    if (selectedSubjects.size === 0 || uploadedFiles.length === 0) {
      notify('Please select at least one subject and upload at least one document.', 'error');
      return;
    }
    // Ensure every subject has at least one supporting document
    const missingDocs = (Array.from(selectedSubjects) as string[]).filter((s: string) => !subjectFilesMap[s] || subjectFilesMap[s].length === 0);
    if (missingDocs.length > 0) {
      notify(`Please upload supporting document(s) for: ${missingDocs.join(', ')}`, 'error');
      return;
    }

    try {
      console.log('Starting tutor application submission...');
      console.log('Form data:', {
        email,
        full_name: fullName.trim(),
        university_id: Number(universityId),
        course_id: (courseId && courseId !== 'other') ? Number(courseId) : undefined,
        course_name: (courseId === 'other' && courseInput.trim().length > 0) ? courseInput.trim() : undefined,
        bio,
        year_level: Number(yearLevel), // Convert to number
        gcash_number: gcashNumber,
        SessionRatePerHour: sessionRate ? Number(sessionRate) : undefined,
        selectedSubjects: Array.from(selectedSubjects),
        uploadedFiles: uploadedFiles.length,
        profileImage: !!profileImage,
        gcashQRImage: !!gcashQRImage
      });

      // 1) Register the user as a tutor
      console.log('Step 1: Registering new tutor user...');
      const registerPayload = {
        name: fullName.trim(),
        email: email,
        password: password,
        user_type: 'tutor',
        university_id: Number(universityId),
        course_id: (courseId && courseId !== 'other') ? Number(courseId) : undefined,
        course_name: (courseId === 'other' && courseInput.trim().length > 0) ? courseInput.trim() : undefined,
        bio: bio,
        year_level: Number(yearLevel), // Convert to number
        gcash_number: gcashNumber,
        SessionRatePerHour: sessionRate ? Number(sessionRate) : undefined,
      };

      const registrationResponse = await apiClient.post('/auth/register', registerPayload);
      const newTutorId = registrationResponse.data.user.tutor_profile?.tutor_id;
      
      if (!newTutorId) throw new Error('Could not get tutor ID after registration');
      console.log('New Tutor User Registered with ID:', newTutorId);

      // Use newTutorId for subsequent steps
      const tutorId = newTutorId;

      // 2) Upload profile image (optional) or set placeholder
      console.log('Step 2: Handling profile image...');
      if (profileImage) {
        console.log('Uploading profile image...');
        const pf = new FormData();
        pf.append('file', profileImage);
        await apiClient.post(`/tutors/${tutorId}/profile-image`, pf, { headers: { 'Content-Type': 'multipart/form-data' } });
        console.log('Profile image uploaded successfully');
      } else {
        console.log('Setting placeholder profile image...');
        await apiClient.post(`/tutors/${tutorId}/profile-image-placeholder`);
        console.log('Placeholder profile image set');
      }

      // 3) Upload GCash QR image (optional) or set placeholder
      console.log('Step 3: Handling GCash QR image...');
      if (gcashQRImage) {
        console.log('Uploading GCash QR image...');
        const gcashForm = new FormData();
        gcashForm.append('file', gcashQRImage);
        await apiClient.post(`/tutors/${tutorId}/gcash-qr`, gcashForm, { headers: { 'Content-Type': 'multipart/form-data' } });
        console.log('GCash QR image uploaded successfully');
      } else {
        console.log('Setting placeholder GCash QR...');
        await apiClient.post(`/tutors/${tutorId}/gcash-qr-placeholder`);
        console.log('Placeholder GCash QR set');
      }

      // 4) Upload documents
      console.log('Step 4: Uploading documents...');
      const form = new FormData();
      uploadedFiles.forEach(f => form.append('files', f));
      await apiClient.post(`/tutors/${tutorId}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      console.log('Documents uploaded successfully');

      // 5) Save availability
      console.log('Step 5: Saving availability...');
      const slots = Object.entries(availability).flatMap(([day, d]) => {
        const dayObj = d as DayAvailability;
        return dayObj.slots.map(s => ({ day_of_week: day, start_time: s.startTime, end_time: s.endTime }));
      });
      console.log('Availability slots:', slots);
      await apiClient.post(`/tutors/${tutorId}/availability`, { slots });
      console.log('Availability saved successfully');

      // 6) Save subjects
      console.log('Step 6: Saving subjects...');
      const subjectsArray: string[] = Array.from(selectedSubjects) as string[];
      console.log('Selected subjects:', subjectsArray);
      await apiClient.post(`/tutors/${tutorId}/subjects`, { subjects: subjectsArray });
      console.log('Subjects saved successfully');

      // 7) Upload supporting documents per subject
      console.log('Step 7: Uploading subject supporting documents...');
      for (const subject of subjectsArray) {
        const files = subjectFilesMap[subject] || [];
        const form = new FormData();
        files.forEach(f => form.append('files', f));
        await apiClient.post(`/tutors/${tutorId}/subjects/${encodeURIComponent(subject)}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        console.log(`Uploaded documents for subject: ${subject}`);
      }

      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Submission error:', err);
      console.error('Error response:', err?.response?.data);
      console.error('Error status:', err?.response?.status);
      
      const message = err?.response?.data?.message || err?.message || 'Failed to submit application';
      
      // Use the notify function from useToast hook
      if (typeof message === 'string' && message.toLowerCase().includes('email already registered')) {
        notify('Email already registered', 'error');
      } else {
        notify(message, 'error');
      }
    }
  };

  const isModalOpen = typeof isOpen === 'boolean' ? isOpen : true;
  const handleCloseModal = () => {
    if (onClose) return onClose();
    try { window.history.back(); } catch {}
  };

  if (!isModalOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 animate-[fadeIn_200ms_ease-out]" role="dialog" aria-modal="true">
        <div className="w-full max-w-5xl bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 overflow-hidden transform transition-all duration-300 ease-out animate-[slideUp_240ms_ease-out]">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/70 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-3">
              <Logo className="h-14 w-14" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Tutor Application</h1>
                <p className="text-slate-600 text-xs sm:text-sm">Share your expertise and start earning.</p>
              </div>
            </div>
            <button aria-label="Close" onClick={handleCloseModal} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="max-h-[85vh] overflow-y-auto px-4 sm:px-5 py-5 bg-gradient-to-br from-indigo-50/40 to-sky-50/40">
            {isSubmitted ? (
              <div className="max-w-md mx-auto text-center bg-white p-8 rounded-xl shadow-lg">
                <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto" />
                <h2 className="text-2xl font-bold text-slate-800 mt-4">Application Submitted!</h2>
                <p className="text-slate-600 mt-2">
                  Thank you for your application. Our team will review your submitted documents. You will be notified once approved.
                </p>
                <button onClick={onClose} className="mt-6 w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors">Close</button>
              </div>
            ) : (
            <div className="w-full bg-white/80 backdrop-blur-lg p-4 sm:p-5 rounded-2xl shadow-xl border border-white/50">
        <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
          {/* Account Info */}
          <div className="space-y-5 mb-6">
            {/* Email Verification Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email Verification
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="max-w-lg">
                  <label className="block text-slate-700 font-semibold mb-2">Email Address</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    disabled={!universityId}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                      emailDomainError ? 'border-red-400 bg-red-50' : 
                      !universityId ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed' : 
                      'border-slate-300'
                    }`} 
                    placeholder={!universityId ? "Select a university first" : "Enter your university email"}
                    required 
                  />
                  {!universityId && (
                    <p className="text-sm text-slate-500 mt-2 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Please select a university first to enter your email
                    </p>
                  )}
                  {emailDomainError && <p className="text-sm text-red-600 mt-2 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 000 16zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {emailDomainError}
                  </p>}
                </div>
                
                <div className="w-full max-w-3xl">
                  <label className="block text-slate-700 font-semibold mb-2">University</label>
                  <select 
                    className="w-full min-w-[40ch] px-4 py-3 border border-slate-300 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white" 
                    value={universityId} 
                    onChange={(e) => setUniversityId(e.target.value ? Number(e.target.value) : '')} 
                    required
                  >
                    <option value="">Select University</option>
                    {universities.map(u => (
                      <option key={u.university_id} value={u.university_id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Verification Status and Button */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center">
                  {isEmailVerified ? (
                    <div className="flex items-center text-green-700">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">
                        Email Verified Successfully!
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center text-slate-600">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span>Email verification required to submit application</span>
                    </div>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={handleSendVerificationCode}
                  disabled={!email || !universityId || emailDomainError || isSendingCode || isEmailVerified}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform ${
                    isEmailVerified
                      ? 'bg-green-100 text-green-800 border-2 border-green-300 cursor-default' 
                      : !email || !universityId || emailDomainError
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 shadow-lg hover:shadow-xl'
                  }`}
                  title={
                    isEmailVerified
                      ? 'Email verified ✓' 
                      : !email || !universityId 
                      ? 'Enter email and select university first'
                      : emailDomainError
                      ? 'Fix email domain error first'
                      : 'Send verification code'
                  }
                >
                  {isSendingCode ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending Code...
                    </div>
                  ) : isEmailVerified ? (
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Verified ✓
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Verification Code
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Other Account Fields */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-6 bg-white rounded-xl border border-slate-200 shadow-sm items-start">
              <div className="max-w-lg md:col-span-8">
                <label className="block text-slate-700 font-semibold mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={fullName} 
                  onChange={(e) => {
                    const next = e.target.value.replace(/[^A-Za-z\-\s]/g, '').slice(0, 60);
                    setFullName(next);
                  }} 
                  className="w-full py-2 pl-4 pr-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Enter your full name"
                  required 
                />
              </div>
              
              <div className="max-w-sm md:col-span-4">
                <label className="block text-slate-700 font-semibold mb-1">Password</label>
                <div className="relative w-fit">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value.slice(0, 21))} 
                    minLength={7} 
                    maxLength={21} 
                    autoComplete="new-password"
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    style={{
                      WebkitAppearance: 'none',
                      MozAppearance: 'textfield'
                    }}
                    required 
                    className="w-[27ch] py-2 pl-4 pr-12 border border-slate-300 rounded-lg [&::-webkit-credentials-auto-fill-button]:!hidden [&::-ms-reveal]:hidden [&::-webkit-strong-password-auto-fill-button]:!hidden"
                    placeholder="Desired Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10" 
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L6.228 6.228" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="max-w-3xl md:col-span-12">
                <label className="block text-slate-700 font-semibold mb-1">Course</label>
                <div className={`flex ${courseId === 'other' ? 'flex-col' : 'flex-col md:flex-row'} gap-3 items-start w-full`}>
                  <select
                    className={`flex-1 min-w-0 px-4 py-2 border rounded-lg ${!universityId ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-300'}`}
                    value={courseId}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === 'other') {
                        setCourseId('other');
                      } else {
                        const value = raw ? Number(raw) : '';
                        setCourseId(value);
                        if (value !== '' ) setCourseInput('');
                      }
                    }}
                    disabled={!universityId}
                    title={!universityId ? 'Select a university first' : undefined}
                  >
                  <option value="">Select Course</option>
                  {filteredCourses.map(c => (
                    <option key={c.course_id} value={String(c.course_id)}>{c.course_name}</option>
                  ))}
                    <option value="other">Other</option>
                  </select>
                  {courseId === 'other' && (
                    <div className="flex-1 min-w-0 md:flex-[1.2] max-w-full md:max-w-lg">
                      <label htmlFor="course-input" className="block text-slate-600 text-sm mb-1 sm:sr-only">Custom course</label>
                      <input
                        id="course-input"
                        type="text"
                        value={courseInput}
                        onChange={(e) => setCourseInput(e.target.value)}
                        placeholder="e.g., BS Astrophysics"
                        className="w-full px-4 py-2 border rounded-lg border-slate-300"
                      />
                    </div>
                  )}
                </div>
                {(courseId !== 'other' && courseId !== '') && universityId && (
                  <p className="text-xs text-slate-500 mt-1">Choose "Other" to enter a custom course.</p>
                )}
                {!courseId && !universityId && (
                  <p className="text-xs text-slate-500 mt-1">Select a university to enable course selection or manual input.</p>
                )}
              </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6 p-5 bg-white rounded-xl border border-slate-200 shadow-sm items-start">
            <div className="md:col-span-3">
              <label className="block text-slate-700 font-semibold mb-1">Year Level</label>
              <select 
                value={yearLevel} 
                onChange={(e) => setYearLevel(e.target.value)} 
                className="w-[18ch] px-3 py-2 border border-slate-300 rounded-lg"
                required
              >
                <option value="">Select Year Level</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
                <option value="5">5th Year</option>
                {/* <option value="Graduate">Graduate</option>
                <option value="Post-Graduate">Post-Graduate</option> */}
              </select>
            </div>
            <div className="md:col-span-5">
              <label className="block text-slate-700 font-semibold mb-1">GCash Number</label>
              <input 
                type="tel" 
                value={gcashNumber} 
                onChange={(e) => {
                  const value = e.target.value;
                  // Only allow numbers and limit to 11 digits
                  const numbersOnly = value.replace(/[^0-9]/g, '');
                  if (numbersOnly.length <= 11) {
                    setGcashNumber(numbersOnly);
                  }
                }} 
                className="w-[20ch] px-3 py-2 border border-slate-300 rounded-lg" 
                placeholder="09XXXXXXXXX"
                pattern="09[0-9]{9}"
                maxLength={11}
                required
              />
              <p className="text-xs text-slate-500 mt-1">Format: 09XXXXXXXXX (11 digits, numbers only)</p>
            </div>
            <div className="md:col-span-4">
              <label className="block text-slate-700 font-semibold mb-1">Session Rate (₱/hour)</label>
              <div className="relative w-[20ch]">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500">₱</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={sessionRate}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                    setSessionRate(cleaned);
                  }}
                  className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g., 350"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Typical range: ₱200 - ₱800</p>
            </div>
          </div>

          {/* Bio */}
          <div className="mb-6 max-w-4xl p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
            <label className="block text-slate-700 font-semibold mb-1">Your Bio (why you'd be a great tutor)</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500" placeholder="Share your peer-to-peer tutoring style, subjects you can help with, relevant study experience, and how you support fellow students." />
          </div>
          {/* Subjects of Expertise */}
          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
            <h2 className="block text-slate-700 font-semibold mb-2 text-lg">1. Subjects of Expertise</h2>
            <div className="flex flex-wrap gap-2 mb-4 min-h-[2.5rem] items-center">
              {Array.from(selectedSubjects).map((subject: string) => (
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

            {/* Per-subject supporting documents */}
            {selectedSubjects.size > 0 && (
              <div className="space-y-4 mb-6">
                {Array.from(selectedSubjects as Set<string>).map((subject: string) => (
                  <div key={`files-${subject}`} className="border rounded-lg p-3 bg-slate-50/50">
                    <label className="block text-slate-700 font-semibold mb-1">Supporting documents for: <span className="text-indigo-700">{subject}</span></label>
                    <p className="text-xs text-slate-500 mb-2">Upload proofs (PDF, PNG, JPG, JPEG). At least one file required.</p>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg,image/jpg"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length === 0) return;
                        setSubjectFilesMap((prev) => ({
                          ...prev,
                          [subject]: [...(prev[subject] || []), ...files],
                        }));
                        e.currentTarget.value = '';
                      }}
                      className="block w-full text-sm text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    {(subjectFilesMap[subject] || []).length > 0 && (
                      <ul className="mt-2 list-disc list-inside text-xs text-slate-600 space-y-1">
                        {(subjectFilesMap[subject] || []).map((f, idx) => (
                          <li key={`${subject}-f-${idx}`} className="flex items-center justify-between">
                            <span className="truncate mr-2">{f.name}</span>
                            <button
                              type="button"
                              className="text-red-600 hover:underline"
                              onClick={() => {
                                setSubjectFilesMap((prev) => {
                                  const next = { ...prev };
                                  const arr = [...(next[subject] || [])];
                                  arr.splice(idx, 1);
                                  next[subject] = arr;
                                  return next;
                                });
                              }}
                            >
                              remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex items-center gap-2 mb-4 max-w-3xl">
              <select
                value={subjectToAdd}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSubjectToAdd(e.target.value)}
                className={`flex-grow w-full px-4 py-2 border rounded-lg focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 ${!universityId ? 'border-slate-500 bg-slate-600/70 text-white/60 cursor-not-allowed' : 'border-slate-600 bg-slate-700 text-white'}`}
                aria-label="Select a subject to add"
                disabled={!universityId}
                title={!universityId ? 'Select a university first' : undefined}
              >
                <option value="">Select a subject...</option>
                {availableSubjects
                  .filter(s => !selectedSubjects.has(s.subject_name))
                  .map(s => <option key={s.subject_id} value={s.subject_name}>{s.subject_name}</option>)}
                <option value="other">Other</option>
              </select>
              <button
                type="button"
                onClick={handleAddSubject}
                disabled={!universityId || !subjectToAdd || subjectToAdd === 'other' || normalizedSelected.has(subjectToAdd.toLowerCase())}
                className="bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-600 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            {!universityId && (
              <p className="text-xs text-slate-500 mb-4">Select a university to view and add subjects.</p>
            )}
            {subjectToAdd === 'other' && (
              <div className="max-w-3xl">
                <label htmlFor="other-subject" className="block text-slate-600 text-sm mb-1">Not in the list? Add another subject:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    id="other-subject"
                    value={otherSubject}
                    onChange={(e) => setOtherSubject(e.target.value)}
                    placeholder="e.g., Astrophysics"
                    className={`flex-grow w-full px-4 py-2 border rounded-lg focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder-slate-400 ${!universityId ? 'border-slate-500 bg-slate-700/60 text-white/60 cursor-not-allowed' : 'border-slate-600 bg-slate-700 text-white'}`}
                    disabled={!universityId}
                    title={!universityId ? 'Select a university first' : undefined}
                  />
                  <button
                    type="button"
                    onClick={handleAddOtherSubject}
                    disabled={!universityId || subjectToAdd !== 'other' || !otherSubject.trim() || otherSubjectExistsInDropdown}
                    className="bg-slate-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                {otherSubjectExistsInDropdown && (
                  <p className="mt-1 text-xs text-red-300">Subject already exists. Please select it from the dropdown above.</p>
                )}
              </div>
            )}
          </div>


           {/* Availability Scheduling */}
          <div className="mt-8 p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
            <h2 className="block text-slate-700 font-semibold mb-2 text-lg">2. Weekly Availability</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <select
                  id="day-to-add"
                  value={dayToAdd}
                  onChange={(e) => setDayToAdd(e.target.value)}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select a day</option>
                  {remainingDays.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => addDay(dayToAdd)}
                  disabled={!dayToAdd}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${!dayToAdd ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                  Add
                </button>
              </div>

              {Object.keys(availability).length === 0 && (
                <p className="text-sm text-slate-500">No availability added yet. Click "Add Day" to begin.</p>
              )}

              <div className="space-y-3">
                {Object.entries(availability).map(([day, d]) => (
                  <div key={day} className="p-3 border rounded-lg bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-slate-800">{day}</div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => addTimeSlot(day)} className="text-sm px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-md">Add Time</button>
                        <button type="button" onClick={() => removeDay(day)} className="text-sm px-3 py-1 text-red-600 bg-red-50 hover:bg-red-100 rounded-md">Remove Day</button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {(d as DayAvailability).slots.map((slot, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => updateSlotTime(day, idx, 'startTime', e.target.value)}
                            className="px-2 py-1 border rounded-md text-sm"
                          />
                          <span className="text-slate-500">-</span>
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => updateSlotTime(day, idx, 'endTime', e.target.value)}
                            className="px-2 py-1 border rounded-md text-sm"
                          />
                          <button type="button" onClick={() => removeTimeSlot(day, idx)} className="ml-2 text-sm text-red-600">Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Document Upload */}
          <div className="mt-8 p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
            <h2 className="block text-slate-700 font-semibold mb-2 text-lg">3. Proof Documents</h2>
            <div className="mb-6">
              <label className="block text-slate-700 font-semibold mb-1">Profile Image (optional)</label>
              <input type="file" 
               accept="image/*" 
               onChange={handleProfileImageChange} 
               disabled={isAnalyzingImage}
               className={`w-full px-4 py-2 border border-slate-300 rounded-lg ${isAnalyzingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
               />
              {isAnalyzingImage && (
                <div className="flex items-center mt-2 text-blue-600">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm">Analyzing image content...</span>
                </div>
              )}
              {profileImage && <p className="text-xs text-slate-500 mt-1">Selected: {profileImage.name}</p>}
            </div>
            <div className="mb-6">
              <label className="block text-slate-700 font-semibold mb-1">GCash QR Code (optional)</label>
              <input type="file" 
               accept="image/*" 
               onChange={handleGcashQRImageChange} 
               disabled={isAnalyzingImage}
               className={`w-full px-4 py-2 border border-slate-300 rounded-lg ${isAnalyzingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
               />
              {isAnalyzingImage && (
                <div className="flex items-center mt-2 text-blue-600">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm">Analyzing image content...</span>
                </div>
              )}
              {gcashQRImage && <p className="text-xs text-slate-500 mt-1">Selected: {gcashQRImage.name}</p>}
              <p className="text-xs text-slate-500 mt-1">Upload your GCash QR code for payment processing</p>
            </div>
            {/* Supporting Documents Upload Section */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Supporting Documents <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-500">
                Upload valid supporting documents (e.g., transcript, student ID, certification) to verify your credibility as a tutor.
              </p>

              {/* Drag and Drop Area */}
              <div 
                className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors cursor-pointer"
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload-drag')?.click()}
              > 
                <div className="space-y-1 text-center">
                  <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-slate-400" />
                  <div className="text-sm text-slate-600">
                    <p>Drag and drop your files here</p>
                    <p className="text-xs text-slate-500 mt-1">or click to browse</p>
                  </div>
                  <p className="text-xs text-slate-500">PDF, DOCX, PNG, JPG, JPEG up to 10MB</p>
                  <input 
                    id="file-upload-drag"
                    type="file" 
                    className="sr-only" 
                    multiple 
                    accept=".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/jpg" 
                    onChange={handleFileChange} 
                  />
                </div>
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
          </div>
          
          <div className="pt-4">
            <div className="flex items-start gap-2 text-sm text-slate-700">
              <input
                id="accept-terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="accept-terms" className="leading-5">
                I have read and agree to the Tutor Terms and Conditions.
                <button type="button" className="ml-2 text-indigo-600 hover:text-indigo-700 underline" onClick={() => setShowTermsModal(true)}>Read Terms</button>
              </label>
            </div>
            <div className="sticky bottom-0 mt-3 bg-gradient-to-t from-white/80 to-transparent pt-3">
              <button 
                type="submit" 
                className={`w-full font-bold py-3 px-6 rounded-lg transition-colors ${
                  isEmailVerified && acceptedTerms
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                    : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                }`}
                disabled={!isEmailVerified || !acceptedTerms}
                title={!isEmailVerified ? 'Please verify your email first' : (!acceptedTerms ? 'Please read and accept the Terms and Conditions' : 'Submit your tutor application')}
              >
                {isEmailVerified ? 'Submit Application' : 'Verify Email to Submit'}
              </button>
            </div>
          </div>
        </form>
        
      </div>
      )}
      </div>
        </div>
      </div>

      {/* Email Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 max-w-md w-full relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600"></div>
            </div>

            <div className="relative z-10 p-6">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent mb-2">
                  Verify Your Email
                </h2>
                <p className="text-slate-600 text-sm">
                  We've sent a 6-digit verification code to <strong>{email}</strong>. Please check your email and enter the code below.
                </p>
              </div>

              {/* Error Message */}
              {verificationError && (
                <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium shadow-lg mb-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {verificationError}
                  </div>
                </div>
              )}

              {/* Verification Code Input */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="verification-code" className="block text-sm font-semibold text-slate-800 mb-2">
                    Verification Code
                  </label>
                  <input
                    id="verification-code"
                    type="text"
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setVerificationCode(value);
                    }}
                    placeholder="Enter 6-digit code"
                    className="w-full px-4 py-3 bg-white/95 backdrop-blur-sm border-2 border-slate-200 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 placeholder-slate-400 font-medium shadow-lg hover:shadow-xl text-center text-2xl tracking-widest"
                    maxLength={6}
                    autoComplete="off"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleVerifyCode}
                    disabled={!verificationCode.trim() || verificationCode.length !== 6 || isVerifyingCode}
                    className="flex-1 flex justify-center items-center py-3 px-6 border border-transparent rounded-lg shadow-2xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-700 hover:via-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-3xl relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    {isVerifyingCode ? (
                      <div className="flex items-center relative z-10">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm">Verifying...</span>
                      </div>
                    ) : (
                      <span className="relative z-10 flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Verify Code
                      </span>
                    )}
                  </button>
                  
                  <button
                    onClick={handleCloseVerificationModal}
                    className="px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                {/* Resend Code */}
                <div className="text-center">
                  <button
                    onClick={handleSendVerificationCode}
                    disabled={isSendingCode}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    {isSendingCode ? 'Sending...' : "Didn't receive the code? Resend"}
                  </button>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleCloseVerificationModal}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors z-10 pointer-events-auto"
              aria-label="Close verification"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 max-w-3xl w-full relative overflow-hidden">
            <div className="relative z-10 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Tutor Terms and Conditions</h2>
                <button type="button" onClick={handleCloseTermsModal} className="p-2 text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="max-h-[65vh] overflow-y-auto pr-1 text-slate-700 space-y-4">
                <p><strong>Effective Date:</strong> October 31, 2025</p>
                <p><strong>Platform Name:</strong> TutorLink (“the Platform”)</p>
                <h3 className="font-semibold">1. Overview</h3>
                <p>These Terms govern your participation as a Tutor on TutorLink. By joining and providing tutoring services, you agree to follow these rules and maintain professionalism throughout your use of the Platform.</p>
                <h3 className="font-semibold">2. Tutor Application</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Only qualified individuals may apply as tutors.</li>
                  <li>You must submit accurate personal and academic details for verification.</li>
                  <li>Uploading false, incomplete, or inappropriate documents is not allowed and may result in suspension or removal.</li>
                  <li>TutorLink reserves the right to approve or revoke tutor access at any time.</li>
                </ul>
                <h3 className="font-semibold">3. Profile and Availability</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Once approved, you must complete your profile with accurate information, subjects, and GCash details.</li>
                  <li>Keep your profile and schedule updated to ensure proper session bookings.</li>
                </ul>
                <h3 className="font-semibold">4. Session Handling</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Tutors may accept or decline session requests.</li>
                  <li>Once a session is completed, both parties must confirm it through TutorLink.</li>
                  <li>After confirmation, TutorLink will verify and process the tutor’s payment.</li>
                  <li>Any disputes will be reviewed by the platform’s admin team.</li>
                </ul>
                <h3 className="font-semibold">5. Payment</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>All payments are handled securely by TutorLink.</li>
                  <li>Tutors will receive their earnings after successful session verification.</li>
                  <li>A small service fee may be deducted for operational costs.</li>
                  <li>Payments are typically released within 3–5 business days.</li>
                  <li>Tutors must not request or accept payments outside the Platform.</li>
                </ul>
                <h3 className="font-semibold">6. Conduct and Responsibilities</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Act professionally and respectfully during sessions.</li>
                  <li>Provide accurate, relevant, and appropriate teaching materials.</li>
                  <li>Protect students’ personal and academic information.</li>
                  <li>Avoid uploading inappropriate or unrelated files.</li>
                  <li>Report any issues or concerns to TutorLink support.</li>
                  <li>Violations may lead to suspension, withholding of payments, or permanent removal.</li>
                </ul>
                <h3 className="font-semibold">7. Ratings and Feedback</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Tutees may leave ratings and feedback after each session.</li>
                  <li>Tutors must not manipulate or pressure tutees to alter reviews.</li>
                  <li>Constructive and professional engagement with feedback is encouraged.</li>
                </ul>
                <h3 className="font-semibold">8. Privacy and Security</h3>
                <p>TutorLink handles all tutor data and GCash information with confidentiality. Personal information is used only for verification, payment, and platform operations, following the Data Privacy Act of 2012.</p>
                <h3 className="font-semibold">9. Liability</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>TutorLink acts only as a facilitator and payment handler between tutors and tutees.</li>
                  <li>The Platform is not responsible for internet issues, GCash delays, or factors beyond its control.</li>
                  <li>TutorLink does not guarantee a fixed number of sessions or earnings.</li>
                </ul>
                <h3 className="font-semibold">10. Modifications</h3>
                <p>TutorLink may update these Terms anytime. Continued use of the Platform means you accept the revised version.</p>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={handleCloseTermsModal} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 max-w-md w-full relative overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Confirm Action</h3>
              <p className="text-slate-600 mb-6">{confirmModal.message}</p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setConfirmModal({ show: false, message: '', onConfirm: () => {} })}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal({ show: false, message: '', onConfirm: () => {} });
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Warning Modal */}
      {warningModal.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 max-w-md w-full relative overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                {warningModal.type === 'warning' ? (
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 text-center">
                {warningModal.type === 'warning' ? 'Warning' : 'Success'}
              </h3>
              <p className="text-slate-600 mb-6 text-center">{warningModal.message}</p>
              <div className="flex justify-center">
                <button
                  onClick={() => setWarningModal({ show: false, message: '', type: 'warning' })}
                  className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                    warningModal.type === 'warning' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
  </>
  );
};

export default TutorRegistrationPage;
export const TutorRegistrationModal = TutorRegistrationPage;