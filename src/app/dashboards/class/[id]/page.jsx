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

  // Fetch function
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch class data
        const { data: ClassDetail, error: classError } = await supabase
          .from('classes')
          .select('*')
          .eq('id', params.id)
          .single();
        if (classError) throw classError;
        setClassData(ClassDetail);

        // Fetch teacher files

      }
    };

    fetchData();
  }, [params.id]);

  const handleTeacherUpload = async (event) => {
    try {
      setUploadingTeacher(true);
      setError(null);
      const file = event.target.files[0];
      
      if (file.type !== 'application/pdf') {
        throw new Error('Only PDF files are supported');
      }
      
      const filePath = `${params.id}/teacher/${file.name}`;
  
      // 1. Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from('class-files')
        .upload(filePath, file);
  
      if (uploadError) throw uploadError;
  
      // 2. Process PDF and get embeddings
      const formData = new FormData();
      formData.append('file', file);
  
      const processResponse = await fetch('http://localhost:8000/process-pdf', {
        method: 'POST',
        body: formData,
      });
  
      if (!processResponse.ok) {
        await supabase.storage
          .from('class-files')
          .remove([filePath]);
          
        const errorData = await processResponse.json();
        throw new Error(errorData.detail || 'Failed to process PDF');
      }
  
      const { text, embedding } = await processResponse.json();
  
      // 3. Store in Vector Store with embedding
      const { error: vectorError } = await supabase.rpc(
        'insert_document',
        {
          content: text,
          metadata: JSON.stringify({
            class_id: params.id,
            file_name: file.name,
            file_type: 'teacher',
            file_path: filePath,
            upload_date: new Date().toISOString()
          }),
          embedding: embedding
        }
      );
  
      if (vectorError) {
        await supabase.storage
          .from('class-files')
          .remove([filePath]);
        throw vectorError;
      }
  
      // 4. Refresh file list
      const { data } = await supabase.storage
        .from('class-files')
        .list(`${params.id}/teacher`);
  
      setTeacherFiles(data || []);
  
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload file');
      event.target.value = '';
    } finally {
      setUploadingTeacher(false);
    }
  };
  
  const handleStudentUpload = async (event) => {
    try {
      setUploadingStudent(true);
      const file = event.target.files[0];
      const filePath = `${params.id}/student/${file.name}`;
  
      // 1. Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from('class-files')
        .upload(filePath, file);
  
      if (uploadError) throw uploadError;
  
      // 2. Process PDF if it's a PDF file
      if (file.type === 'application/pdf') {
        // Create form data for processing
        const formData = new FormData();
        formData.append('file', file);
  
        // Call backend to process PDF and get text content
        const processResponse = await fetch('http://localhost:8000/process-pdf', {
          method: 'POST',
          body: formData,
        });
  
        if (!processResponse.ok) {
          throw new Error('Failed to process PDF');
        }
  
        const { text } = await processResponse.json();
  
        // 3. Store in Vector Store using Supabase function
        const { error: vectorError } = await supabase.rpc(
          'insert_document',
          {
            content: text,
            metadata: JSON.stringify({
              class_id: params.id,
              file_name: file.name,
              file_type: 'student',
              file_path: filePath,
              upload_date: new Date().toISOString()
            })
          }
        );
  
        if (vectorError) {
          // If vector store fails, delete from storage
          await supabase.storage
            .from('class-files')
            .remove([filePath]);
          throw vectorError;
        }
      }
  
      // 4. Refresh file list
      const { data } = await supabase.storage
        .from('class-files')
        .list(`${params.id}/student`);
  
      setStudentFiles(data || []);
  
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload file: ' + err.message);
    } finally {
      setUploadingStudent(false);
    }
  };
  
  const handleDeleteFile = async (path, isTeacher) => {
    try {
      const filePath = `${params.id}/${isTeacher ? 'teacher' : 'student'}/${path}`;
      
      // 1. Delete from Storage
      const { error: storageError } = await supabase.storage
        .from('class-files')
        .remove([filePath]);
  
      if (storageError) throw storageError;
  
      // 2. Delete from Vector Store
      const { error: vectorError } = await supabase.rpc(
        'delete_document',
        {
          file_path: filePath
        }
      );
  
      if (vectorError) throw vectorError;
  
      // 3. Refresh file list
      const { data } = await supabase.storage
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
      setError('Failed to delete file: ' + err.message);
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
    <div className="flex min-h-screen bg-slate-900">
    <Nav />
    <main className="flex-1 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link 
            href="/dashboards" 
            className="inline-flex items-center px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Class Info Card */}
        <section className="bg-slate-800 rounded-xl p-8 shadow-lg">
          <h1 className="text-4xl font-bold text-white mb-8">
            {classData?.name}
          </h1>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <h2 className="text-lg font-medium text-slate-400">Term</h2>
              <p className="text-2xl text-white">{classData?.term}</p>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-medium text-slate-400">Subject</h2>
              <p className="text-2xl text-white">{classData?.subject}</p>
            </div>
          </div>
        </section>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Upload Sections */}
          <aside className="lg:col-span-4 space-y-8">
            {/* Teacher Upload */}
            <section className="bg-slate-800 rounded-xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-white mb-6">Teacher Uploads</h2>
              <label className="block w-full p-4 border-2 border-dashed border-slate-600 rounded-xl hover:border-blue-500 transition-all duration-200 cursor-pointer group">
                <input
                  type="file"
                  onChange={handleTeacherUpload}
                  disabled={uploadingTeacher}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-2 text-slate-400 group-hover:text-blue-500">
                  <Upload className="w-8 h-8" />
                  <span>{uploadingTeacher ? 'Uploading...' : 'Upload Teacher File'}</span>
                </div>
              </label>
            </section>

            {/* Student Upload */}
            <section className="bg-slate-800 rounded-xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-white mb-6">Student Uploads</h2>
              <label className="block w-full p-4 border-2 border-dashed border-slate-600 rounded-xl hover:border-blue-500 transition-all duration-200 cursor-pointer group">
                <input
                  type="file"
                  onChange={handleStudentUpload}
                  disabled={uploadingStudent}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-2 text-slate-400 group-hover:text-blue-500">
                  <Upload className="w-8 h-8" />
                  <span>{uploadingStudent ? 'Uploading...' : 'Upload Student File'}</span>
                </div>
              </label>
            </section>
          </aside>

          {/* Files Display */}
          <div className="lg:col-span-8 space-y-8">
            {/* Teacher Files */}
            <section className="bg-slate-800 rounded-xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <FileText className="w-6 h-6 mr-3" />
                Teacher Files
              </h2>
              <div className="space-y-3">
                {teacherFiles.map((file) => (
                  <div key={file.name} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <a 
                        href={getFileUrl(file.name, true)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white hover:text-blue-400 truncate"
                      >
                        {file.name}
                      </a>
                      {file.name.toLowerCase().endsWith('.pdf') && (
                        <button
                          onClick={() => handleFileSelect(file)}
                          className={`p-2 rounded-lg transition-colors ${
                            selectedFile?.name === file.name
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-600 text-slate-300 hover:bg-blue-500/80 hover:text-white'
                          }`}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <button 
                      onClick={() => handleDeleteFile(file.name, true)}
                      className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {teacherFiles.length === 0 && (
                  <p className="text-slate-400 text-center py-8">No teacher files uploaded yet</p>
                )}
              </div>
            </section>

            {/* Student Files */}
            <section className="bg-slate-800 rounded-xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <FileText className="w-6 h-6 mr-3" />
                Student Files
              </h2>
              <div className="space-y-3">
                {studentFiles.map((file) => (
                  <div key={file.name} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors">
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
                      className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {studentFiles.length === 0 && (
                  <p className="text-slate-400 text-center py-8">No student files uploaded yet</p>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* RAG Section */}
        {selectedFile && (
          <section className="bg-slate-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center justify-between">
              <span>Ask about {selectedFile.name}</span>
              {isProcessing && (
                <span className="text-sm text-blue-400">Processing document...</span>
              )}
            </h3>
            <div className="space-y-6">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={!isDocumentsReady || isProcessing}
                className="w-full p-4 rounded-lg bg-slate-700 text-white border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                placeholder={
                  isProcessing
                    ? 'Processing document...'
                    : isDocumentsReady
                      ? 'Ask a question about this document...'
                      : 'Please wait for document processing to complete...'
                }
                rows="4"
              />
              <button
                onClick={handleAskQuestion}
                disabled={isQuerying || !question.trim() || !isDocumentsReady || isProcessing}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
              >
                {isQuerying 
                  ? 'Getting Answer...'
                  : isProcessing
                    ? 'Processing Document...'
                    : 'Ask Question'}
              </button>
              {answer && (
                <div className="p-6 bg-slate-700 rounded-lg">
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Answer</h4>
                  <p className="text-white whitespace-pre-wrap">{answer}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Custom Prompt Section */}
        <section className="bg-slate-800 rounded-xl p-6 shadow-lg">
          <label className="block">
            <span className="text-sm font-medium text-slate-300 mb-2 block">
              Custom Prompt Template (Optional)
            </span>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full p-4 rounded-lg bg-slate-700 text-white border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              placeholder='Enter custom prompt template... Use {context} and {question} as placeholders'
              rows="4"
            />
            <p className="text-sm text-slate-400 mt-2">
              Leave empty to use default prompt. Use {'{context}'} and {'{question}'} as placeholders.
            </p>
          </label>
        </section>
      </div>
    </main>
  </div>
  );
};

export default ClassDetail