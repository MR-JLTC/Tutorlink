import React, { useEffect, useState } from 'react';
import apiClient from '../../services/api';
import { Course, Subject, University } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '../ui/Toast';

interface CourseWithDetails extends Course {
    university: University;
    subjects?: Subject[];
}

const CourseManagement: React.FC = () => {
    const { notify } = useToast();
    const [courses, setCourses] = useState<CourseWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openCourseId, setOpenCourseId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [universities, setUniversities] = useState<University[]>([]);
    const [form, setForm] = useState<{ course_name: string; university_id: number; acronym?: string; subject_name?: string } | null>(null);
    const [editCourse, setEditCourse] = useState<CourseWithDetails | null>(null);
    const [editSubject, setEditSubject] = useState<Subject | null>(null);
    
    useEffect(() => {
        const fetchCourses = async () => {
            try {
                setLoading(true);
                const response = await apiClient.get('/courses');
                setCourses(response.data);
            } catch (e) {
                setError('Failed to fetch courses.');
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        const fetchUniversities = async () => {
            const res = await apiClient.get('/universities');
            setUniversities(res.data);
        }
        fetchCourses();
        fetchUniversities();
    }, []);

    const toggleSubjects = async (courseId: number) => {
        if (openCourseId === courseId) {
            setOpenCourseId(null);
            return;
        }

        const course = courses.find(c => c.course_id === courseId);
        if (course && !course.subjects) {
            try {
                // Fetch subjects if not already fetched
                const response = await apiClient.get(`/courses/${courseId}/subjects`);
                const subjects = response.data;
                setCourses(prevCourses => prevCourses.map(c => 
                    c.course_id === courseId ? { ...c, subjects } : c
                ));
            } catch(err) {
                console.error("Failed to fetch subjects", err);
            }
        }
        setOpenCourseId(courseId);
        // Ensure form exists so the subject input is controlled and editable
        setForm(prev => prev ?? { course_name: '', university_id: 0, acronym: '', subject_name: '' });
    };

    const openAddCourse = () => {
        setForm({ course_name: '', university_id: universities[0]?.university_id || 0, acronym: '' });
        setIsModalOpen(true);
    }

    const saveCourse = async () => {
        if (!form) return;
        try {
            if (editCourse) {
                await apiClient.patch(`/courses/${editCourse.course_id}`, { course_name: form.course_name, university_id: form.university_id, acronym: form.acronym || '' });
            } else {
                await apiClient.post('/courses', { course_name: form.course_name, university_id: form.university_id, acronym: form.acronym || '' });
            }
            const response = await apiClient.get('/courses');
            setCourses(response.data);
            setIsModalOpen(false);
            setEditCourse(null);
            setError(null);
            notify('Course saved successfully!', 'success');
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || error.message || 'Failed to save course.';
            notify(errorMessage, 'error');
        }
    }

    const addSubject = async (courseId: number) => {
        if (!form?.subject_name) return;
        await apiClient.post(`/courses/${courseId}/subjects`, { subject_name: form.subject_name });
        const response = await apiClient.get(`/courses/${courseId}/subjects`);
        setCourses(prev => prev.map(c => c.course_id === courseId ? { ...c, subjects: response.data } as CourseWithDetails : c));
        setForm(prev => prev ? { ...prev, subject_name: '' } : prev);
    }

    const openEditCourse = (course: CourseWithDetails) => {
        setEditCourse(course);
        setForm({ course_name: course.course_name, university_id: course.university.university_id, acronym: course.acronym || '' });
        setIsModalOpen(true);
    }

    const openEditSubject = (subject: Subject) => {
        setEditSubject(subject);
        setForm(prev => ({ course_name: '', university_id: 0, acronym: '', subject_name: subject.subject_name }));
    }

    const saveSubject = async (courseId: number) => {
        if (!editSubject || !form) return;
        await apiClient.patch(`/courses/${courseId}/subjects/${editSubject.subject_id}`, { subject_name: form.subject_name });
        const response = await apiClient.get(`/courses/${courseId}/subjects`);
        setCourses(prev => prev.map(c => c.course_id === courseId ? { ...c, subjects: response.data } as CourseWithDetails : c));
        setEditSubject(null);
        setForm(prev => prev ? { ...prev, subject_name: '' } : prev);
    }

    if (loading) return <div>Loading courses...</div>;

    return (
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-4 sm:mb-6">Course & Subject Management</h1>
            <Card>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4">
                    <h2 className="text-lg sm:text-xl font-semibold">Courses</h2>
                    <Button onClick={openAddCourse} className="w-full sm:w-auto">Add Course</Button>
                </div>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acronym</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">University</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {courses.map((course) => (
                                <React.Fragment key={course.course_id}>
                                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleSubjects(course.course_id)}>
                                        <td className="px-6 py-4">
                                            <button className="text-slate-500 hover:text-slate-800">
                                                {openCourseId === course.course_id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{course.course_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course.acronym || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course.university?.name || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm space-x-2">
                                            <Button variant="secondary" onClick={() => openEditCourse(course)}>Edit</Button>
                                            <Button variant="danger" onClick={async () => { await apiClient.delete(`/courses/${course.course_id}`); const res = await apiClient.get('/courses'); setCourses(res.data); }}>Delete</Button>
                                        </td>
                                    </tr>
                                    {openCourseId === course.course_id && (
                                        <tr>
                                            <td colSpan={5} className="p-0">
                                                <div className="px-6 py-4 bg-gray-50">
                                                    <h4 className="text-sm font-semibold mb-2 ml-12">Subjects:</h4>
                                                    <div className="ml-0 sm:ml-12 mb-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 items-center">
                                                        <input className="border border-slate-300 rounded px-2 py-1" placeholder="New subject name" value={form?.subject_name || ''} onChange={(e) => setForm(prev => ({ ...(prev ?? { course_name: '', university_id: 0, acronym: '' }), subject_name: e.target.value }))} />
                                                        <Button variant="secondary" onClick={() => addSubject(course.course_id)}>Add Subject</Button>
                                                    </div>
                                                    {course.subjects && course.subjects.length > 0 ? (
                                                        <ul className="list-disc pl-16 space-y-1">
                                                            {[...(course.subjects || [])]
                                                                .sort((a, b) => a.subject_name.localeCompare(b.subject_name))
                                                                .map(subject => (
                                                                <li key={subject.subject_id} className="text-sm text-gray-700 flex items-center justify-between">
                                                                    <span>{subject.subject_name}</span>
                                                                    <div className="space-x-2">
                                                                        <Button variant="secondary" onClick={() => openEditSubject(subject)}>Edit</Button>
                                                                        <Button variant="danger" onClick={async () => { await apiClient.delete(`/courses/${course.course_id}/subjects/${subject.subject_id}`); const res = await apiClient.get(`/courses/${course.course_id}/subjects`); setCourses(prev => prev.map(c => c.course_id === course.course_id ? { ...c, subjects: res.data } as CourseWithDetails : c)); }}>Delete</Button>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-sm text-gray-500 ml-12">No subjects found for this course.</p>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                    {courses.map((course) => (
                        <Card key={course.course_id} className="p-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-slate-900 truncate">{course.course_name}</h3>
                                        <p className="text-sm text-slate-500 truncate">{course.acronym ? `(${course.acronym})` : ''} {course.university?.name || 'N/A'}</p>
                                    </div>
                                    <button 
                                        onClick={() => toggleSubjects(course.course_id)}
                                        className="p-2 text-slate-500 hover:text-slate-800 flex-shrink-0"
                                    >
                                        {openCourseId === course.course_id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="secondary" onClick={() => openEditCourse(course)} className="flex-1 text-sm">Edit</Button>
                                    <Button variant="danger" onClick={async () => { await apiClient.delete(`/courses/${course.course_id}`); const res = await apiClient.get('/courses'); setCourses(res.data); }} className="flex-1 text-sm">Delete</Button>
                                </div>
                                {openCourseId === course.course_id && (
                                    <div className="pt-3 border-t border-slate-200 space-y-3">
                                        <h4 className="text-sm font-semibold">Subjects:</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <input 
                                                className="border border-slate-300 rounded px-2 py-1 text-sm flex-1" 
                                                placeholder="New subject name" 
                                                value={form?.subject_name || ''} 
                                                onChange={(e) => setForm(prev => ({ ...(prev ?? { course_name: '', university_id: 0, acronym: '' }), subject_name: e.target.value }))} 
                                            />
                                            <Button variant="secondary" onClick={() => addSubject(course.course_id)} className="text-sm">Add Subject</Button>
                                        </div>
                                        {course.subjects && course.subjects.length > 0 ? (
                                            <ul className="space-y-2">
                                                {[...(course.subjects || [])]
                                                    .sort((a, b) => a.subject_name.localeCompare(b.subject_name))
                                                    .map(subject => (
                                                    <li key={subject.subject_id} className="text-sm text-gray-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 bg-slate-50 rounded">
                                                        <span className="flex-1">{subject.subject_name}</span>
                                                        <div className="flex gap-2 w-full sm:w-auto">
                                                            <Button variant="secondary" onClick={() => openEditSubject(subject)} className="flex-1 sm:flex-none text-xs">Edit</Button>
                                                            <Button variant="danger" onClick={async () => { await apiClient.delete(`/courses/${course.course_id}/subjects/${subject.subject_id}`); const res = await apiClient.get(`/courses/${course.course_id}/subjects`); setCourses(prev => prev.map(c => c.course_id === course.course_id ? { ...c, subjects: res.data } as CourseWithDetails : c)); }} className="flex-1 sm:flex-none text-xs">Delete</Button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-gray-500">No subjects found for this course.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditCourse(null); setError(null); }} title={editCourse ? 'Edit Course' : 'Add Course'} footer={<>
                <Button variant="secondary" onClick={() => { setIsModalOpen(false); setEditCourse(null); setError(null); }}>Cancel</Button>
                <Button onClick={saveCourse}>Save</Button>
            </>}>
                {form && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Course Name</label>
                            <input className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" value={form.course_name} onChange={(e) => setForm(prev => prev ? { ...prev, course_name: e.target.value } : prev)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Acronym</label>
                            <input className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" value={form.acronym || ''} onChange={(e) => setForm(prev => prev ? { ...prev, acronym: e.target.value } : prev)} placeholder="e.g., CS, IT, BS" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">University</label>
                            <select className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" value={form.university_id} onChange={(e) => setForm(prev => prev ? { ...prev, university_id: Number(e.target.value) } : prev)}>
                                {universities.map(u => (
                                    <option key={u.university_id} value={u.university_id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </Modal>

            {editSubject && (
                <Modal isOpen={true} onClose={() => setEditSubject(null)} title="Edit Subject" footer={
                    <>
                        <Button variant="secondary" onClick={() => setEditSubject(null)}>Cancel</Button>
                        <Button onClick={() => saveSubject(openCourseId || (courses.find(c => c.subjects?.some(s => s.subject_id === editSubject.subject_id))?.course_id as number))}>Save</Button>
                    </>
                }>
                    {form && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Subject Name</label>
                                <input className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" value={form.subject_name || ''} onChange={(e) => setForm(prev => prev ? { ...prev, subject_name: e.target.value } : prev)} />
                            </div>
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
};

export default CourseManagement;
