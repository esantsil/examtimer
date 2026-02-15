import { useEffect, useState } from 'react';
import { Palette, ChevronDown } from 'lucide-react';

const themes = [
  "light", "dark", "cupcake", "bumblebee", "emerald", "corporate", "synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden", "forest", "aqua", "lofi", "pastel", "fantasy", "wireframe", "black", "luxury", "dracula", "cmyk", "autumn", "business", "acid", "lemonade", "night", "coffee", "winter", "dim", "nord", "sunset"
];

export default function ThemeSwitch() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'lofi');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-sm gap-2 font-black uppercase text-[10px] tracking-widest">
        <Palette size={16} />
        <span className="hidden sm:inline">{theme}</span>
        <ChevronDown size={12} className="opacity-50" />
      </div>
      <ul tabIndex={0} className="dropdown-content z-[100] p-2 shadow-2xl bg-base-200 rounded-box w-52 mt-2 max-h-80 overflow-y-auto border border-base-300">
        {themes.map((t) => (
          <li key={t}>
            <button
              onClick={() => setTheme(t)}
              className={`flex w-full items-center justify-between px-4 py-2 text-xs font-bold uppercase tracking-tight rounded-lg hover:bg-base-300 transition-colors ${theme === t ? 'bg-primary text-primary-content hover:bg-primary' : ''}`}
            >
              {t}
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <div className="w-2 h-2 rounded-full bg-secondary"></div>
                <div className="w-2 h-2 rounded-full bg-accent"></div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}