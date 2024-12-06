// app/dashboard/class/[id]/page.jsx
"use client";

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Upload, FileText, Trash2 } from 'lucide-react';
import Nav from '@/components/Nav';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import { useParams } from 'next/navigation';

const ClassDetail = () => {
  const params = useParams();
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teacherFiles, setTeacherFiles] = useState([]);
  const [studentFiles, setStudentFiles] = useState([]);
  const [uploadingTeacher, setUploadingTeacher] = useState(false);
  const [uploadingStudent, setUploadingStudent] = useState(false);

  // Fetch function remains the same
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: classDetails, error: classError } = await supabase
          .from('class')
          .select('*')
          .eq('id', params.id)
          .single();

        if (classError) throw classError;
        setClassData(classDetails);

        const { data: teacherData } = await supabase
          .storage
          .from('class-files')
          .list(`${params.id}/teacher`);

        setTeacherFiles(teacherData || []);

        const { data: studentData } = await supabase
          .storage
          .from('class-files')
          .list(`${params.id}/student`);

        setStudentFiles(studentData || []);

      } catch (err) {
        console.error('Error:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  // Upload handlers remain the same
  const handleTeacherUpload = async (event) => {
    try {
      setUploadingTeacher(true);
      const file = event.target.files[0];
      const filePath = `${params.id}/teacher/${file.name}`;

      const { error } = await supabase.storage
        .from('class-files')
        .upload(filePath, file);

      if (error) throw error;

      const { data } = await supabase
        .storage
        .from('class-files')
        .list(`${params.id}/teacher`);

      setTeacherFiles(data || []);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload file');
    } finally {
      setUploadingTeacher(false);
    }
  };

  const handleStudentUpload = async (event) => {
    try {
      setUploadingStudent(true);
      const file = event.target.files[0];
      const filePath = `${params.id}/student/${file.name}`;

      const { error } = await supabase.storage
        .from('class-files')
        .upload(filePath, file);

      if (error) throw error;

      const { data } = await supabase
        .storage
        .from('class-files')
        .list(`${params.id}/student`);

      setStudentFiles(data || []);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload file');
    } finally {
      setUploadingStudent(false);
    }
  };

  const handleDeleteFile = async (path, isTeacher) => {
    try {
      const filePath = `${params.id}/${isTeacher ? 'teacher' : 'student'}/${path}`;
      
      const { error } = await supabase.storage
        .from('class-files')
        .remove([filePath]);

      if (error) throw error;

      const { data } = await supabase
        .storage
        .from('class-files')
        .list(`${params.id}/${isTeacher ? 'teacher' : 'student'}`);

      if (isTeacher) {
        setTeacherFiles(data || []);
      } else {
        setStudentFiles(data || []);
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete file');
    }
  };

  const getFileUrl = (path, isTeacher) => {
    const { data } = supabase.storage
      .from('class-files')
      .getPublicUrl(`${params.id}/${isTeacher ? 'teacher' : 'student'}/${path}`);
    return data.publicUrl;
  };

  if (loading) return (
    <div className="flex">
      <Nav />
      <div className="flex-grow p-6 bg-slate-800 min-h-screen w-screen">
        <div className="text-white">Loading...</div>
      </div>
    </div>
  );

  return (
    <div className="flex">
      <Nav />
      <div className="flex-grow p-6 bg-slate-800 min-h-screen w-screen">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <Link 
              href="/dashboards" 
              className="inline-flex items-center text-slate-400 hover:text-slate-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-500">
              {error}
            </div>
          )}

          {/* Class Info */}
          <div className="bg-slate-700 rounded-lg p-6 mb-6">
            <h1 className="text-3xl font-bold text-white mb-8">
              {classData?.name}
            </h1>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-medium text-slate-300 mb-2">Term</h2>
                <p className="text-white">{classData?.term}</p>
              </div>
              <div>
                <h2 className="text-lg font-medium text-slate-300 mb-2">Subject</h2>
                <p className="text-white">{classData?.subject}</p>
              </div>
            </div>
          </div>

          {/* Files Section */}
          <div className="grid grid-cols-12 gap-6">
            {/* Upload Buttons Column */}
            <div className="col-span-4">
              {/* Teacher Upload */}
              <div className="bg-slate-700 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-bold text-white mb-4">Teacher Upload</h2>
                <label className="block w-full p-3 border-2 border-dashed border-slate-500 rounded-lg hover:border-blue-500 transition-colors cursor-pointer">
                  <input
                    type="file"
                    onChange={handleTeacherUpload}
                    disabled={uploadingTeacher}
                    className="hidden"
                  />
                  <div className="flex items-center justify-center text-slate-400 hover:text-blue-500">
                    <Upload className="w-5 h-5 mr-2" />
                    {uploadingTeacher ? 'Uploading...' : 'Upload Teacher File'}
                  </div>
                </label>
              </div>

              {/* Student Upload */}
              <div className="bg-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">Student Upload</h2>
                <label className="block w-full p-3 border-2 border-dashed border-slate-500 rounded-lg hover:border-blue-500 transition-colors cursor-pointer">
                  <input
                    type="file"
                    onChange={handleStudentUpload}
                    disabled={uploadingStudent}
                    className="hidden"
                  />
                  <div className="flex items-center justify-center text-slate-400 hover:text-blue-500">
                    <Upload className="w-5 h-5 mr-2" />
                    {uploadingStudent ? 'Uploading...' : 'Upload Student File'}
                  </div>
                </label>
              </div>
            </div>

            {/* Files Lists Column */}
            <div className="col-span-8">
              {/* Teacher Files */}
              <div className="bg-slate-700 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Teacher Files
                </h2>
                <div className="space-y-2">
                  {teacherFiles.map((file) => (
                    <div 
                      key={file.name}
                      className="flex items-center justify-between p-3 bg-slate-600 rounded-lg"
                    >
                      <a 
                        href={getFileUrl(file.name, true)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white hover:text-blue-400 truncate"
                      >
                        {file.name}
                      </a>
                      <button
                        onClick={() => handleDeleteFile(file.name, true)}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {teacherFiles.length === 0 && (
                    <p className="text-slate-400 text-center py-4">No teacher files uploaded yet</p>
                  )}
                </div>
              </div>

              {/* Student Files */}
              <div className="bg-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Student Files
                </h2>
                <div className="space-y-2">
                  {studentFiles.map((file) => (
                    <div 
                      key={file.name}
                      className="flex items-center justify-between p-3 bg-slate-600 rounded-lg"
                    >
                      <a 
                        href={getFileUrl(file.name, false)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white hover:text-blue-400 truncate"
                      >
                        {file.name}
                      </a>
                      <button
                        onClick={() => handleDeleteFile(file.name, false)}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {studentFiles.length === 0 && (
                    <p className="text-slate-400 text-center py-4">No student files uploaded yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassDetail;