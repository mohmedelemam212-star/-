export interface PrayerTime {
  name: string;
  time: string;
  arabicName: string;
}

export interface QuranSurah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface QuranAyah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  tafsir?: string;
}

export interface Reciter {
  identifier: string;
  name: string;
  englishName: string;
}

export interface Zikr {
  text: string;
  count: number;
  description?: string;
}
