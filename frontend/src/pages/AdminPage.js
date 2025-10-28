import React, { useState, useEffect } from 'react';

const API_BASE_URL = `http://${window.location.hostname}:8000`;

function AdminPage() {
    const [agendas, setAgendas] = useState([]);
    const [nome, setNome] = useState('');
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetch(`${API_BASE_URL}/agendas`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erro ao buscar agendas');
                }
                return response.json();
            })
            .then(data => setAgendas(data))
            .catch(err => {
                console.error(err);
                setError('Não foi possível carregar as agendas.');
            });
    }, []);

    const handleSubmit = (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        if (agendas.some(agenda => agenda.url === url)) {
            setError("Esta URL já foi adicionada.");
            return;
        }

        fetch(`${API_BASE_URL}/agendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, url }),
        })
        .then(response => {
            if (response.status === 400) {
                return response.json().then(err => { throw new Error(err.detail) });
            }
            if (!response.ok) {
                throw new Error('Erro ao adicionar agenda');
            }
            return response.json();
        })
        .then(novaAgenda => {
            setAgendas([...agendas, novaAgenda]);
            setNome('');
            setUrl('');
            setSuccess('Agenda adicionada com sucesso!');
        })
        .catch(err => {
            console.error(err);
            setError(err.message || 'Não foi possível adicionar a agenda.');
        });
    };

    const handleRemove = (urlToRemove) => {
        setError('');
        setSuccess('');

        fetch(`${API_BASE_URL}/agendas/${encodeURIComponent(urlToRemove)}`, {
            method: 'DELETE',
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao remover agenda');
            }
            setAgendas(agendas.filter(agenda => agenda.url !== urlToRemove));
            setSuccess('Agenda removida com sucesso!');
        })
        .catch(err => {
            console.error(err);
            setError('Não foi possível remover la agenda.');
        });
    };

    return (
        <div className="admin-page">
            <h2>Gerenciamento de Agendas</h2>
            {error && <p className="error-message">{error}</p>}
            {success && <p className="success-message">{success}</p>}
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome da Sala"
                    required
                />
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
                <h3>Agendas Cadastradas</h3>
                <ul>
                    {agendas.map((agenda, index) => (
                        <li key={index}>
                            <span><strong>{agenda.nome}:</strong> {agenda.url}</span>
                            <button onClick={() => handleRemove(agenda.url)}>Remover</button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default AdminPage;
