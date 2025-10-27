import React, { useState, useEffect } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

const AdminPage = () => {
    const [agendas, setAgendas] = useState([]);
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');

    useEffect(() => {
        fetch(`${API_BASE_URL}/agendas`)
            .then(response => response.json())
            .then(data => setAgendas(data))
            .catch(error => console.error('Erro ao buscar agendas:', error));
    }, []);

    const handleSubmit = (event) => {
        event.preventDefault();
        if (agendas.some(agenda => agenda.url === url)) {
            alert("Esta URL já foi adicionada.");
            return;
        }

        const novaAgenda = { name, url };

        fetch(`${API_BASE_URL}/agendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novaAgenda),
        })
        .then(response => response.json())
        .then(data => {
            setAgendas([...agendas, data]);
            setName('');
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
        <div className="admin-page">
            <header>
                <h1>Administração de Salas</h1>
            </header>
            <main>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nome da Sala"
                        required
                    />
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="URL da Agenda (.ics)"
                        required
                    />
                    <button type="submit">Adicionar Sala</button>
                </form>
                <div className="agendas-list">
                    <h2>Salas Cadastradas</h2>
                    <ul>
                        {agendas.map((agenda, index) => (
                            <li key={index}>
                                <span>{agenda.name} ({agenda.url})</span>
                                <button onClick={() => handleRemove(agenda.url)}>Remover</button>
                            </li>
                        ))}
                    </ul>
                </div>
            </main>
        </div>
    );
};

export default AdminPage;
