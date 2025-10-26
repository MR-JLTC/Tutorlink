import React, { useState, useMemo, useEffect } from 'react';
import apiClient from '../../services/api';
import { useNavigate } from 'react-router-dom';
// Subjects now fetched from backend
import { CheckCircleIcon } from '../../components/icons/CheckCircleIcon';
import { DocumentArrowUpIcon } from '../../components/icons/DocumentArrowUpIcon';
import { useToast } from '../../components/ui/Toast';
import * as nsfwjs from 'nsfwjs';

interface DayAvailability {
  available: boolean;
  startTime: string;
  endTime: string;
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TutorRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set<string>());
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [universities, setUniversities] = useState<{ university_id: number; name: string; email_domain: string; status: string }[]>([]);
  const [universityId, setUniversityId] = useState<number | ''>('');
  const [emailDomainError, setEmailDomainError] = useState<string | null>(null);
  const [courses, setCourses] = useState<{ course_id: number; course_name: string; university_id: number }[]>([]);
  const [courseId, setCourseId] = useState<number | ''>('');
  const [courseInput, setCourseInput] = useState<string>('');
  const [subjectToAdd, setSubjectToAdd] = useState<string>('');
  const [availableSubjects, setAvailableSubjects] = useState<{ subject_id: number; subject_name: string }[]>([]);
  const [otherSubject, setOtherSubject] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [gcashQRImage, setGcashQRImage] = useState<File | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [bio, setBio] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [gcashNumber, setGcashNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isEmailAlreadyVerified, setIsEmailAlreadyVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [nsfwModel, setNsfwModel] = useState<any>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>(
    daysOfWeek.reduce((acc, day) => {
      acc[day] = { available: false, startTime: '09:00', endTime: '17:00' };
      return acc;
    }, {} as Record<string, DayAvailability>)
  );

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
        if (courseId) params.course_id = courseId;
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
      setIsEmailAlreadyVerified(false);
      setIsEmailVerified(false);
      return;
    }
    const uni = universities.find(u => u.university_id === universityId);
    if (!uni) {
      setEmailDomainError(null);
      setIsEmailAlreadyVerified(false);
      setIsEmailVerified(false);
      return;
    }
    const domain = email.split('@')[1] || '';
    if (!domain || domain.toLowerCase() !== uni.email_domain.toLowerCase()) {
      setEmailDomainError(`Email domain must be ${uni.email_domain}`);
      setIsEmailAlreadyVerified(false);
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
      setCourseId(match.course_id);
    }
  }, [courseInput, courseId, filteredCourses]);

  // If university changes and current selected course no longer applies, reset selection and enable input
  useEffect(() => {
    if (!courseId) return;
    const stillValid = filteredCourses.some(c => c.course_id === courseId);
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
          notify('GCash QR code uploaded successfully!', 'success');
        } else {
          notify('Please upload a valid GCash QR code image. This doesn\'t appear to be a GCash QR code.', 'error');
          e.target.value = '';
        }
      } else {
        notify('Please select a valid image file.', 'error');
        e.target.value = '';
      }
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

  const checkEmailVerificationStatus = async (emailToCheck: string) => {
    if (!emailToCheck || !universityId) {
      setIsEmailAlreadyVerified(false);
      return;
    }

    try {
      const response = await apiClient.get(`/auth/email-verification/status?email=${encodeURIComponent(emailToCheck)}`);
      if (response.data && response.data.is_verified === 1) {
        setIsEmailAlreadyVerified(true);
        setIsEmailVerified(true);
      } else {
        setIsEmailAlreadyVerified(false);
        setIsEmailVerified(false);
      }
    } catch (err) {
      // If API call fails, assume email is not verified
      setIsEmailAlreadyVerified(false);
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
              notify('This image contains inappropriate content and cannot be uploaded. Please choose a different image.', 'error');
              resolve(false);
            } else {
              console.log('Image content is appropriate');
              notify('Nice! Your photo looks clean and good to go!', 'success');
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
      const response = await apiClient.post('/auth/email-verification/send-code', { email });
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
        code: verificationCode 
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
    if (password.length < 7 || password.length > 13) {
      notify('Password must be between 7 and 13 characters.', 'error');
      return;
    }
    if (selectedSubjects.size === 0 || uploadedFiles.length === 0) {
      notify('Please select at least one subject and upload at least one document.', 'error');
      return;
    }

    try {
      console.log('Starting tutor application submission...');
      console.log('Form data:', {
        email,
        full_name: fullName.trim(),
        university_id: Number(universityId),
        course_id: courseId ? Number(courseId) : undefined,
        course_name: !courseId && courseInput.trim().length > 0 ? courseInput.trim() : undefined,
        bio,
        year_level: yearLevel,
        gcash_number: gcashNumber,
        selectedSubjects: Array.from(selectedSubjects),
        uploadedFiles: uploadedFiles.length,
        profileImage: !!profileImage,
        gcashQRImage: !!gcashQRImage
      });

      // 1) Get existing user by email and update them
      console.log('Step 1: Getting existing user by email...');
      let tutorId;
      
      try {
        // Get existing user by email
        const existingUserRes = await apiClient.get(`/tutors/by-email/${encodeURIComponent(email)}`);
        const userId = existingUserRes.data?.user_id;
        const userType = existingUserRes.data?.user_type;
        
        if (!userId) throw new Error('Could not find existing user ID');
        console.log('Existing User ID:', userId, 'User Type:', userType);
        
        // Update existing user and create/update tutor profile
        console.log('Updating existing user to tutor...');
        const updateRes = await apiClient.put(`/tutors/update-existing-user/${userId}`, {
          full_name: fullName.trim(),
          university_id: Number(universityId),
          course_id: courseId ? Number(courseId) : undefined,
          course_name: !courseId && courseInput.trim().length > 0 ? courseInput.trim() : undefined,
          bio,
          year_level: yearLevel,
          gcash_number: gcashNumber,
        });
        
        tutorId = updateRes.data?.tutor_id;
        if (!tutorId) throw new Error('Could not get tutor ID after update');
        console.log('Updated Tutor ID:', tutorId);
        
        // Clear existing data before adding new data
        console.log('Clearing existing tutor data...');
        try {
          // Clear existing documents
          await apiClient.delete(`/tutors/${tutorId}/documents`);
          console.log('Existing documents cleared');
        } catch (clearError) {
          console.log('No existing documents to clear or error clearing:', clearError);
        }
        
        try {
          // Clear existing subjects
          await apiClient.delete(`/tutors/${tutorId}/subjects`);
          console.log('Existing subjects cleared');
        } catch (clearError) {
          console.log('No existing subjects to clear or error clearing:', clearError);
        }
        
        try {
          // Clear existing availability
          await apiClient.delete(`/tutors/${tutorId}/availability`);
          console.log('Existing availability cleared');
        } catch (clearError) {
          console.log('No existing availability to clear or error clearing:', clearError);
        }
      } catch (error: any) {
        console.error('Error updating existing user:', error);
        throw new Error('Could not find or update existing user account. Please contact support.');
      }

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
      const slots = Object.entries(availability)
        .filter(([, d]) => (d as any).available)
        .map(([day, d]) => ({ day_of_week: day, start_time: (d as any).startTime, end_time: (d as any).endTime }));
      console.log('Availability slots:', slots);
      await apiClient.post(`/tutors/${tutorId}/availability`, { slots });
      console.log('Availability saved successfully');

      // 6) Save subjects
      console.log('Step 6: Saving subjects...');
      const subjectsArray = Array.from(selectedSubjects);
      console.log('Selected subjects:', subjectsArray);
      await apiClient.post(`/tutors/${tutorId}/subjects`, { subjects: subjectsArray });
      console.log('Subjects saved successfully');

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

  if (isSubmitted) {
    return (
      <div className="min-h-[calc(100vh-68px)] flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full text-center bg-white p-10 rounded-xl shadow-lg">
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-3xl font-bold text-slate-800 mt-4">Application Submitted!</h2>
          <p className="text-slate-600 mt-2">
          Thank you for your application. Our team will review your submitted documents. Once approved, your account status will be marked as "Approved" in the Application and Verification section of your dashboard.
          </p>
          <button
            onClick={() => navigate('/LandingPage')}
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
          {/* Account Info */}
          <div className="space-y-6 mb-6">
            {/* Email Verification Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email Verification
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
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
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {emailDomainError}
                  </p>}
                </div>
                
                <div>
                  <label className="block text-slate-700 font-semibold mb-2">University</label>
                  <select 
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" 
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
                  {isEmailVerified || isEmailAlreadyVerified ? (
                    <div className="flex items-center text-green-700">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">
                        {isEmailAlreadyVerified ? 'Email Already Verified!' : 'Email Verified Successfully!'}
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
                  disabled={!email || !universityId || emailDomainError || isSendingCode || isEmailVerified || isEmailAlreadyVerified}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform ${
                    isEmailVerified || isEmailAlreadyVerified
                      ? 'bg-green-100 text-green-800 border-2 border-green-300 cursor-default' 
                      : !email || !universityId || emailDomainError
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 shadow-lg hover:shadow-xl'
                  }`}
                  title={
                    isEmailVerified || isEmailAlreadyVerified
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
                  ) : isEmailVerified || isEmailAlreadyVerified ? (
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {isEmailAlreadyVerified ? 'Already Verified ✓' : 'Verified ✓'}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  className="w-full py-2 pl-4 pr-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Enter your full name"
                  required 
                />
              </div>
              
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Password</label>
                <div className="relative w-full">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    minLength={7} 
                    maxLength={13} 
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
                    className="w-full py-2 pl-4 pr-12 border border-slate-300 rounded-lg [&::-webkit-credentials-auto-fill-button]:!hidden [&::-ms-reveal]:hidden [&::-webkit-strong-password-auto-fill-button]:!hidden"
                    placeholder="********"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 z-10" 
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
              
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Course (optional)</label>
                <select
                  className={`w-full px-4 py-2 border rounded-lg ${!universityId ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-300'}`}
                  value={courseId}
                  onChange={(e) => {
                    const value = e.target.value ? Number(e.target.value) : '';
                    setCourseId(value);
                    if (value) {
                      setCourseInput('');
                    }
                  }}
                  disabled={!universityId}
                  title={!universityId ? 'Select a university first' : undefined}
                >
                  <option value="">Select Course</option>
                  {filteredCourses.map(c => (
                    <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
                  ))}
                </select>
              <div className="mt-2">
                <label htmlFor="course-input" className="block text-slate-600 text-sm mb-1">Not in the list? Input your course (optional):</label>
                <input
                  id="course-input"
                  type="text"
                  value={courseInput}
                  onChange={(e) => setCourseInput(e.target.value)}
                  placeholder="e.g., BS Astrophysics"
                  disabled={!universityId || !!courseId}
                  className={`w-full px-4 py-2 border rounded-lg ${(!universityId || courseId) ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-300'}`}
                />
                {courseId && (
                  <p className="text-xs text-slate-500 mt-1">Select "Select Course" above to enable manual input.</p>
                )}
                {!courseId && !universityId && (
                  <p className="text-xs text-slate-500 mt-1">Select a university to enable course selection or manual input.</p>
                )}
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Year Level</label>
              <select 
                value={yearLevel} 
                onChange={(e) => setYearLevel(e.target.value)} 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                required
              >
                <option value="">Select Year Level</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
                <option value="5th Year">5th Year</option>
                {/* <option value="Graduate">Graduate</option>
                <option value="Post-Graduate">Post-Graduate</option> */}
              </select>
            </div>
            <div>
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
                className="w-full px-4 py-2 border border-slate-300 rounded-lg" 
                placeholder="09XXXXXXXXX"
                pattern="09[0-9]{9}"
                maxLength={11}
                required
              />
              <p className="text-xs text-slate-500 mt-1">Format: 09XXXXXXXXX (11 digits, numbers only)</p>
            </div>
          </div>

          {/* Bio */}
          <div className="mb-6">
            <label className="block text-slate-700 font-semibold mb-1">Your Bio (why you'd be a great tutor)</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="Briefly describe your teaching experience, specialties, and approach." />
          </div>
          {/* Subjects of Expertise */}
          <div>
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
            
            <div className="flex items-center gap-2 mb-4">
              <select
                value={subjectToAdd}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSubjectToAdd(e.target.value)}
                className={`flex-grow w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${!universityId ? 'border-slate-500 bg-slate-600/70 text-white/60 cursor-not-allowed' : 'border-slate-600 bg-slate-700 text-white'}`}
                aria-label="Select a subject to add"
                disabled={!universityId}
                title={!universityId ? 'Select a university first' : undefined}
              >
                <option value="">Select a subject...</option>
                {availableSubjects
                  .filter(s => !selectedSubjects.has(s.subject_name))
                  .map(s => <option key={s.subject_id} value={s.subject_name}>{s.subject_name}</option>)}
              </select>
              <button
                type="button"
                onClick={handleAddSubject}
                disabled={!universityId || !subjectToAdd || normalizedSelected.has(subjectToAdd.toLowerCase())}
                className="bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-600 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            {!universityId && (
              <p className="text-xs text-slate-500 mb-4">Select a university to view and add subjects.</p>
            )}

            <div>
              <label htmlFor="other-subject" className="block text-slate-600 text-sm mb-1">Not in the list? Add another subject (optional):</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  id="other-subject"
                  value={otherSubject}
                  onChange={(e) => setOtherSubject(e.target.value)}
                  placeholder="e.g., Astrophysics"
                  className={`flex-grow w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400 ${!universityId ? 'border-slate-500 bg-slate-600/70 text-white/60 cursor-not-allowed' : 'border-slate-600 bg-slate-700 text-white'}`}
                  disabled={!universityId}
                  title={!universityId ? 'Select a university first' : undefined}
                />
                <button
                  type="button"
                  onClick={handleAddOtherSubject}
                  disabled={!universityId || !otherSubject.trim() || otherSubjectExistsInDropdown}
                  className="bg-slate-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              {otherSubjectExistsInDropdown && (
                <p className="mt-1 text-xs text-red-300">Subject already exists. Please select it from the dropdown above.</p>
              )}
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
                <p className="text-xs text-slate-500">PDF, PNG, JPG, JPEG up to 10MB</p>
                <input 
                  id="file-upload-drag"
                  type="file" 
                  className="sr-only" 
                  multiple 
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg,image/jpg" 
                  onChange={handleFileChange} 
                />
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
          
          <button 
            type="submit" 
            className={`mt-8 w-full font-bold py-3 px-6 rounded-lg transition-colors ${
              isEmailVerified 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                : 'bg-gray-400 text-gray-600 cursor-not-allowed'
            }`}
            disabled={!isEmailVerified}
            title={!isEmailVerified ? 'Please verify your email first' : 'Submit your tutor application'}
          >
            {isEmailVerified ? 'Submit Application' : 'Verify Email to Submit'}
          </button>
        </form>
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
              onClick={handleCloseVerificationModal}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorRegistrationPage;