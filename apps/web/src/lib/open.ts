import { useNavigate } from 'react-router';

/** پیوند کلاس یا ضبط: نشانی درون‌برنامه‌ای (نسخهٔ نمایشی) در همین برنامه، بقیه در زبانهٔ تازه */
export function useOpenLink() {
  const nav = useNavigate();
  return (url: string) => (url.startsWith('/') ? nav(url) : window.open(url, '_blank', 'noopener'));
}
