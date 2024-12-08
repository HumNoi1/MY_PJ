"use client";

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Upload, FileText, Trash2, MessageCircle } from 'lucide-react';
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
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptSettings, setShowPromptSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDocumentsReady, setIsDocumentsReady] = useState(false);

  // Add states for RAG functionality
  const [selectedFile, setSelectedFile] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);

  // Fetch function
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
        if (selectedFile?.name === path) {
          setSelectedFile(null);
          setAnswer('');
          setQuestion('');
        }
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

  const handleFileSelect = async (file) => {
    try {
      setSelectedFile(file);
      setAnswer(''); // Clear previous answer
      setQuestion(''); // Clear previous question
      setIsProcessing(true);
      setIsDocumentsReady(false);
      setError(null);
  
      // Check if document is already processed
      const statusResponse = await fetch(`http://localhost:8000/status/${file.name}`);
      const statusData = await statusResponse.json();
  
      if (!statusData.is_processed) {
        // Download file from Supabase
        const { data, error } = await supabase.storage
          .from('class-files')
          .download(`${params.id}/teacher/${file.name}`);
        
        if (error) throw error;
  
        // Create form data and send to Python backend
        const formData = new FormData();
        formData.append('file', new Blob([data], { type: 'application/pdf' }), file.name);
  
        const response = await fetch('http://localhost:8000/upload', {
          method: 'POST',
          body: formData,
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to process file');
        }
      }
      
      setIsDocumentsReady(true);
    } catch (err) {
      console.error('Error processing file:', err);
      setError(err.message || 'Failed to process file for RAG');
      setSelectedFile(null);
      setIsDocumentsReady(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!selectedFile || !question.trim() || !isDocumentsReady) {
      setError('Please select a file, wait for processing to complete, and enter a question');
      return;
    }
  
    try {
      setIsQuerying(true);
      setError(null);
      
      const response = await fetch('http://localhost:8000/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question: question.trim(),
          custom_prompt: customPrompt.trim(),
          filename: selectedFile.name
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get answer');
      }
  
      const data = await response.json();
      setAnswer(data.response);
    } catch (err) {
      console.error('Error getting answer:', err);
      setError(err.message || 'Failed to get answer');
    } finally {
      setIsQuerying(false);
    }
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
            <Link href="/dashboards" className="inline-flex items-center text-slate-400 hover:text-slate-300">
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
            {/* Uploads Buttons Column} */}
            <div className="col-span-4">
              {/* Teacher Upload */}
              <div className="bg-slate-700 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-bold text-white mb-4">Teacher Uploads</h2>
                <label className="block w-full p-3 border-2 border-dashed border-slate-500 rounded-lg hover:border-blue-500 transiton-colors cursor-pointer">
                  <input
                    type="file"
                    onChange={handleTeacherUpload}
                    disabled={uploadingTeacher}
                    className="hidden"
                  ></input>
                  <div className="flex items-center justify-center text-slate-400 hover:text-blue-500">
                    <Upload className="w-5 h-5 mr-2" />
                    {uploadingTeacher ? 'Uploading...' : 'Upload Teacher File'}
                  </div>
                </label>
              </div>

              {/* Student Upload */}
              <div className="bg-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">Student Uploads</h2>
                <label className="block w-full p-3 border-2 border-dashed border-slate-500 rounded-lg hover:text-blue-500 transition-colors cursor-pointer">
                  <input
                    type="file"
                    onChange={handleStudentUpload}
                    disabled={uploadingStudent}
                    className="hidden"
                  >
                  </input>
                  <div className="flex items-center justify-center text-slate-400 hover:text-blue-500">
                    <Upload className="w-5 h-5 mr-2" />
                    {uploadingStudent ? 'Uploading...' : 'Upload Student File'}
                  </div>
                </label>
              </div>
            </div>

            {/* Files Column */}
            <div className="col-span-8">
              {/* Teacher Files */}
              <div className="bg-slate-700 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <FileText className="w-6 h-6 mr-2" />
                  Teacher Files
                </h2>
                <div>
                  {teacherFiles.map((file) => (
                    <div key={file.name} className="flex items-center justify-between p-3 bg-slate-600 rounded-lg">
                      <a href={getFileUrl(file.name, true)} target="_blank" rel="noopener noreferrer" className="text-white hover:text-blue-400 truncate">
                        {file.name}
                      </a>
                      <button onClick={() => handleDeleteFile(file.name, true)} className="text-slate-400 hover:text-red-500 p-1">
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
                    <div key={file.name} className="flex items-center justify-between p-3 bg-slate-600 rounded-lg">
                      <a href={getFileUrl(file.name, false)} target="_blank" rel="noopener noreferrer" className="text-white hover:text-blue-400 truncate">
                        {file.name}
                      </a>
                      <button onClick={() => handleDeleteFile(file.name, false)} className="text-slate-400 hover:text-red-500 p-1">
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
            <div className="bg-slate-700 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Teacher Files
              </h2>
              <div className="space-y-2">
                {teacherFiles.map((file) => (
                  <div key={file.name} className="flex items-center justify-between p-3 bg-slate-600 rounded-lg">
                    <div className="flex items-center space-x-3 flex-grow">
                      <a href={getFileUrl(file.name, true)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-blue-400 truncate"
                      >
                        {file.name}
                      </a>
                      {file.name.toLowerCase().endsWith('.pdf') && (
                        <button
                        onClick={() => handleFileSelect(file)}
                        className={`px-3 py-1 rounded ${
                          selectedFile?.name === file.name
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-500 text-slate-200 hover:bg-blue-500'
                          }`}
                          >
                            <MessageCircle className="w-4 h-4" />
                        </button>
                      )}
                      <div>
                        <button onClick={() => handleDeleteFile(file.name, true)}
                        className="text-slate-400 hover:text-red-500 p-1">
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>
                      {teacherFiles.length === 0 && (
                        <p className="text-slate-400 text-center py-4">No teacher files uploaded yet</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* RAG Section */}
          {selectedFile && (
            <div className="mt-6 p-4 bg-slate-600 rounded-lg">
              <h3 className="text-lg font-medium text-white mb-3 flex items-center justify-between">
                <span>Ask question about {selectedFile.name}</span>
                {isProcessing && (
                  <span className=" text-sm text-blue-400">Processing document...</span>
                )}
              </h3>
              <div className="space-y-4">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={!isDocumentsReady || isProcessing}
                  className="w-full p-3 rounded bg-slate-700 text-white border border-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  placeholder={
                    isProcessing
                      ? 'Processing document...'
                      : isDocumentsReady
                        ? 'Ask a question about this document...'
                        : 'Please wait for document processing to complete...'
                  }
                  rows="3"
                />
                <button
                  onClick={handleAskQuestion}
                  disabled={isQuerying || !question.trim() || !isDocumentsReady || isProcessing}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-slate-500"
                >
                  {isQuerying 
                    ? 'Getting Answer.'
                    : isProcessing
                      ? 'Processing Document...'
                      : 'Ask Question'}
                </button>
                {answer && (
                  <div className="p-4 bg-slate-700 rounded">
                    <h4 className="text-sm font-medium text-slate-300 mb-2">Answer</h4>
                    <p className="text-white whitespace-pre-wrap">{answer}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Custom Prompt Template (Optional)
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full p-3 rounded bg-slate-700 text-white border border-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder='Enter custom prompt template... Use {context} and {question} as placeholders'
              rows='4'
             />
             <p className="text-sm text-slate-400 mt-1">
                Leave empty to use default prompt. Use {'{context}'} and {'{question}'} as placeholders.
             </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ClassDetail