'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Webhook } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Add your login logic here
    router.push('/dashboards');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center">
          <div className="bg-slate-800 p-3 rounded-lg">
            <Webhook className="w-8 h-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-white">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Please enter your details to sign in
          </p>
        </div>

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-slate-300">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg bg-slate-800 border border-slate-700 
                         px-4 py-2.5 text-white placeholder:text-slate-400 
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium text-slate-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg bg-slate-800 border border-slate-700 
                         px-4 py-2.5 text-white placeholder:text-slate-400 
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Enter your password"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-blue-500 
                         focus:ring-blue-500 focus:ring-offset-slate-900"
              />
              <label htmlFor="remember-me" className="ml-2 text-sm text-slate-300">
                Remember me
              </label>
            </div>

            <button
              type="button"
              className="text-sm text-blue-500 hover:text-blue-400"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg
                     text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                     focus:ring-offset-slate-900"
          >
            Sign in
          </button>

          <p className="text-center text-sm text-slate-400">
            Don't have an account?{' '}
            <button type="button" className="text-blue-500 hover:text-blue-400">
              Sign up
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}