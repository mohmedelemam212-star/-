/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Moon, Sun, Compass, BookOpen, ScrollText, 
  Clock, Heart, ChevronLeft, ChevronRight, 
  Menu, X, RefreshCw, MapPin, Play, Pause,
  Type, Bookmark, BookmarkCheck, Volume2, VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Coordinates, CalculationMethod, PrayerTimes, Qibla } from 'adhan';
import { format } from 'date-fns';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { getIslamicStories, getDailyWisdom } from './services/geminiService';
import { MORNING_AZKAR, EVENING_AZKAR, TASBEEH_OPTIONS } from './constants';
import { PrayerTime, QuranSurah, QuranAyah, Zikr, Reciter } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([]);
  const [nextPrayer, setNextPrayer] = useState<PrayerTime | null>(null);
  const [qiblaDirection, setQiblaDirection] = useState<number>(0);
  const [surahs, setSurahs] = useState<QuranSurah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<QuranSurah | null>(null);
  const [ayahs, setAyahs] = useState<QuranAyah[]>([]);
  const [loadingQuran, setLoadingQuran] = useState(false);
  const [storyTopic, setStoryTopic] = useState('النبي محمد صلى الله عليه وسلم');
  const [story, setStory] = useState('');
  const [loadingStory, setLoadingStory] = useState(false);
  const [wisdom, setWisdom] = useState('');
  const [tasbeehCount, setTasbeehCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [quranFontSize, setQuranFontSize] = useState(24);
  const [bookmarks, setBookmarks] = useState<number[]>(() => {
    const saved = localStorage.getItem('quran_bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audio] = useState(new Audio());
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [activeReciter, setActiveReciter] = useState('ar.alafasy');
  const [showTafsir, setShowTafsir] = useState(false);
  const [quranViewMode, setQuranViewMode] = useState<'reading' | 'tafsir'>('reading');
  const [quranTheme, setQuranTheme] = useState<'classic' | 'dark' | 'green'>('classic');
  const [selectedTasbeeh, setSelectedTasbeeh] = useState<string | null>(null);
  const [prayerCountdown, setPrayerCountdown] = useState<string>('');
  const [isAfterPrayer, setIsAfterPrayer] = useState(false);

  // Fetch Reciters
  useEffect(() => {
    const fetchReciters = async () => {
      try {
        const res = await fetch('https://api.alquran.cloud/v1/edition?format=audio&language=ar');
        const data = await res.json();
        const popularReciters = data.data.filter((r: any) => 
          ['ar.alafasy', 'ar.abdulsamad', 'ar.minshawi', 'ar.husary'].includes(r.identifier)
        );
        setReciters(popularReciters.length > 0 ? popularReciters : data.data.slice(0, 10));
      } catch (err) {
        console.error("Error fetching reciters:", err);
      }
    };
    fetchReciters();
  }, []);

  // Save bookmarks to localStorage
  useEffect(() => {
    localStorage.setItem('quran_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  // Handle Audio Cleanup and Tab/Surah changes
  useEffect(() => {
    audio.pause();
    setPlayingAyah(null);
  }, [activeTab, selectedSurah, audio]);

  useEffect(() => {
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [audio]);

  // Initialize Location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          // Default to Mecca if location fails
          setLocation({ lat: 21.4225, lng: 39.8262 });
        }
      );
    }
  }, []);

  // Calculate Prayer Times and Countdown
  useEffect(() => {
    if (location) {
      const updatePrayerTimes = () => {
        const coords = new Coordinates(location.lat, location.lng);
        const params = CalculationMethod.MuslimWorldLeague();
        const date = new Date();
        const times = new PrayerTimes(coords, date, params);

        const formattedTimes: PrayerTime[] = [
          { name: 'Fajr', arabicName: 'الفجر', time: format(times.fajr, 'hh:mm a') },
          { name: 'Sunrise', arabicName: 'الشروق', time: format(times.sunrise, 'hh:mm a') },
          { name: 'Dhuhr', arabicName: 'الظهر', time: format(times.dhuhr, 'hh:mm a') },
          { name: 'Asr', arabicName: 'العصر', time: format(times.asr, 'hh:mm a') },
          { name: 'Maghrib', arabicName: 'المغرب', time: format(times.maghrib, 'hh:mm a') },
          { name: 'Isha', arabicName: 'العشاء', time: format(times.isha, 'hh:mm a') },
        ];

        setPrayerTimes(formattedTimes);
        setQiblaDirection(Qibla(coords));

        const now = new Date();
        const next = times.nextPrayer();
        const current = times.currentPrayer();
        
        let targetPrayer = next;
        let isAfter = false;

        // Check if we are within 20 minutes after a prayer
        if (current !== 'none') {
          const currentTime = times.timeForPrayer(current);
          if (currentTime) {
            const diffMs = now.getTime() - currentTime.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins <= 20) {
              targetPrayer = current;
              isAfter = true;
            }
          }
        }

        if (targetPrayer !== 'none') {
          const prayerTime = times.timeForPrayer(targetPrayer);
          if (prayerTime) {
            const prayerNames: Record<string, string> = {
              fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', 
              maghrib: 'المغرب', isha: 'العشاء', sunrise: 'الشروق'
            };
            
            setNextPrayer({
              name: targetPrayer,
              arabicName: prayerNames[targetPrayer] || targetPrayer,
              time: format(prayerTime, 'hh:mm a')
            });

            const diffMs = isAfter ? now.getTime() - prayerTime.getTime() : prayerTime.getTime() - now.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const hours = Math.floor(diffMins / 60);
            const mins = diffMins % 60;

            setIsAfterPrayer(isAfter);
            if (isAfter) {
              setPrayerCountdown(`مضى على ${prayerNames[targetPrayer]} ${mins} دقيقة`);
            } else {
              setPrayerCountdown(hours > 0 ? `باقي ${hours} ساعة و ${mins} دقيقة` : `باقي ${mins} دقيقة`);
            }
          }
        }
      };

      updatePrayerTimes();
      const interval = setInterval(updatePrayerTimes, 60000);
      return () => clearInterval(interval);
    }
  }, [location]);

  // Fetch Quran Surahs
  useEffect(() => {
    const fetchSurahs = async () => {
      try {
        const res = await fetch('https://api.alquran.cloud/v1/surah');
        const data = await res.json();
        setSurahs(data.data);
      } catch (err) {
        console.error("Error fetching surahs:", err);
      }
    };
    fetchSurahs();
  }, []);

  // Fetch Ayahs with Tafsir when Surah is selected
  useEffect(() => {
    if (selectedSurah) {
      const fetchAyahsAndTafsir = async () => {
        setLoadingQuran(true);
        try {
          const [ayahsRes, tafsirRes] = await Promise.all([
            fetch(`https://api.alquran.cloud/v1/surah/${selectedSurah.number}`),
            fetch(`https://api.alquran.cloud/v1/surah/${selectedSurah.number}/ar.jalalayn`)
          ]);
          const ayahsData = await ayahsRes.json();
          const tafsirData = await tafsirRes.json();
          
          const combinedAyahs = ayahsData.data.ayahs.map((ayah: any, index: number) => ({
            ...ayah,
            tafsir: tafsirData.data.ayahs[index].text
          }));
          
          setAyahs(combinedAyahs);
        } catch (err) {
          console.error("Error fetching ayahs/tafsir:", err);
        } finally {
          setLoadingQuran(false);
        }
      };
      fetchAyahsAndTafsir();
    }
  }, [selectedSurah]);

  // Fetch Daily Wisdom
  useEffect(() => {
    const fetchWisdom = async () => {
      const w = await getDailyWisdom();
      setWisdom(w);
    };
    fetchWisdom();
  }, []);

  const handleFetchStory = async (topic: string) => {
    setLoadingStory(true);
    setStoryTopic(topic);
    try {
      const s = await getIslamicStories(topic);
      setStory(s);
    } catch (err) {
      console.error("Error fetching story:", err);
    } finally {
      setLoadingStory(false);
    }
  };

  const handlePlayAyah = async (ayahNumber: number) => {
    try {
      if (playingAyah === ayahNumber) {
        audio.pause();
        setPlayingAyah(null);
        setIsAudioLoading(false);
      } else {
        audio.pause();
        setIsAudioLoading(true);
        setPlayingAyah(ayahNumber);

        const audioUrl = `https://cdn.islamic.network/quran/audio/128/${activeReciter}/${ayahNumber}.mp3`;
        audio.src = audioUrl;
        audio.load();
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsAudioLoading(false);
            })
            .catch(error => {
              console.error("Playback failed:", error);
              setPlayingAyah(null);
              setIsAudioLoading(false);
            });
        }
        
        audio.onended = () => {
          setPlayingAyah(null);
          setIsAudioLoading(false);
        };
        audio.onerror = () => {
          console.error("Audio source error");
          setPlayingAyah(null);
          setIsAudioLoading(false);
        };
      }
    } catch (err) {
      console.error("Error in handlePlayAyah:", err);
      setPlayingAyah(null);
      setIsAudioLoading(false);
    }
  };

  const toggleBookmark = (ayahNumber: number) => {
    setBookmarks(prev => 
      prev.includes(ayahNumber) 
        ? prev.filter(id => id !== ayahNumber) 
        : [...prev, ayahNumber]
    );
  };

  const navItems = [
    { id: 'home', label: 'الرئيسية', icon: Sun, color: 'bg-amber-500' },
    { id: 'prayer', label: 'مواقيت الصلاة', icon: Clock, color: 'bg-teal-500' },
    { id: 'quran', label: 'المصحف', icon: BookOpen, color: 'bg-emerald-500' },
    { id: 'azkar', label: 'الأذكار', icon: Heart, color: 'bg-rose-500' },
    { id: 'tasbeeh', label: 'السبحة', icon: Play, color: 'bg-indigo-500' },
    { id: 'qibla', label: 'القبلة', icon: Compass, color: 'bg-orange-500' },
    { id: 'stories', label: 'القصص', icon: ScrollText, color: 'bg-sky-500' },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-stone-50 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-emerald-800 text-white shadow-md z-50">
        <button onClick={() => setIsSidebarOpen(true)}>
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-bold font-arabic">نور الإسلام</h1>
        <div className="w-6" /> {/* Spacer */}
      </div>

      {/* Sidebar Navigation */}
      <AnimatePresence>
        {(isSidebarOpen || window.innerWidth >= 768) && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "fixed inset-y-0 right-0 w-64 bg-emerald-900 text-emerald-50 z-50 shadow-2xl md:relative md:translate-x-0",
              !isSidebarOpen && "hidden md:flex"
            )}
          >
            <div className="flex flex-col h-full p-6">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-700 rounded-lg">
                    <Moon className="text-emerald-200" size={24} />
                  </div>
                  <h1 className="text-xl font-bold font-arabic">نور الإسلام</h1>
                </div>
                <button className="md:hidden" onClick={() => setIsSidebarOpen(false)}>
                  <X size={24} />
                </button>
              </div>

              <nav className="flex-1 space-y-2">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group",
                      activeTab === item.id 
                        ? "bg-emerald-700 text-white shadow-lg" 
                        : "hover:bg-emerald-800/50 text-emerald-100/70 hover:text-white"
                    )}
                  >
                    <item.icon size={20} className={cn(
                      "transition-transform duration-200",
                      activeTab === item.id ? "scale-110" : "group-hover:scale-110"
                    )} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </nav>

              <div className="mt-auto pt-6 border-t border-emerald-800/50">
                <div className="p-4 bg-emerald-800/40 rounded-2xl">
                  <p className="text-xs text-emerald-300/70 mb-2">حكمة اليوم</p>
                  <p className="text-sm italic leading-relaxed line-clamp-3">
                    {wisdom || "جاري التحميل..."}
                  </p>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto h-screen">
        <div className="max-w-4xl mx-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-8"
              >
                {/* Hero Section */}
                <div className="relative overflow-hidden bg-emerald-800 rounded-3xl p-8 text-white shadow-xl">
                  <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-700/30 rounded-full blur-3xl" />
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <p className="text-emerald-200/80 mb-1">{isAfterPrayer ? 'الصلاة الحالية' : 'الصلاة القادمة'}</p>
                      <h2 className="text-4xl font-bold mb-2">{nextPrayer?.arabicName || '---'}</h2>
                      <div className="flex items-center gap-2 text-emerald-100">
                        <Clock size={18} />
                        <span className="text-2xl font-medium">{prayerCountdown || '--:--'}</span>
                      </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin size={16} className="text-emerald-300" />
                        <span className="text-sm font-medium">موقعك الحالي</span>
                      </div>
                      <p className="text-xs text-emerald-100/70">
                        {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'جاري تحديد الموقع...'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Grid Navigation (As requested: beautiful icons in grid) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  {navItems.filter(item => item.id !== 'home').map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className="group relative flex flex-col items-center justify-center p-8 bg-white rounded-[2.5rem] border border-stone-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                    >
                      <div className={cn(
                        "w-16 h-16 mb-4 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110",
                        item.color
                      )}>
                        <item.icon size={32} />
                      </div>
                      <span className="text-lg font-bold text-stone-700 font-arabic">{item.label}</span>
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-right" />
                    </button>
                  ))}
                </div>

                {/* Daily Wisdom Section */}
                <div className="bg-amber-50 border border-amber-100 rounded-3xl p-8 relative overflow-hidden">
                  <div className="absolute top-0 left-0 p-4 opacity-10">
                    <ScrollText size={120} className="text-amber-900" />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-amber-900 font-bold mb-4 flex items-center gap-2">
                      <Sun size={20} />
                      حكمة اليوم
                    </h3>
                    <p className="text-xl text-amber-800 leading-relaxed font-arabic italic">
                      {wisdom || "جاري التحميل..."}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'prayer' && (
              <motion.div
                key="prayer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Hero Section */}
                <div className="relative overflow-hidden bg-emerald-800 rounded-3xl p-8 text-white shadow-xl">
                  <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-700/30 rounded-full blur-3xl" />
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <p className="text-emerald-200/80 mb-1">{isAfterPrayer ? 'الصلاة الحالية' : 'الصلاة القادمة'}</p>
                      <h2 className="text-4xl font-bold mb-2">{nextPrayer?.arabicName || '---'}</h2>
                      <div className="flex items-center gap-2 text-emerald-100">
                        <Clock size={18} />
                        <span className="text-2xl font-medium">{prayerCountdown || '--:--'}</span>
                      </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin size={16} className="text-emerald-300" />
                        <span className="text-sm font-medium">موقعك الحالي</span>
                      </div>
                      <p className="text-xs text-emerald-100/70">
                        {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'جاري تحديد الموقع...'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Prayer Times Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {prayerTimes.map((prayer) => (
                    <div 
                      key={prayer.name}
                      className={cn(
                        "p-6 rounded-2xl border transition-all duration-300",
                        nextPrayer?.arabicName === prayer.arabicName
                          ? "bg-emerald-50 border-emerald-200 shadow-md scale-[1.02]"
                          : "bg-white border-stone-200 hover:border-emerald-200"
                      )}
                    >
                      <p className="text-stone-500 text-sm mb-1">{prayer.name}</p>
                      <h3 className="text-xl font-bold text-stone-800 mb-2">{prayer.arabicName}</h3>
                      <p className="text-emerald-700 font-bold">{prayer.time}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'quran' && (
              <motion.div
                key="quran"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <h2 className="text-3xl font-bold text-stone-800">القرآن الكريم</h2>
                    {selectedSurah && (
                      <>
                        <div className="flex items-center bg-white border border-stone-200 rounded-xl p-1 shadow-sm">
                          <button 
                            onClick={() => setQuranFontSize(prev => Math.max(16, prev - 2))}
                            className="p-2 hover:bg-stone-100 rounded-lg text-stone-600"
                            title="تصغير الخط"
                          >
                            <Type size={16} />
                          </button>
                          <span className="px-3 text-sm font-bold text-stone-400 border-x border-stone-100">{quranFontSize}</span>
                          <button 
                            onClick={() => setQuranFontSize(prev => Math.min(48, prev + 2))}
                            className="p-2 hover:bg-stone-100 rounded-lg text-stone-600"
                            title="تكبير الخط"
                          >
                            <Type size={20} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl p-1 shadow-sm">
                          <select 
                            value={activeReciter}
                            onChange={(e) => setActiveReciter(e.target.value)}
                            className="bg-transparent text-sm font-medium px-2 py-1 outline-none text-stone-700"
                          >
                            {reciters.map(r => (
                              <option key={r.identifier} value={r.identifier}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                        {/* Theme Selection */}
                        <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl p-1 shadow-sm">
                          <button onClick={() => setQuranTheme('classic')} className="w-6 h-6 rounded-full bg-[#fdf6e3] border border-stone-200" title="كلاسيك" />
                          <button onClick={() => setQuranTheme('green')} className="w-6 h-6 rounded-full bg-[#e8f5e9] border border-stone-200" title="أخضر" />
                          <button onClick={() => setQuranTheme('dark')} className="w-6 h-6 rounded-full bg-[#073642] border border-stone-200" title="داكن" />
                        </div>
                        {/* Mode Selection */}
                        <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl p-1 shadow-sm">
                          <button 
                            onClick={() => setQuranViewMode('reading')}
                            className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all", quranViewMode === 'reading' ? "bg-emerald-600 text-white" : "text-stone-600")}
                          >
                            قراءة
                          </button>
                          <button 
                            onClick={() => setQuranViewMode('tafsir')}
                            className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all", quranViewMode === 'tafsir' ? "bg-indigo-600 text-white" : "text-stone-600")}
                          >
                            تفسير
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowOnlyBookmarks(!showOnlyBookmarks)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-medium",
                        showOnlyBookmarks 
                          ? "bg-emerald-700 text-white border-emerald-700" 
                          : "bg-white text-stone-600 border-stone-200 hover:border-emerald-300"
                      )}
                    >
                      <Bookmark size={18} fill={showOnlyBookmarks ? "currentColor" : "none"} />
                      المحفوظات
                    </button>
                    {selectedSurah && (
                      <button 
                        onClick={() => setSelectedSurah(null)}
                        className="flex items-center gap-2 text-emerald-700 font-medium hover:bg-emerald-50 px-4 py-2 rounded-xl transition-colors"
                      >
                        <ChevronRight size={20} />
                        الفهرس
                      </button>
                    )}
                  </div>
                </div>

                {!selectedSurah ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {surahs
                      .filter(s => !showOnlyBookmarks || bookmarks.some(b => b >= s.number * 1000 && b < (s.number + 1) * 1000)) // Approximate filter
                      .map((surah) => (
                      <button
                        key={surah.number}
                        onClick={() => setSelectedSurah(surah)}
                        className="flex items-center justify-between p-5 bg-white rounded-2xl border border-stone-200 hover:border-emerald-400 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 flex items-center justify-center bg-stone-100 rounded-lg text-stone-500 font-bold group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                            {surah.number}
                          </div>
                          <div className="text-right">
                            <h3 className="font-bold text-stone-800">{surah.name}</h3>
                            <p className="text-xs text-stone-500">{surah.englishName}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-medium text-stone-400">{surah.numberOfAyahs} آية</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={cn(
                    "rounded-[2.5rem] shadow-2xl border border-stone-100 overflow-hidden transition-colors duration-500",
                    quranTheme === 'classic' && "quran-theme-classic",
                    quranTheme === 'dark' && "quran-theme-dark",
                    quranTheme === 'green' && "quran-theme-green"
                  )}>
                    <div className="bg-emerald-900/10 p-8 text-center relative border-b border-black/5">
                      {/* Decorative Shapes */}
                      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none overflow-hidden">
                        <div className="absolute -top-20 -left-20 w-64 h-64 border-[30px] border-current rounded-full" />
                        <div className="absolute -bottom-20 -right-20 w-64 h-64 border-[30px] border-current rotate-45" />
                      </div>
                      
                      <h2 className="text-4xl font-arabic font-bold mb-2">{selectedSurah.name}</h2>
                      <p className="opacity-60">{selectedSurah.englishNameTranslation}</p>
                      {selectedSurah.number !== 1 && selectedSurah.number !== 9 && (
                        <p className="mt-6 text-2xl font-arabic">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
                      )}
                    </div>
                    
                    <div className="p-6 md:p-10">
                      {loadingQuran ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                          <RefreshCw className="animate-spin text-emerald-600" size={40} />
                          <p className="text-stone-500 font-medium">جاري تحميل الآيات...</p>
                        </div>
                      ) : (
                        <div className="relative">
                          {/* Horizontal Page Layout */}
                          <div className="overflow-x-auto pb-6 scrollbar-hide snap-x snap-mandatory flex gap-8 px-4">
                            <div className="flex-none w-full max-w-4xl mx-auto quran-page rounded-3xl p-8 md:p-12 min-h-[600px] snap-center relative">
                              {/* Page Decoration */}
                              <div className="absolute inset-4 border-2 border-current opacity-10 rounded-2xl pointer-events-none" />
                              <div className="absolute inset-8 border border-current opacity-5 rounded-xl pointer-events-none" />
                              
                              <div className={cn(
                                "flex flex-wrap justify-center gap-y-10 gap-x-6 leading-[2.8]",
                                quranViewMode === 'tafsir' ? "flex-col items-stretch" : "flex-row"
                              )} style={{ direction: 'rtl' }}>
                                {ayahs
                                  .filter(ayah => !showOnlyBookmarks || bookmarks.includes(ayah.number))
                                  .map((ayah) => (
                                  <div key={ayah.number} className={cn(
                                    "group relative",
                                    quranViewMode === 'tafsir' ? "w-full border-b border-black/5 pb-6 last:border-0" : ""
                                  )}>
                                    <div className="flex flex-col gap-4">
                                      <div className="flex flex-wrap items-center justify-center gap-2">
                                        <span 
                                          className="font-arabic transition-colors duration-300 hover:text-emerald-600 cursor-pointer"
                                          style={{ fontSize: `${quranFontSize}px` }}
                                          onClick={() => handlePlayAyah(ayah.number)}
                                        >
                                          {ayah.text}
                                          <span className="inline-flex items-center justify-center w-8 h-8 mx-2 text-sm font-bold border-2 border-current/20 rounded-full opacity-60 group-hover:opacity-100 transition-all">
                                            {ayah.numberInSurah}
                                          </span>
                                        </span>
                                        
                                        {/* Quick Actions */}
                                        <div className="inline-flex items-center gap-1 bg-black/5 rounded-full px-2 py-1 opacity-0 group-hover:opacity-100 transition-all">
                                          <button 
                                            onClick={() => handlePlayAyah(ayah.number)}
                                            className="p-1 hover:bg-black/10 rounded-full"
                                          >
                                            {playingAyah === ayah.number ? (
                                              isAudioLoading ? <RefreshCw size={14} className="animate-spin" /> : <Pause size={14} />
                                            ) : (
                                              <Volume2 size={14} />
                                            )}
                                          </button>
                                          <button 
                                            onClick={() => toggleBookmark(ayah.number)}
                                            className={cn(
                                              "p-1 rounded-full",
                                              bookmarks.includes(ayah.number) ? "text-amber-500" : "opacity-40"
                                            )}
                                          >
                                            <Bookmark size={14} fill={bookmarks.includes(ayah.number) ? "currentColor" : "none"} />
                                          </button>
                                        </div>
                                      </div>

                                      {quranViewMode === 'tafsir' && (
                                        <motion.div 
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          className="p-4 bg-black/5 rounded-2xl text-sm leading-relaxed font-arabic italic opacity-80"
                                        >
                                          <span className="font-bold block mb-1 opacity-60">تفسير الجلالين:</span>
                                          {ayah.tafsir}
                                        </motion.div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          {/* Navigation Hints */}
                          <div className="flex justify-between items-center mt-6 text-xs opacity-40 font-bold px-4">
                            <span>اسحب لليسار أو اليمين للتنقل</span>
                            <span>{selectedSurah.name} - {ayahs.length} آية</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'qibla' && (
              <motion.div
                key="qibla"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-12 space-y-8"
              >
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-stone-800 mb-2">اتجاه القبلة</h2>
                  <p className="text-stone-500">ضع هاتفك بشكل أفقي للحصول على أفضل دقة</p>
                </div>

                <div className="relative w-64 h-64 md:w-80 md:h-80">
                  {/* Compass Ring */}
                  <div className="absolute inset-0 border-4 border-stone-200 rounded-full" />
                  <div className="absolute inset-4 border border-stone-100 rounded-full" />
                  
                  {/* Compass Markings */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-px bg-stone-200 absolute rotate-0" />
                    <div className="w-full h-px bg-stone-200 absolute rotate-90" />
                    <span className="absolute top-2 font-bold text-stone-400">N</span>
                    <span className="absolute bottom-2 font-bold text-stone-400">S</span>
                    <span className="absolute left-2 font-bold text-stone-400">W</span>
                    <span className="absolute right-2 font-bold text-stone-400">E</span>
                  </div>

                  {/* Qibla Needle */}
                  <motion.div 
                    className="absolute inset-0 flex items-center justify-center"
                    animate={{ rotate: qiblaDirection }}
                    transition={{ type: 'spring', damping: 20 }}
                  >
                    <div className="relative w-1 h-full">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-emerald-600 rounded-full shadow-lg shadow-emerald-200" />
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[24px] border-b-emerald-600" />
                      <div className="w-full h-full bg-emerald-600/20 rounded-full" />
                    </div>
                  </motion.div>

                  {/* Center Point */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 bg-white border-4 border-emerald-600 rounded-full z-10" />
                  </div>
                </div>

                <div className="bg-emerald-50 px-8 py-4 rounded-2xl border border-emerald-100 text-center">
                  <p className="text-emerald-800 font-bold text-xl mb-1">{qiblaDirection.toFixed(1)}°</p>
                  <p className="text-emerald-600 text-sm">درجة من الشمال</p>
                </div>
              </motion.div>
            )}

            {activeTab === 'stories' && (
              <motion.div
                key="stories"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-3xl font-bold text-stone-800 mb-6">قصص من السيرة والصحابة</h2>
                
                <div className="flex flex-wrap gap-3 mb-8">
                  {['النبي محمد ﷺ', 'أبو بكر الصديق', 'عمر بن الخطاب', 'عثمان بن عفان', 'علي بن أبي طالب', 'خالد بن الوليد'].map((topic) => (
                    <button
                      key={topic}
                      onClick={() => handleFetchStory(topic)}
                      className={cn(
                        "px-6 py-2 rounded-full border transition-all",
                        storyTopic === topic
                          ? "bg-emerald-700 text-white border-emerald-700 shadow-md"
                          : "bg-white text-stone-600 border-stone-200 hover:border-emerald-300"
                      )}
                    >
                      {topic}
                    </button>
                  ))}
                </div>

                <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-8 min-h-[400px]">
                  {loadingStory ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <RefreshCw className="animate-spin text-emerald-600" size={32} />
                      <p className="text-stone-500">جاري كتابة القصة...</p>
                    </div>
                  ) : story ? (
                    <div className="prose prose-stone max-w-none prose-headings:text-emerald-800 prose-p:leading-relaxed prose-p:text-lg">
                      <Markdown>{story}</Markdown>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                      <div className="p-4 bg-stone-100 rounded-full text-stone-400">
                        <ScrollText size={48} />
                      </div>
                      <p className="text-stone-500 text-lg">اختر شخصية لقراءة قصتها</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'tasbeeh' && (
              <motion.div
                key="tasbeeh"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center justify-center py-12 space-y-10"
              >
                {!selectedTasbeeh ? (
                  <div className="w-full max-w-md space-y-6">
                    <div className="text-center">
                      <h2 className="text-3xl font-bold text-stone-800 mb-2">اختر الذكر</h2>
                      <p className="text-stone-500">اختر الذكر الذي تود البدء به</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {TASBEEH_OPTIONS.map((option) => (
                        <button
                          key={option}
                          onClick={() => {
                            setSelectedTasbeeh(option);
                            setTasbeehCount(0);
                          }}
                          className="p-4 bg-white border border-stone-200 rounded-2xl text-right font-bold text-stone-700 hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-center space-y-4">
                      <button 
                        onClick={() => setSelectedTasbeeh(null)}
                        className="text-emerald-700 font-medium flex items-center gap-1 mx-auto hover:underline"
                      >
                        <ChevronRight size={16} /> تغيير الذكر
                      </button>
                      <h2 className="text-3xl font-bold text-emerald-800 font-arabic">{selectedTasbeeh}</h2>
                    </div>

                    {/* Digital Counter Display */}
                    <div className="relative group">
                      <div className="absolute -inset-4 bg-emerald-100 rounded-[40px] blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
                      <div className="relative w-64 h-80 bg-emerald-900 rounded-[32px] shadow-2xl border-4 border-emerald-700 flex flex-col items-center justify-between p-8 overflow-hidden">
                        {/* Screen */}
                        <div className="w-full bg-[#92a18d] rounded-xl p-4 shadow-inner border-2 border-emerald-950/20 flex flex-col items-end justify-center h-32">
                          <div className="text-xs font-mono text-emerald-900/40 mb-1 uppercase tracking-widest">Digital Counter</div>
                          <motion.div 
                            key={tasbeehCount}
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="text-6xl font-mono font-bold text-emerald-950 tracking-tighter"
                          >
                            {tasbeehCount.toString().padStart(4, '0')}
                          </motion.div>
                        </div>

                        {/* Main Button */}
                        <button
                          onClick={() => {
                            setTasbeehCount(prev => prev + 1);
                            if (navigator.vibrate) navigator.vibrate(50);
                          }}
                          className="w-32 h-32 bg-emerald-600 rounded-full border-b-8 border-emerald-800 shadow-lg active:border-b-0 active:translate-y-2 active:shadow-inner transition-all flex items-center justify-center group/btn"
                        >
                          <div className="w-24 h-24 rounded-full border-2 border-emerald-400/30 flex items-center justify-center">
                            <Play size={40} className="text-white fill-current group-active/btn:scale-90 transition-transform" />
                          </div>
                        </button>

                        {/* Small Reset Button */}
                        <div className="absolute bottom-4 right-4">
                          <button
                            onClick={() => setTasbeehCount(0)}
                            className="p-3 bg-emerald-800 text-emerald-300 rounded-full hover:bg-emerald-700 hover:text-white transition-colors shadow-md border border-emerald-700"
                            title="إعادة ضبط"
                          >
                            <RefreshCw size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quick Goals */}
                    <div className="flex gap-3">
                      {[33, 99, 100].map(goal => (
                        <button
                          key={goal}
                          onClick={() => setTasbeehCount(0)}
                          className="px-4 py-2 bg-white border border-stone-200 rounded-xl text-stone-600 hover:border-emerald-500 hover:text-emerald-700 transition-all text-sm font-medium"
                        >
                          هدف: {goal}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}
            {activeTab === 'azkar' && (
              <motion.div
                key="azkar"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  <h2 className="text-3xl font-bold text-stone-800">الأذكار</h2>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-emerald-800 flex items-center gap-2">
                        <Sun className="text-amber-500" /> أذكار الصباح
                      </h3>
                      {MORNING_AZKAR.map((zikr, idx) => (
                        <ZikrCard key={idx} zikr={zikr} />
                      ))}
                    </div>

                    <div className="space-y-4 pt-8">
                      <h3 className="text-xl font-bold text-emerald-800 flex items-center gap-2">
                        <Moon className="text-indigo-400" /> أذكار المساء
                      </h3>
                      {EVENING_AZKAR.map((zikr, idx) => (
                        <ZikrCard key={idx} zikr={zikr} />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function ZikrCard({ zikr }: { zikr: Zikr }) {
  const [currentCount, setCurrentCount] = useState(0);

  return (
    <button
      onClick={() => currentCount < zikr.count && setCurrentCount(prev => prev + 1)}
      disabled={currentCount >= zikr.count}
      className={cn(
        "w-full text-right p-6 rounded-2xl border transition-all relative overflow-hidden group",
        currentCount >= zikr.count
          ? "bg-stone-100 border-stone-200 opacity-60"
          : "bg-white border-stone-200 hover:border-emerald-300 hover:shadow-sm"
      )}
    >
      {/* Progress Bar */}
      <div 
        className="absolute bottom-0 right-0 h-1 bg-emerald-500 transition-all duration-300"
        style={{ width: `${(currentCount / zikr.count) * 100}%` }}
      />
      
      <p className="text-lg leading-relaxed text-stone-800 mb-4">{zikr.text}</p>
      
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {Array.from({ length: zikr.count }).map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "w-2 h-2 rounded-full",
                i < currentCount ? "bg-emerald-500" : "bg-stone-200"
              )} 
            />
          ))}
        </div>
        <span className="text-sm font-bold text-emerald-700">
          {currentCount} / {zikr.count}
        </span>
      </div>
    </button>
  );
}
