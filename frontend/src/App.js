import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import AdminPage from './AdminPage';
import DashboardPage from './DashboardPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        {/* O cabeçalho agora será gerenciado dentro da DashboardPage para um design mais limpo */}
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
