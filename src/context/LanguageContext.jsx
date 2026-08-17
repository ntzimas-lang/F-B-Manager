import { createContext, useContext, useState } from 'react'
import { translations } from '../lib/translations'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('fb-manager-lang') || 'el')

  function toggleLang() {
    const next = lang === 'el' ? 'en' : 'el'
    setLang(next)
    localStorage.setItem('fb-manager-lang', next)
  }

  function t(key) {
    return translations[lang]?.[key] || translations.el[key] || key
  }

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
