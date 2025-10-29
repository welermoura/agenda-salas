import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import AdminPage from './AdminPage';
import DashboardPage from './DashboardPage';
import './App.css';

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
          <nav>
            <ul>
              <li>
                <Link to="/">Dashboard</Link>
              </li>
              <li>
                <Link to="/admin">Admin</Link>
              </li>
            </ul>
          </nav>
          <h1 className="app-title">Disponibilidade das Salas de Reunião</h1>
          <div className="real-time-clock">
            <div className="date-display">{date}</div>
            <div className="time-display">{time}</div>
          </div>
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
