import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_BASE_URL = `http://${window.location.hostname}:8000`;

const AdminPage = () => {
    const [agendas, setAgendas] = useState([]);
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        fetch(`${API_BASE_URL}/agendas`)
            .then(response => response.json())
            .then(data => setAgendas(data))
            .catch(error => console.error('Erro ao buscar agendas:', error));
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setErrorMessage('');

        const novaAgenda = { name, url };

        try {
            const response = await fetch(`${API_BASE_URL}/agendas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(novaAgenda),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Ocorreu um erro');
            }

            const data = await response.json();
            setAgendas([...agendas, data]);
            setName('');
            setUrl('');

        } catch (error) {
            setErrorMessage(error.message);
        }
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
            <nav className="main-nav">
                <Link to="/">Voltar para o Dashboard</Link>
            </nav>
            <header>
                <h1>Administração de Salas</h1>
            </header>
            <main>
                <form onSubmit={handleSubmit}>
                    {errorMessage && <p className="error-message">{errorMessage}</p>}
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
