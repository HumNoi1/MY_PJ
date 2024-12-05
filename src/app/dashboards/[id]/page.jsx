// app/class/[id]/page.jsx
"use client";

import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Nav from '@/components/Nav';
import Link from 'next/link';
import supabase from '@/lib/supabase';

const ClassDetail = ({ params }) => {
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchClassDetail = async () => {
      try {
        const { data, error } = await supabase
          .from('class')
          .select('*')
          .eq('id', params.id)
          .single();

        if (error) throw error;
        setClassData(data);
      } catch (err) {
        console.error('Error:', err);
        setError('Failed to load class details');
      } finally {
        setLoading(false);
      }
    };

    fetchClassDetail();
  }, [params.id]);

  if (loading) return (
    <div className="flex">
      <Nav />
      <div className="flex-grow p-6 bg-slate-800 min-h-screen w-screen">
        <div className="text-white">Loading...</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex">
      <Nav />
      <div className="flex-grow p-6 bg-slate-800 min-h-screen w-screen">
        <div className="text-red-500">{error}</div>
      </div>
    </div>
  );

  return (
    <div className="flex">
      <Nav />
      <div className="flex-grow p-6 bg-slate-800 min-h-screen w-screen">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Link 
              href="/dashboards" 
              className="inline-flex items-center text-slate-400 hover:text-slate-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </div>

          <div className="bg-slate-700 rounded-lg p-6">
            <h1 className="text-3xl font-bold text-white mb-8">
              {classData.name}
            </h1>

            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-slate-300 mb-2">Term</h2>
                <p className="text-white">{classData.term}</p>
              </div>

              <div>
                <h2 className="text-lg font-medium text-slate-300 mb-2">Subject</h2>
                <p className="text-white">{classData.subject}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassDetail;