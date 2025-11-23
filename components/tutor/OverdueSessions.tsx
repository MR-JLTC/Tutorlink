// // import React, { useEffect, useState } from 'react';
// // import apiClient from '../../services/api';
// // import Card from '../ui/Card';
// // import Button from '../ui/Button';
// // import { CheckCircle, Clock } from 'lucide-react';

// // interface Student {
// //   user_id: number;
// //   name: string;
// //   email: string;
// // }

// // interface BookingRequest {
// //   id: number;
// //   student: Student;
// //   subject: string;
// //   date: string;
// //   time: string;
// //   duration: number;
// //   status: string;
// //   created_at: string;
// // }

// // const parseSessionStart = (dateStr: string, timeStr: string): Date | null => {
// //   if (!dateStr || !timeStr) return null;
// //   let sessionDate = new Date(`${dateStr.split('T')[0]}T${timeStr}`);
// //   if (!isNaN(sessionDate.getTime())) return sessionDate;
// //   sessionDate = new Date(dateStr);
// //   if (isNaN(sessionDate.getTime())) return null;
// //   const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
// //   if (timeMatch) {
// //     let hours = parseInt(timeMatch[1], 10);
// //     const minutes = parseInt(timeMatch[2], 10);
// //     const ampm = timeMatch[3];
// //     if (ampm && ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
// //     if (ampm && ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
// //     sessionDate.setHours(hours, minutes, 0, 0);
// //   }
// //   return sessionDate;
// // };

// // const isOverdue = (request: BookingRequest): boolean => {
// //   const start = parseSessionStart(request.date, request.time);
// //   if (!start) return false;
// //   const durationHours = request.duration || 1.0;
// //   const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
// //   const eligibleStatuses = ['upcoming', 'confirmed'];
// //   return new Date().getTime() > end.getTime() && eligibleStatuses.includes(request.status);
// // };

// // const OverdueSessions: React.FC = () => {
// //   const [sessions, setSessions] = useState<BookingRequest[]>([]);
// //   const [loading, setLoading] = useState(false);

// //   useEffect(() => {
// //     const fetchSessions = async () => {
// //       setLoading(true);
// //       try {
// //         const res = await apiClient.get('/users/me/bookings');
// //         const all = res.data || [];
// //         const overdue = all.filter((b: BookingRequest) => isOverdue(b));
// //         const completed = all.filter((b: BookingRequest) => b.status === 'completed');
// //         setSessions([...overdue, ...completed]);
// //       } catch (err) {
// //         setSessions([]);
// //       } finally {
// //         setLoading(false);
// //       }
// //     };
// //     fetchSessions();
// //   }, []);

// 	const handleMarkDone = async (bookingId: number) => {
// 		setLoading(true);
// 		try {
// 			// Trigger payment request to admin for this session
// 			const res = await apiClient.post(`/payments/request`, { bookingId });
// 			if (res.data?.success) {
// 				// Refresh list
// 				const updated = await apiClient.get('/users/me/bookings');
// 				const overdue = (updated.data || []).filter((b: BookingRequest) => isOverdue(b));
// 				setSessions(overdue);
// 			}
// 		} catch (err) {
// 			// Optionally show error
// 		} finally {
// 			setLoading(false);
// 		}
// 	};

// //   return (
// //     <div className="space-y-4">
// //       <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
// //         <Clock className="h-6 w-6 text-red-600" />
// //         Overdue & Completed Sessions
// //       </h2>
// //       {loading ? (
// //         <div>Loading...</div>
// //       ) : sessions.length === 0 ? (
// //         <Card className="p-6 text-center">No overdue or completed sessions found.</Card>
// //       ) : (
// //         sessions.map(session => (
// //           <Card key={session.id} className={`p-4 mb-2 border ${isOverdue(session) ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
// //             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
// //               <div>
// //                 <div className="font-semibold text-slate-800">{session.subject}</div>
// //                 <div className="text-sm text-slate-600">{session.student?.name || 'Student'}</div>
// //                 <div className="text-xs text-slate-500">{new Date(session.date).toLocaleDateString()} {session.time}</div>
// //                 <div className="text-xs text-slate-500">Duration: {session.duration} hours</div>
// //               </div>
// //               <div className="mt-2 sm:mt-0 flex flex-col items-end gap-2">
// //                 {isOverdue(session) ? (
// //                   <>
// //                     <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
// //                       Overdue
// //                     </span>
// //                     <Button
// //                       onClick={() => handleMarkDone(session.id)}
// //                       disabled={loading}
// //                       className="flex items-center space-x-1 bg-purple-600 text-white px-3 py-1 rounded"
// //                     >
// //                       <CheckCircle className="h-4 w-4" />
// //                       <span>Mark as done</span>
// //                     </Button>
// //                   </>
// //                 ) : (
// //                   <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
// //                     Completed
// //                   </span> 
// //                 )}
// //               </div>
// //             </div>
// //           </Card>
// //         ))
// //       )}
// //     </div>
// //   );
// // };

// // export default OverdueSessions;
