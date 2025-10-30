import React, { useState, useEffect, useCallback } from 'react';

const AdminPage = () => {
    const [agendas, setAgendas] = useState([]);
    const [nome, setNome] = useState('');
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');

    // Função para buscar as agendas cadastradas, envolvida em useCallback
    const fetchAgendas = useCallback(async () => {
        try {
            const response = await fetch(`/agendas`);
            const data = await response.json();
            setAgendas(data);
        } catch (error) {
            console.error("Erro ao buscar agendas:", error);
            setError("Não foi possível carregar as agendas.");
        }
    }, []);

    // Efeito para carregar as agendas na montagem do componente
    useEffect(() => {
        fetchAgendas();
    }, [fetchAgendas]);

    // Função para submeter o formulário de nova agenda
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await fetch(`/agendas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, url }),
            });
            if (response.status === 201) {
                setNome('');
                setUrl('');
                fetchAgendas(); // Recarrega a lista
            } else {
                const data = await response.json();
                setError(data.error || "Erro ao adicionar agenda.");
            }
        } catch (error) {
            console.error("Erro ao adicionar agenda:", error);
            setError("Erro de conexão. Verifique o backend.");
        }
    };

    // Função para deletar uma agenda
    const handleDelete = async (agendaUrl) => {
        try {
            await fetch(`/agendas/${encodeURIComponent(agendaUrl)}`, {
                method: 'DELETE',
            });
            fetchAgendas(); // Recarrega a lista
        } catch (error) {
            console.error("Erro ao deletar agenda:", error);
            setError("Erro ao deletar agenda.");
        }
    };

    return (
        <div className="admin-page">
            <h1>Administração de Agendas</h1>
            <form onSubmit={handleSubmit} className="agenda-form">
                <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome da Sala"
                    required
                />
                <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="URL do Calendário (.ics)"
                    required
                />
                <button type="submit">Adicionar</button>
            </form>
            {error && <p className="error-message">{error}</p>}

            <h2>Agendas Cadastradas</h2>
            <ul className="agendas-list">
                {agendas && agendas.map((agenda, index) => (
                    <li key={index}>
                        <strong>{agenda.nome}</strong>
                        <span>{agenda.url}</span>
                        <button onClick={() => handleDelete(agenda.url)}>Remover</button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default AdminPage;
