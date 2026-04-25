import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeStore {
  isDark: boolean;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      isDark: false,
      toggleTheme: () => {
        const next = !get().isDark;
        set({ isDark: next });
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },
    }),
    { name: 'connectly-theme' }
  )
);

// Apply on load
const stored = localStorage.getItem('connectly-theme');
if (stored) {
  try {
    const parsed = JSON.parse(stored);
    if (parsed?.state?.isDark) {
      document.documentElement.classList.add('dark');
    }
  } catch {}
}
