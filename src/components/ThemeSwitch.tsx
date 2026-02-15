import { Sun, Moon } from 'lucide-react';

export default function ThemeSwitch() {
  return (
    <label className="swap swap-rotate btn btn-ghost btn-circle btn-sm">
      <input type="checkbox" className="theme-controller" value="dark" />
      <Sun className="swap-off h-5 w-5" />
      <Moon className="swap-on h-5 w-5" />
    </label>
  );
}