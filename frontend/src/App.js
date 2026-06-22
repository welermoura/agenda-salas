import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import AdminGuard from './AdminGuard'; // Importa o novo componente
import DashboardPage from './DashboardPage';
import './App.css';

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  // Estado para gerenciar o modo (claro/escuro), lendo do localStorage ou usando 'dark' (padrão)
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('mode');
    if (saved === 'light' || saved === 'dark') return saved;
    // Migração de chaves antigas se necessário
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && savedTheme.includes('light')) return 'light';
    return 'dark';
  });

  // Estado para armazenar o tema base configurado pelo administrador
  const [baseTheme, setBaseTheme] = useState('classic');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Efeito para atualizar o localStorage e o atributo no body quando o modo ou tema base muda
  useEffect(() => {
    localStorage.setItem('mode', mode);
    // Combina o tema base com o modo (ex: classic-light, cyber-dark, forest-light)
    const fullThemeName = `${baseTheme}-${mode}`;
    document.body.setAttribute('data-theme', fullThemeName);
  }, [baseTheme, mode]);

  const toggleMode = () => {
    setMode((prevMode) => (prevMode === 'dark' ? 'light' : 'dark'));
  };

  const formatDateTime = (date) => {
    const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    let formattedDate = date.toLocaleDateString('pt-BR', dateOptions);
    formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    const timeString = date.toLocaleTimeString('pt-BR');
    return { date: formattedDate, time: timeString };
  };

  const { date, time } = formatDateTime(currentTime);

  return (
    <Router>
      <div className="App">
        <header className="app-header">
          <div className="header-left-controls">
            <button onClick={toggleMode} className="theme-toggle-button" aria-label="Alternar Claro/Escuro">
              {mode === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
            </button>
          </div>
          <h1 className="app-title">Disponibilidade das Salas de Reunião</h1>
          <div className="real-time-clock">
            <div className="date-display">{date}</div>
            <div className="time-display">{time}</div>
          </div>
        </header>

        <main>
          <Routes>
            <Route path="/admin" element={<AdminGuard onThemeLoaded={setBaseTheme} />} />
            <Route path="/" element={<DashboardPage theme={`${baseTheme}-${mode}`} onThemeLoaded={setBaseTheme} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
