'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, Webhook } from 'lucide-react';
import Supabase from '@supabase/supabase-js';

export default function AddClassroom() {
  const [name, setName] = useState('');
  const [term, setTerm] = useState('');
  const [subject, setSubject] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    router.push('/dashboards');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="flex flex-col items-center">
          <div className="bg-slate-800 p-3 rounded-lg">
            <Webhook className="w-8 h-8 text-white" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-white">Create New Classroom</h2>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6 bg-slate-800/50 p-6 rounded-lg">
          <div>
            <label className="text-sm font-medium text-slate-300">
              Class Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg bg-slate-800 border border-slate-700 
                       px-4 py-2.5 text-white placeholder:text-slate-400 
                       focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Enter classroom name"
              required
            />
            <label className="text-sm font-medium text-slate-300">
              Term
            </label>
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="mt-1 block w-full rounded-lg bg-slate-800 border border-slate-700 
                       px-4 py-2.5 text-white placeholder:text-slate-400 
                       focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Enter term"
              required
            />
            <label className="text-sm font-medium text-slate-300">
              Subject
            </label>
            <input
              type='text'
              value-={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 block w-full rounded-lg bg-slate-800 border border-slate-700
                        px-4 py-2.5 text-white placeholder:text-slate-400
                        focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Enter subject"
              required
            />
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Create Classroom
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}