import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

function App() {
  const [agendas, setAgendas] = useState([]);
  const [url, setUrl] = useState('');

  useEffect(() => {
    fetch(`${API_BASE_URL}/agendas`)
      .then(response => response.json())
      .then(data => {
        const initialAgendas = data.map(agenda => ({ ...agenda, status: 'desconhecido' }));
        setAgendas(initialAgendas);
      })
      .catch(error => console.error('Erro ao buscar agendas:', error));

    const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsUrl}/ws`);
    ws.onmessage = (event) => {
      const statuses = JSON.parse(event.data);
      setAgendas(prevAgendas =>
        prevAgendas.map(agenda => ({
          ...agenda,
          status: statuses[agenda.url] || agenda.status
        }))
      );
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (agendas.some(agenda => agenda.url === url)) {
      alert("Esta URL já foi adicionada.");
      return;
    }
    fetch(`${API_BASE_URL}/agendas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    })
      .then(response => response.json())
      .then(novaAgenda => {
        setAgendas([...agendas, { ...novaAgenda, status: 'desconhecido' }]);
        setUrl('');
      })
      .catch(error => console.error('Erro ao adicionar agenda:', error));
  };

  const handleRemove = (urlToRemove) => {
    fetch(`${API_BASE_URL}/agendas/${encodeURIComponent(urlToRemove)}`, {
      method: 'DELETE',
    })
    .then(response => {
      if (response.ok) {
        setAgendas(agendas.filter(agenda => agenda.url !== urlToRemove));
      }
    })
    .catch(error => console.error('Erro ao remover agenda:', error));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Monitor de Salas de Reunião</h1>
      </header>
      <main>
        <div>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL da Agenda Pública (.ics)"
              required
            />
            <button type="submit">Adicionar</button>
          </form>
          <div className="agendas-list">
            <h2>Agendas Cadastradas</h2>
            <ul>
              {agendas.map((agenda, index) => (
                <li key={index}>
                  <span>{agenda.url}</span>
                  <span className={`status ${agenda.status}`}>{agenda.status}</span>
                  <button onClick={() => handleRemove(agenda.url)}>Remover</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
