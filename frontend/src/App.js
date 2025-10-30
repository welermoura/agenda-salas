import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import AdminPage from './AdminPage';
import DashboardPage from './DashboardPage';
import './App.css';

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  // Estado para gerenciar o tema, lendo do localStorage ou usando 'dark' como padrão
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

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

  // Função para alternar o tema
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

  return (
    <Router>
      {/* O atributo data-theme não é mais necessário aqui se estiver no body */}
      <div className="App">
        <header className="app-header">
          <div className="header-left-controls">
            <nav>
              <ul>
                <li><Link to="/">Dashboard</Link></li>
                <li><Link to="/admin">Admin</Link></li>
              </ul>
            </nav>
            <button onClick={toggleTheme} className="theme-toggle-button">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
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
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
