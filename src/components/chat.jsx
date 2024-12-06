"use client";

import React, { useState } from 'react';
import { Send, FileText, RefreshCcw } from 'lucide-react';

const Chat = ({ classId }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshDocuments = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('http://localhost:8000/refresh-documents', {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to refresh documents');
      setMessages(prev => [...prev, {
        role: 'system',
        content: 'Document knowledge base has been refreshed.'
      }]);
    } catch (error) {
      console.error('Error refreshing documents:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    try {
      setIsLoading(true);
      const userMessage = { role: 'user', content: inputMessage };
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');

      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: inputMessage,
          class_id: classId
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response,
        sources: data.sources
      }]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-900">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Class Assistant</h2>
          <button
            onClick={handleRefreshDocuments}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50"
          >
            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Documents
          </button>
        </div>

        <div className="flex-1 bg-slate-800 rounded-lg p-4 mb-4 overflow-y-auto">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div key={index}>
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.role === 'system'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-200'
                  }`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-600">
                        <p className="text-sm text-slate-300 mb-2">Related Documents:</p>
                        {message.sources.map((source, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm text-slate-400 mb-2">
                            <FileText className="w-4 h-4 mt-1 flex-shrink-0" />
                            <p>{source}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-700 text-slate-200 rounded-lg p-4">
                  <p>Thinking...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask about your class materials..."
            className="flex-1 bg-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;