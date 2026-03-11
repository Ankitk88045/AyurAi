import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Plus, 
  History, 
  Settings, 
  LogOut, 
  Send, 
  User, 
  Moon, 
  Sun, 
  Menu, 
  X,
  ShieldCheck,
  BookOpen,
  Trash2,
  LayoutDashboard,
  Play,
  AlertTriangle,
  Leaf
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Chat, Message, User as UserType, AppSettings } from './types';
import { GoogleGenAI } from "@google/genai";
import OpenAI from 'openai';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const icons: Record<string, any> = {
    BookOpen,
    Leaf,
    ShieldCheck,
    MessageSquare,
    Settings,
    History,
    Plus,
    Moon,
    Sun,
    Menu,
    X,
    Trash2,
    LayoutDashboard,
    Play,
    AlertTriangle
  };
  
  const IconComponent = icons[name] || BookOpen;
  return <IconComponent className={className} />;
};

export default function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [chatError, setChatError] = useState('');
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [adminSettings, setAdminSettings] = useState<AppSettings>({});
  const [localAdminSettings, setLocalAdminSettings] = useState<AppSettings>({});
  const [adminSecret, setAdminSecret] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [chatToDelete, setChatToDelete] = useState<number | null>(null);
  const [activeChatIdForDelete, setActiveChatIdForDelete] = useState<number | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [messageCount, setMessageCount] = useState(0);
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [adCountdown, setAdCountdown] = useState(15);
  const [isAdBlockerActive, setIsAdBlockerActive] = useState(false);
  const [coins, setCoins] = useState<number>(10);

  const getDailyCoins = (settings: AppSettings) => {
    const today = new Date().toDateString();
    const stored = localStorage.getItem('ayur_coins');
    const defaultCoins = parseInt(settings.daily_free_coins || '10', 10);
    
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === today) {
        return parsed.coins;
      }
    }
    return defaultCoins;
  };

  const deductCoin = () => {
    const today = new Date().toDateString();
    const newCoins = coins - 1;
    setCoins(newCoins);
    localStorage.setItem('ayur_coins', JSON.stringify({ date: today, coins: newCoins }));
  };

  const languages = [
    { name: 'English', code: 'English' },
    { name: 'हिन्दी', code: 'Hindi' },
    { name: 'मराठी', code: 'Marathi' },
    { name: 'ಕನ್ನಡ', code: 'Kannada' },
    { name: 'தமிழ்', code: 'Tamil' },
    { name: 'संस्कृतम्', code: 'Sanskrit' }
  ];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const clearServerCache = async () => {
    if (confirm('Are you sure you want to clear all server-side AI caches?')) {
      const res = await fetch('/api/admin/clear-cache', { method: 'POST' });
      if (res.ok) alert('Cache cleared successfully');
    }
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const savedUser = adminSettings.admin_username || 'admin';
    const savedPass = adminSettings.admin_password || 'admin@123';
    
    if (adminUsername !== savedUser) {
      setAdminLoginError('Incorrect username.');
    } else if (adminSecret !== savedPass) {
      setAdminLoginError('Incorrect password.');
    } else {
      setAdminLoginError('');
      setIsAdminAuthenticated(true);
    }
  };

  const fetchAdminSettings = async () => {
    const res = await fetch('/api/admin/settings');
    if (res.ok) {
      const data = await res.json();
      const settingsObj = data.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
      setAdminSettings(settingsObj);
      setLocalAdminSettings(settingsObj);
      
      setCoins(getDailyCoins(settingsObj));
      
      // Dynamically update favicon if set
      if (settingsObj.site_favicon_url) {
        let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = settingsObj.site_favicon_url;
      }
    }
  };

  const saveAllAdminSettings = async () => {
    const settingsArray = Object.entries(localAdminSettings).map(([key, value]) => ({ key, value }));
    const res = await fetch('/api/admin/settings/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: settingsArray })
    });
    
    if (res.ok) {
      setAdminSettings(localAdminSettings);
      setToastMessage('Settings saved successfully!');
      setTimeout(() => setToastMessage(''), 3000);
      
      // Update favicon immediately
      if (localAdminSettings.site_favicon_url) {
        let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = localAdminSettings.site_favicon_url;
      }
    } else {
      setToastMessage('Failed to save settings.');
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleCancelSettings = () => {
    setLocalAdminSettings(adminSettings);
    setIsAdminPanelOpen(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, key: 'site_logo_url' | 'site_favicon_url') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setLocalAdminSettings(prev => ({ ...prev, [key]: base64String }));
    };
    reader.readAsDataURL(file);
  };

  const updateLocalSetting = (key: string, value: string) => {
    setLocalAdminSettings(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    fetchAdminSettings();
    fetchChats();
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
    }

    // Load local cache for current chat if available
    const localMessages = localStorage.getItem('local_messages');
    if (localMessages) {
      try {
        const parsed = JSON.parse(localMessages);
        if (parsed.chatId === currentChatId) {
          setMessages(parsed.messages);
        }
      } catch (e) {
        console.error('Failed to load local cache');
      }
    }

    // AdBlocker Detection
    const checkAdBlocker = () => {
      const adScript = document.querySelector('script[src*="adsbygoogle"]');
      if (!adScript) {
        // If script isn't even in head, it might be blocked or not loaded yet
        setTimeout(() => {
          if (!(window as any).adsbygoogle) setIsAdBlockerActive(true);
        }, 3000);
      }
    };
    checkAdBlocker();
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showInterstitial && adCountdown > 0) {
      timer = setInterval(() => {
        setAdCountdown(prev => prev - 1);
      }, 1000);
    } else if (adCountdown === 0) {
      setShowInterstitial(false);
      setAdCountdown(15);
    }
    return () => clearInterval(timer);
  }, [showInterstitial, adCountdown]);

  const fetchChats = async () => {
    const res = await fetch('/api/chats');
    if (res.ok) {
      const data = await res.json();
      setChats(data);
    }
  };

  const fetchMessages = async (chatId: number) => {
    const res = await fetch(`/api/chats/${chatId}/messages`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data);
    }
  };

  useEffect(() => {
    if (currentChatId) {
      fetchMessages(currentChatId);
      // Close sidebar on mobile when a chat is selected
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    }
  }, [currentChatId]);

  // Update local device cache whenever messages change
  useEffect(() => {
    if (currentChatId && messages.length > 0) {
      localStorage.setItem('local_messages', JSON.stringify({
        chatId: currentChatId,
        messages: messages
      }));
    }
  }, [messages, currentChatId]);

  const createNewChat = async () => {
    const res = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Ayurvedic Inquiry' })
    });
    if (res.ok) {
      const data = await res.json();
      setChats([data, ...chats]);
      setCurrentChatId(data.id);
      setMessages([]);
    }
  };

  const deleteChat = async (id: number) => {
    const res = await fetch(`/api/chats/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setChats(chats.filter(c => c.id !== id));
      if (currentChatId === id) {
        setCurrentChatId(null);
        setMessages([]);
      }
      setChatToDelete(null);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setChatError('');

    if (coins <= 0) {
      setChatError("You have reached your daily limit of free queries. Please try again tomorrow.");
      return;
    }

    let chatId = currentChatId;
    if (!chatId) {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: input.slice(0, 30) + '...' })
      });
      const data = await res.json();
      chatId = data.id;
      setCurrentChatId(chatId);
      setChats([data, ...chats]);
    }

    const userMsg: Message = {
      id: Date.now(),
      chat_id: chatId!,
      role: 'user',
      content: input,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Interstitial Ad Logic: Show after every 3 messages
    const newCount = messageCount + 1;
    setMessageCount(newCount);
    const interstitialSlot = adminSettings.adsense_interstitial_slot;
    if (newCount % 3 === 0 && interstitialSlot && interstitialSlot !== '#') {
      setShowInterstitial(true);
      setAdCountdown(15);
    }

    try {
      // Check Server-side Cache first
      const cacheRes = await fetch(`/api/ai/cache?prompt=${encodeURIComponent(input)}&lang=${encodeURIComponent(selectedLanguage)}`);
      const cacheData = await cacheRes.json();

      if (cacheData.found) {
        const aiMsgId = Date.now() + 1;
        const cachedAiMsg: Message = {
          id: aiMsgId,
          chat_id: chatId!,
          role: 'model',
          content: cacheData.response,
          created_at: new Date().toISOString(),
          is_cached: true
        };
        
        setMessages(prev => [...prev, cachedAiMsg]);
        setIsLoading(false);

        // Save cached message to DB
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, role: 'model', content: cacheData.response, is_cached: true })
        });
        return;
      }

      // Save user message to DB
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, role: 'user', content: input })
      });

      // Get API Keys from admin settings
      const geminiKeys = (adminSettings.gemini_keys || '').split(',').map(k => k.trim()).filter(k => k);
      const openaiKeys = (adminSettings.openai_keys || '').split(',').map(k => k.trim()).filter(k => k);
      const grokKeys = (adminSettings.grok_keys || '').split(',').map(k => k.trim()).filter(k => k);
      
      const allProviders = [
        ...geminiKeys.map(key => ({ type: 'gemini', key })),
        ...openaiKeys.map(key => ({ type: 'openai', key })),
        ...grokKeys.map(key => ({ type: 'grok', key }))
      ];

      if (allProviders.length === 0) {
        throw new Error('No AI API keys configured. Please add them in the Admin Panel.');
      }

      let aiContent = '';
      let lastError = null;

      const aiMsgId = Date.now() + 1;
      const initialAiMsg: Message = {
        id: aiMsgId,
        chat_id: chatId!,
        role: 'model',
        content: '',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, initialAiMsg]);
      setIsLoading(false);

      // Try each provider/key until one works
      for (const provider of allProviders) {
        try {
          aiContent = ''; // Reset for each provider attempt
          setMessages(prev => prev.map(m => 
            m.id === aiMsgId ? { ...m, content: '' } : m
          ));

          if (provider.type === 'gemini') {
            const ai = new GoogleGenAI({ apiKey: provider.key });
            const contents = messages.map(m => ({
              role: m.role,
              parts: [{ text: m.content }]
            }));
            contents.push({ role: 'user', parts: [{ text: input }] });

            const streamResult = await ai.models.generateContentStream({
              model: "gemini-3.1-pro-preview",
              contents: contents as any,
              config: {
                systemInstruction: `You are Ayur AI, an expert AI assistant specialized in Ayurveda. 
Your goal is to provide authentic, accurate, and classical information to Ayurveda students.
IMPORTANT: You MUST provide your response in ${selectedLanguage}.

Formatting Guidelines:
1. Use Markdown for all responses.
2. Use Bold for key Ayurvedic terms.
3. Use Blockquotes for Sanskrit Shlokas.
4. Use Bullet points for lists of properties or ingredients.
5. Always include a "References" section at the end.
6. Structure your answer with clear headings (H2 or H3).

Content Guidelines:
1. Always base your answers on classical texts like Charaka Samhita, Sushruta Samhita, Ashtanga Hridaya, etc.
2. When answering, provide the relevant Shloka (in Sanskrit/Devanagari) if possible.
3. Always provide the reference (Sthana, Adhyaya, Shloka number) for the information.
4. Handling Ambiguity & Multiple Perspectives: If a topic is ambiguous, controversial, or has multiple viewpoints across different classical texts (e.g., differences between Charaka and Sushruta), you MUST explicitly state these differences. Provide the perspective of each relevant text clearly, comparing and contrasting them. Do not present a single view as absolute if classical sources disagree.
5. Use a professional, academic, yet accessible tone.
6. If you don't know an answer or if it's not in classical texts, state it clearly.
7. Encourage students to consult original texts and teachers (Gurus).`,
              }
            });

            for await (const chunk of streamResult) {
              const chunkText = (chunk as any).text || '';
              aiContent += chunkText;
              setMessages(prev => prev.map(m => 
                m.id === aiMsgId ? { ...m, content: aiContent } : m
              ));
            }
          } else {
            // OpenAI or Grok
            const baseURL = provider.type === 'grok' ? 'https://api.x.ai/v1' : undefined;
            const model = provider.type === 'grok' ? 'grok-2-latest' : 'gpt-4o';
            
            const openai = new OpenAI({ 
              apiKey: provider.key, 
              baseURL,
              dangerouslyAllowBrowser: true 
            });

            const response = await openai.chat.completions.create({
              model: model,
              messages: [
                { role: 'system', content: `You are Ayur AI, an expert AI assistant specialized in Ayurveda. 
Your goal is to provide authentic, accurate, and classical information to Ayurveda students.
IMPORTANT: You MUST provide your response in ${selectedLanguage}.

Formatting Guidelines:
1. Use Markdown for all responses.
2. Use Bold for key Ayurvedic terms.
3. Use Blockquotes for Sanskrit Shlokas.
4. Use Bullet points for lists of properties or ingredients.
5. Always include a "References" section at the end.
6. Structure your answer with clear headings (H2 or H3).

Content Guidelines:
1. Always base your answers on classical texts like Charaka Samhita, Sushruta Samhita, Ashtanga Hridaya, etc.
2. When answering, provide the relevant Shloka (in Sanskrit/Devanagari) if possible.
3. Always provide the reference (Sthana, Adhyaya, Shloka number) for the information.
4. Handling Ambiguity & Multiple Perspectives: If a topic is ambiguous, controversial, or has multiple viewpoints across different classical texts (e.g., differences between Charaka and Sushruta), you MUST explicitly state these differences. Provide the perspective of each relevant text clearly, comparing and contrasting them. Do not present a single view as absolute if classical sources disagree.
5. Use a professional, academic, yet accessible tone.
6. If you don't know an answer or if it's not in classical texts, state it clearly.
7. Encourage students to consult original texts and teachers (Gurus).` } as any,
                ...messages.map(m => ({ 
                  role: m.role === 'model' ? 'assistant' : 'user', 
                  content: m.content 
                })),
                { role: 'user', content: input }
              ] as any,
              stream: true,
            });

            for await (const chunk of response) {
              const content = chunk.choices[0]?.delta?.content || '';
              aiContent += content;
              setMessages(prev => prev.map(m => 
                m.id === aiMsgId ? { ...m, content: aiContent } : m
              ));
            }
          }

          // Save to Server-side Cache
          await fetch('/api/ai/cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: input, response: aiContent, lang: selectedLanguage })
          });
          
          if (aiContent) break; // Success!
        } catch (err: any) {
          console.error(`${provider.type} API Key failed: ${provider.key.slice(0, 8)}...`, err);
          lastError = err;
          // Continue to next key/provider
        }
      }

      if (!aiContent) {
        setMessages(prev => prev.filter(m => m.id !== aiMsgId));
        throw lastError || new Error('All API keys failed');
      }

      deductCoin();

      // Save AI message to DB
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, role: 'model', content: aiContent })
      });
    } catch (err: any) {
      console.error(err);
      setChatError(`Failed to get response from Ayur AI: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-[#f4ece1] dark:bg-zinc-950 overflow-hidden parchment-bg relative">
      <div className="dhanwantari-watermark" />
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl font-semibold text-sm flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {chatToDelete !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#fcfaf7] dark:bg-zinc-900 p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-amber-200/50 dark:border-zinc-800"
            >
              <h3 className="text-lg font-bold dark:text-white mb-2">Delete Inquiry?</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
                This will permanently delete this conversation and all its messages. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => deleteChat(chatToDelete)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors"
                >
                  Delete
                </button>
                <button 
                  onClick={() => setChatToDelete(null)}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 py-2 rounded-lg font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Panel Modal */}
      <AnimatePresence>
        {isAdminPanelOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#fcfaf7] dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl border border-amber-200/50 dark:border-zinc-800 overflow-hidden"
            >
              {!isAdminAuthenticated ? (
                <div className="p-8">
                  <h3 className="text-xl font-bold dark:text-white mb-4">Admin Access</h3>
                  {adminLoginError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm font-medium">
                      {adminLoginError}
                    </div>
                  )}
                  <form onSubmit={handleAdminAuth} className="space-y-4">
                    <input 
                      type="text" 
                      placeholder="Username"
                      className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                    />
                    <input 
                      type="password" 
                      placeholder="Password"
                      className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                      value={adminSecret}
                      onChange={(e) => setAdminSecret(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-semibold">Login</button>
                      <button type="button" onClick={() => setIsAdminPanelOpen(false)} className="px-4 py-2 text-zinc-500">Cancel</button>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                      <ShieldCheck className="w-6 h-6 text-emerald-600" />
                      Admin Configuration
                    </h3>
                    <button onClick={() => setIsAdminPanelOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                      <X className="w-5 h-5 dark:text-white" />
                    </button>
                  </div>
                    <div className="p-6 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                      {/* Branding Section */}
                      <section className="space-y-4">
                        <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2">Branding & Identity</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">Website Name</label>
                            <input 
                              type="text"
                              className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                              placeholder="Ayur AI"
                              value={localAdminSettings.site_name || ''}
                              onChange={(e) => updateLocalSetting('site_name', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">Logo Icon (Lucide)</label>
                            <input 
                              type="text"
                              className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                              placeholder="BookOpen, Leaf..."
                              value={localAdminSettings.site_logo_icon || ''}
                              onChange={(e) => updateLocalSetting('site_logo_icon', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">Custom Logo Image</label>
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden">
                                {localAdminSettings.site_logo_url ? (
                                  <img src={localAdminSettings.site_logo_url} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                ) : (
                                  <BookOpen className="w-6 h-6 text-zinc-400" />
                                )}
                              </div>
                              <label className="flex-1 cursor-pointer bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-xl text-xs text-center hover:bg-zinc-50 transition-all">
                                Upload Logo
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'site_logo_url')} />
                              </label>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">Custom Favicon</label>
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden">
                                {localAdminSettings.site_favicon_url ? (
                                  <img src={localAdminSettings.site_favicon_url} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                ) : (
                                  <span className="text-xl">🌿</span>
                                )}
                              </div>
                              <label className="flex-1 cursor-pointer bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-xl text-xs text-center hover:bg-zinc-50 transition-all">
                                Upload Favicon
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'site_favicon_url')} />
                              </label>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* AI Configuration Section */}
                      <section className="space-y-4">
                        <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2">AI API Configuration</h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">Gemini AI API Keys</label>
                            <textarea 
                              className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all h-20"
                              placeholder="AIza..., AIza..."
                              value={localAdminSettings.gemini_keys || ''}
                              onChange={(e) => updateLocalSetting('gemini_keys', e.target.value)}
                            />
                            <p className="text-[10px] text-zinc-400 mt-1 italic">Rotation: Key 1 → Key 2 → ...</p>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">ChatGPT (OpenAI) API Keys</label>
                            <textarea 
                              className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all h-20"
                              placeholder="sk-..., sk-..."
                              value={localAdminSettings.openai_keys || ''}
                              onChange={(e) => updateLocalSetting('openai_keys', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">Grok (xAI) API Keys</label>
                            <textarea 
                              className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all h-20"
                              placeholder="xai-..., xai-..."
                              value={localAdminSettings.grok_keys || ''}
                              onChange={(e) => updateLocalSetting('grok_keys', e.target.value)}
                            />
                          </div>
                        </div>
                      </section>

                      {/* Admin Access Section */}
                      <section className="space-y-4">
                        <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2">User Roles & Limits</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">Daily Free Coins (Per User)</label>
                            <input 
                              type="number"
                              className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                              value={localAdminSettings.daily_free_coins || 10}
                              onChange={(e) => updateLocalSetting('daily_free_coins', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">Max Users Allowed</label>
                            <input 
                              type="number"
                              className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                              value={localAdminSettings.max_users || 25}
                              onChange={(e) => updateLocalSetting('max_users', e.target.value)}
                            />
                          </div>
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2">Security & Access</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">Admin Username</label>
                            <input 
                              type="text"
                              className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                              placeholder="admin"
                              value={localAdminSettings.admin_username || ''}
                              onChange={(e) => updateLocalSetting('admin_username', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">Admin Password</label>
                            <input 
                              type="password"
                              className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                              placeholder="New Password"
                              value={localAdminSettings.admin_password || ''}
                              onChange={(e) => updateLocalSetting('admin_password', e.target.value)}
                            />
                          </div>
                        </div>
                      </section>

                      {/* AdSense Section */}
                      <section className="space-y-4">
                        <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2">Monetization (AdSense)</h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">Publisher ID</label>
                            <input 
                              type="text"
                              className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                              placeholder="ca-pub-..."
                              value={localAdminSettings.adsense_client_id || ''}
                              onChange={(e) => updateLocalSetting('adsense_client_id', e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Home Slot</label>
                              <input 
                                type="text"
                                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                                value={localAdminSettings.adsense_home_slot || ''}
                                onChange={(e) => updateLocalSetting('adsense_home_slot', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Chat Slot</label>
                              <input 
                                type="text"
                                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                                value={localAdminSettings.adsense_chat_slot || ''}
                                onChange={(e) => updateLocalSetting('adsense_chat_slot', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Interstitial</label>
                              <input 
                                type="text"
                                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                                value={localAdminSettings.adsense_interstitial_slot || ''}
                                onChange={(e) => updateLocalSetting('adsense_interstitial_slot', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </section>

                      <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-3">
                        <div className="flex gap-3">
                          <button 
                            onClick={handleCancelSettings}
                            className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold transition-all"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={saveAllAdminSettings}
                            className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"
                          >
                            <ShieldCheck className="w-5 h-5" />
                            Save All Settings
                          </button>
                        </div>
                        <button 
                          onClick={clearServerCache}
                          className="w-full py-2 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        >
                          Clear AI Cache
                        </button>
                      </div>
                    </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed lg:relative inset-y-0 left-0 w-72 bg-[#1a120b] dark:bg-zinc-900 border-r border-amber-900/20 dark:border-zinc-800 flex flex-col z-50 shadow-2xl lg:shadow-none"
          >
            <div className="p-4 flex items-center justify-between border-b border-amber-900/20 dark:border-zinc-800 mb-2">
              <div className="flex items-center gap-2">
                {adminSettings.site_logo_url ? (
                  <img src={adminSettings.site_logo_url} className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <DynamicIcon 
                    name={adminSettings.site_logo_icon || 'BookOpen'} 
                    className="w-6 h-6 text-amber-500 dark:text-amber-500" 
                  />
                )}
                <span className="font-display font-bold text-xl tracking-tight text-amber-400 dark:text-amber-500">
                  {adminSettings.site_name || 'Ayur AI'}
                </span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden">
                <X className="w-5 h-5 text-amber-200/50" />
              </button>
            </div>

            <button 
              onClick={createNewChat}
              className="mx-4 mb-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white transition-all text-sm font-bold shadow-lg shadow-amber-900/40 border border-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              New Inquiry
            </button>

            <div className="flex-1 overflow-y-auto px-2 space-y-1">
              <div className="px-3 py-2 text-[10px] font-bold text-amber-500/50 uppercase tracking-widest">Recent History</div>
              {chats.map(chat => (
                <div key={chat.id} className="group relative">
                  <button
                    onClick={() => {
                      if (activeChatIdForDelete === chat.id) {
                        setCurrentChatId(chat.id);
                        setActiveChatIdForDelete(null); // Reset after opening
                      } else {
                        setActiveChatIdForDelete(chat.id);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left pr-10",
                      currentChatId === chat.id 
                        ? "bg-amber-900/40 text-amber-200 border border-amber-500/20" 
                        : "text-amber-100/60 hover:bg-amber-900/20 hover:text-amber-100",
                      activeChatIdForDelete === chat.id && "bg-amber-900/10"
                    )}
                  >
                    <MessageSquare className={cn("w-4 h-4 flex-shrink-0", currentChatId === chat.id ? "text-amber-400" : "text-amber-500/40")} />
                    <span className="truncate font-serif">{chat.title}</span>
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setChatToDelete(chat.id);
                    }}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-red-500 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 group-hover:opacity-100 group-hover:scale-110",
                      activeChatIdForDelete === chat.id ? "opacity-100" : "opacity-0 pointer-events-none"
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-amber-900/20 dark:border-zinc-800 space-y-2">
              <button 
                onClick={() => {
                  setIsSidebarOpen(false);
                  setIsAdminPanelOpen(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-amber-100/60 hover:bg-amber-900/20 hover:text-amber-100 transition-all font-serif"
              >
                <LayoutDashboard className="w-4 h-4" />
                Admin Panel
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0 h-full overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-amber-900/20 flex items-center justify-between px-4 bg-[#1a120b]/90 dark:bg-zinc-950/90 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-white/5 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                <Menu className="w-5 h-5 text-amber-200" />
              </button>
            )}
            <h2 className="font-display font-bold text-amber-400 dark:text-amber-500 tracking-tight truncate max-w-[150px] sm:max-w-xs">
              {currentChatId ? chats.find(c => c.id === currentChatId)?.title : 'Ayur AI Assistant'}
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <select 
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="p-1.5 rounded-xl bg-amber-900/40 dark:bg-zinc-900 text-amber-200 dark:text-zinc-400 hover:bg-amber-900/60 transition-all border border-amber-500/20 shadow-sm text-[10px] font-bold outline-none cursor-pointer"
            >
              {languages.map(lang => (
                <option key={lang.code} value={lang.code} className="bg-[#1a120b]">{lang.name}</option>
              ))}
            </select>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl bg-amber-900/40 dark:bg-zinc-900 text-amber-200 dark:text-zinc-400 hover:bg-amber-900/60 transition-all border border-amber-500/20 shadow-sm"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-emerald-900/40 text-emerald-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" />
              Vedic Wisdom
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-amber-900/40 text-amber-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-amber-500/20">
              <span className="text-xs">🪙</span>
              {coins} Coins
            </div>
          </div>
        </header>

        {/* Disclaimer Banner */}
        <div className="disclaimer-banner sticky top-14 z-[25]">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
            <Leaf className="w-3 h-3 text-emerald-500 flex-shrink-0" />
            <p>
              <span className="font-bold not-italic mr-1 text-amber-400">DISCLAIMER:</span>
              Ayur AI provides information based on classical texts. Always verify with original Samhitas and your Guru.
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
          <div className="max-w-4xl mx-auto w-full">
            {messages.length === 0 && !currentChatId && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto px-4 py-12">
              <div className="w-24 h-24 bg-amber-900/40 dark:bg-amber-900/20 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-black/50 border border-amber-500/20 rotate-3 overflow-hidden">
                {adminSettings.site_logo_url ? (
                  <img src={adminSettings.site_logo_url} className="w-full h-full object-contain -rotate-3 scale-110" referrerPolicy="no-referrer" />
                ) : (
                  <DynamicIcon 
                    name={adminSettings.site_logo_icon || 'BookOpen'} 
                    className="w-12 h-12 text-amber-400 dark:text-amber-500 -rotate-3" 
                  />
                )}
              </div>
              <h1 className="text-4xl font-display font-bold text-amber-400 dark:text-amber-500 mb-4 tracking-tighter">
                {adminSettings.site_name || 'Ayur AI'}
              </h1>
              <div className="bg-amber-900/30 dark:bg-amber-900/10 border border-amber-500/20 dark:border-amber-800/50 rounded-2xl p-6 mb-8 max-w-md backdrop-blur-sm">
                <p className="text-sm text-amber-100/80 dark:text-amber-400/70 font-serif italic leading-relaxed">
                  "Ayur AI provides information based on classical texts. Always verify with original Samhitas and your Guru."
                </p>
              </div>
              <p className="text-amber-100/60 dark:text-zinc-400 mb-10 max-w-md font-serif italic text-base leading-relaxed">
                "Knowledge of life is the greatest of all sciences."
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                {[
                  "Concept of Tridosha",
                  "Properties of Amalaki",
                  "Definition of 'Swastha'",
                  "The 13 types of Agni"
                ].map((q, i) => (
                  <button 
                    key={i}
                    onClick={() => setInput(q)}
                    className="p-5 text-left text-sm rounded-2xl border border-amber-500/20 dark:border-amber-900/30 bg-amber-900/20 dark:bg-zinc-900/50 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-900/40 dark:hover:bg-amber-900/10 transition-all text-amber-100/80 dark:text-zinc-300 shadow-xl font-serif"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={msg.id} className="space-y-4">
              <div 
                className={cn(
                  "flex gap-4 max-w-4xl mx-auto",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-lg bg-amber-700 flex items-center justify-center flex-shrink-0 mt-1 shadow-lg shadow-amber-900/20">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className={cn(
                  "px-4 py-3 rounded-2xl max-w-[85%] shadow-xl backdrop-blur-sm relative",
                  msg.role === 'user' 
                    ? "bg-amber-700/80 text-white font-serif text-[13px] border border-amber-500/30" 
                    : "bg-amber-900/40 dark:bg-zinc-900/80 dark:text-zinc-100 border border-amber-500/20 dark:border-amber-900/30 text-[13px] text-amber-50"
                )}>
                  {msg.is_cached && (
                    <div className="absolute -top-2.5 -right-2 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-0.5 border border-emerald-400/30">
                      ⚡ Cached
                    </div>
                  )}
                  <div className="markdown-body text-[13px]">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                    <User className="w-5 h-5 text-zinc-500" />
                  </div>
                )}
              </div>
              
              {/* Small Ad after AI response */}
              {msg.role === 'model' && idx < messages.length - 1 && adminSettings.adsense_chat_slot !== '#' && (
                <div className="max-w-md mx-auto my-4">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[8px] text-zinc-400 uppercase tracking-widest">Advertisement</span>
                    <div className="h-12 w-full bg-amber-100/20 dark:bg-zinc-900/30 border border-dashed border-amber-200/50 dark:border-zinc-800 rounded-lg flex items-center justify-center overflow-hidden">
                      {adminSettings.adsense_client_id && adminSettings.adsense_chat_slot ? (
                        <ins className="adsbygoogle"
                             style={{ display: 'block', width: '100%', height: '48px' }}
                             data-ad-client={adminSettings.adsense_client_id}
                             data-ad-slot={adminSettings.adsense_chat_slot}
                             data-ad-format="horizontal"></ins>
                      ) : (
                        <span className="text-[9px] text-zinc-400 italic">Sponsored Content</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 max-w-4xl mx-auto">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0 animate-pulse">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-900 px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

        {/* Ad Placeholder (Narrower & Smaller) */}
        {adminSettings.adsense_home_slot !== '#' && (
          <div className="max-w-xl mx-auto w-full px-4 mb-2">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[8px] text-zinc-400 uppercase tracking-widest">Advertisement</span>
              {adminSettings.adsense_client_id && adminSettings.adsense_home_slot ? (
                <div className="h-12 w-full bg-amber-100/20 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800 rounded-lg flex items-center justify-center overflow-hidden">
                  <ins className="adsbygoogle"
                       style={{ display: 'block', width: '100%', height: '48px' }}
                       data-ad-client={adminSettings.adsense_client_id}
                       data-ad-slot={adminSettings.adsense_home_slot}
                       data-ad-format="horizontal"
                       data-full-width-responsive="false"></ins>
                </div>
              ) : (
                <div className="h-10 w-full bg-amber-100/10 dark:bg-zinc-900/30 border border-dashed border-zinc-300/30 dark:border-zinc-800 rounded-lg flex items-center justify-center text-[9px] text-zinc-400 uppercase tracking-widest">
                  Banner Ad
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 bg-transparent">
          <div className="max-w-3xl mx-auto">
            {chatError && (
              <div className="mb-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center justify-between shadow-sm">
                <span>{chatError}</span>
                <button type="button" onClick={() => setChatError('')} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <form onSubmit={sendMessage} className="relative group">
              <div className="relative flex items-end">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Ask Ayur AI..."
                className="w-full pl-5 pr-12 py-4 bg-amber-50/80 dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/30 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none resize-none text-zinc-900 dark:text-white transition-all shadow-xl shadow-amber-900/5 font-serif text-sm min-h-[56px] max-h-[150px] overflow-y-auto"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
              />
              <button 
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2.5 bottom-2.5 p-2 bg-amber-700 hover:bg-amber-800 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white rounded-xl transition-all shadow-lg shadow-amber-900/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
          </div>
        </div>
      </main>
      {/* AdBlocker Warning */}
      <AnimatePresence>
        {isAdBlockerActive && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md"
          >
            <div className="bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-red-500">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm">Ad Blocker Detected</h4>
                <p className="text-[10px] opacity-90 leading-tight">Please disable your ad blocker to support Ayur AI and ensure all features work correctly.</p>
              </div>
              <button 
                onClick={() => setIsAdBlockerActive(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interstitial Ad Overlay */}
      <AnimatePresence>
        {showInterstitial && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="absolute top-6 right-6 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm font-bold border border-white/20">
              Ad ends in: {adCountdown}s
            </div>
            
            <div className="max-w-2xl w-full space-y-8">
              <div className="aspect-video bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-center overflow-hidden shadow-2xl relative">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent" />
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-amber-600 rounded-full flex items-center justify-center animate-pulse">
                    <Play className="w-8 h-8 text-white fill-white" />
                  </div>
                  <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">Video Ad Playing</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-3xl font-display font-bold text-white tracking-tight">Vedic Wellness Premium</h2>
                <p className="text-zinc-400 text-lg font-serif italic">"Unlock deep Ayurvedic insights with our masterclass series."</p>
                <button className="px-8 py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all shadow-xl shadow-amber-900/40">
                  Learn More
                </button>
              </div>
            </div>
            
            <p className="absolute bottom-10 text-zinc-600 text-[10px] uppercase tracking-widest">Advertisement</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
