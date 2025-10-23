import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import UsersPage from './pages/UsersPage';
import GroupsPage from './pages/GroupsPage';
import LogsPage from './pages/LogsPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <nav>
          <ul>
            <li>
              <Link to="/users">Gerenciar Usuários</Link>
            </li>
            <li>
              <Link to="/groups">Gerenciar Grupos</Link>
            </li>
            <li>
              <Link to="/logs">Logs de Auditoria</Link>
            </li>
          </ul>
        </nav>
        <main>
          <Routes>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/" element={<h2>Bem-vindo à Ferramenta de Gestão de Active Directory</h2>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
