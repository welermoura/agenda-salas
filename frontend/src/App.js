import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, NavLink } from 'react-router-dom';
import AdminGuard from './AdminGuard'; // Importa o novo componente
import DashboardPage from './DashboardPage';
import './App.css';

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  // Estado para gerenciar o tema, lendo do localStorage e migrando valores antigos se necessário
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') return 'classic-light';
    if (saved === 'dark') return 'classic-dark';
    return saved || 'classic-light';
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Efeito para atualizar o localStorage e o atributo no body quando o tema muda
  useEffect(() => {
    localStorage.setItem('theme', theme);
    // Aplica o tema no elemento raiz para que as variáveis CSS funcionem globalmente
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

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
      {/* O atributo data-theme não é mais necessário aqui se estiver no body */}
      <div className="App">
        <header className="app-header">
          <div className="header-left-controls">
            <nav>
              <ul>
                <li><NavLink to="/" end>Dashboard</NavLink></li>
                <li><NavLink to="/admin">Admin</NavLink></li>
              </ul>
            </nav>
            <select 
              value={theme} 
              onChange={(e) => setTheme(e.target.value)} 
              className="theme-selector"
              aria-label="Selecionar Tema"
            >
              <option value="classic-light">☀️ Clássico Claro</option>
              <option value="classic-dark">🌙 Clássico Escuro</option>
              <option value="neon-cyber">⚡ Neon Cyberpunk</option>
              <option value="ocean-breeze">🌊 Ocean Breeze</option>
            </select>
          </div>
          <h1 className="app-title">Disponibilidade das Salas de Reunião</h1>
          <div className="real-time-clock">
            <div className="date-display">{date}</div>
            <div className="time-display">{time}</div>
          </div>
          {/* O botão será adicionado na próxima etapa, mas a lógica está pronta */}
        </header>

        <main>
          <Routes>
            <Route path="/admin" element={<AdminGuard />} />
            <Route path="/" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
