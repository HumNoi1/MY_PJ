'use client';

import React, { useState } from 'react';
import { Upload, FileText, Check } from 'lucide-react';

const TeacherDashboard = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [gradingCriteria, setGradingCriteria] = useState([
    { name: 'Content Understanding', maxScore: 30 },
    { name: 'Critical Analysis', maxScore: 25 },
    { name: 'Organization', maxScore: 25 },
    { name: 'Evidence Support', maxScore: 20 }
  ]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleAnswerKeyUpload = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      // Upload answer key logic here
    }
  };

  const handleGradingCriteriaChange = (index, field, value) => {
    const updatedCriteria = [...gradingCriteria];
    updatedCriteria[index][field] = value;
    setGradingCriteria(updatedCriteria);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Answer Key Upload Section */}
        <section className="bg-slate-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-4">Upload Answer Key</h2>
          <label className="flex flex-col items-center p-6 border-2 border-dashed border-slate-600 rounded-lg hover:border-blue-500 cursor-pointer transition-all">
            <Upload className="w-12 h-12 text-slate-400 mb-4" />
            <span className="text-slate-400">
              {selectedFile ? selectedFile.name : 'Select PDF file'}
            </span>
            <input
              type="file"
              accept=".pdf"
              onChange={handleAnswerKeyUpload}
              className="hidden"
            />
          </label>
        </section>

        {/* Grading Criteria Section */}
        <section className="bg-slate-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-4">Grading Criteria</h2>
          <div className="space-y-4">
            {gradingCriteria.map((criteria, index) => (
              <div key={index} className="flex items-center space-x-4">
                <input
                  type="text"
                  value={criteria.name}
                  onChange={(e) => handleGradingCriteriaChange(index, 'name', e.target.value)}
                  className="flex-grow p-2 bg-slate-700 border border-slate-600 rounded text-white"
                />
                <input
                  type="number"
                  value={criteria.maxScore}
                  onChange={(e) => handleGradingCriteriaChange(index, 'maxScore', parseInt(e.target.value))}
                  className="w-24 p-2 bg-slate-700 border border-slate-600 rounded text-white"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Submissions Section */}
        <section className="bg-slate-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-4">Student Submissions</h2>
          <div className="space-y-4">
            {submissions.map((submission, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                <div className="flex items-center space-x-4">
                  <FileText className="w-6 h-6 text-slate-400" />
                  <div>
                    <p className="text-white font-medium">{submission.studentName}</p>
                    <p className="text-slate-400 text-sm">{submission.timestamp}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-white">{submission.score}/100</span>
                  {submission.graded && (
                    <Check className="w-6 h-6 text-green-500" />
                  )}
                </div>
              </div>
            ))}
            {submissions.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                No submissions yet
              </div>
            )}
          </div>
        </section>

        {/* Status Messages */}
        {loading && (
          <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
            Processing...
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;