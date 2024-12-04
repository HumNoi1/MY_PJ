'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, Webhook } from 'lucide-react';
import supabase from '@/lib/supabase';

function AddClassroom() {
  const [classname, setName] = useState('');
  const [term, setTerm] = useState('');
  const [subject, setSubject] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('classes')
      .insert([{ classname, term, subject }]);

    if (error) {
      console.error('Error creating classroom:', error);
    } else {
      router.push('/dashboards');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="flex flex-col items-center">
          <div className="bg-slate-800 p-3 rounded-lg">
            <Webhook className="w-8 h-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-white">Add New Classroom</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="classname" className="sr-only">Class Name</label>
              <input
                id="classname"
                name="classname"
                type="text"
                required
                value={classname}
                onChange={(e) => setName(e.target.value)}
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Class Name"
              />
            </div>
            <div>
              <label htmlFor="term" className="sr-only">Term</label>
              <input
                id="term"
                name="term"
                type="text"
                required
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Term"
              />
            </div>
            <div>
              <label htmlFor="subject" className="sr-only">Subject</label>
              <input
                id="subject"
                name="subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Subject"
              />
            </div>
          </div>

          <button
            type="submit"
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Create Classroom
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddClassroom;