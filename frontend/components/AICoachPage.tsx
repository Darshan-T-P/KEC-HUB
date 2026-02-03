import React, { useState, useRef, useEffect } from 'react';
import { FormattedText } from './FormattedText';
import { User } from '../types';

interface AICoachPageProps {
  user: User;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const AICoachPage: React.FC<AICoachPageProps> = ({ user }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hi ${user.name}! 👋 I'm your AI Interview Coach. I can help you prepare for technical interviews, practice common questions, or give tips on behavioral interviews. What would you like to work on today?`,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const API_BASE_URL = 'http://localhost:8000';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('question', userMessage.content);

      const response = await fetch(`${API_BASE_URL}/ai-coach/get-tips`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      let assistantContent = '';
      if (data.error) {
        assistantContent = `I encountered an error: ${data.error}. Please try asking in a different way.`;
      } else if (data.tips) {
        assistantContent = '💡 **Tips:**\n\n' + data.tips.map((tip: string, idx: number) => `${idx + 1}. ${tip}`).join('\n\n');
        if (data.key_points && data.key_points.length > 0) {
          assistantContent += '\n\n🎯 **Key Points to Cover:**\n\n' + data.key_points.map((point: string, idx: number) => `• ${point}`).join('\n');
        }
        if (data.common_mistakes && data.common_mistakes.length > 0) {
          assistantContent += '\n\n⚠️ **Common Mistakes to Avoid:**\n\n' + data.common_mistakes.map((mistake: string, idx: number) => `• ${mistake}`).join('\n');
        }
      } else {
        assistantContent = 'I received an unexpected response. Could you please rephrase your question?';
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    'Help me prepare for a software engineer interview',
    'What are common data structures questions?',
    'Tips for behavioral interviews',
    'How to answer "Tell me about yourself"',
  ];

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl sm:text-2xl shadow-lg">
              🤖
            </div>
            <div className="flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-slate-800">AI Interview Coach</h1>
              <p className="text-xs sm:text-sm text-slate-500">Get personalized interview preparation tips</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 ${message.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-800 shadow-sm border border-slate-200'
                  }`}
              >
                <FormattedText text={message.content} className={message.role === 'user' ? 'text-white' : 'text-slate-800'} />
                <div className={`text-xs mt-1 ${message.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-200">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Actions */}
      {messages.length === 1 && (
        <div className="px-4 pb-4">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs sm:text-sm text-slate-600 mb-3 font-medium">Quick Questions:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(action)}
                  className="text-left text-xs sm:text-sm px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-indigo-300 transition text-slate-700"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-slate-200 px-4 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex gap-2 sm:gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about interviews..."
            rows={1}
            className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm sm:text-base"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="px-4 sm:px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm sm:text-base shadow-md hover:shadow-lg"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default AICoachPage;
