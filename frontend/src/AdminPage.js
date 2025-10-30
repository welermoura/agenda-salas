import React, { useState, useEffect, useCallback } from 'react';

const AdminPage = () => {
    const [agendas, setAgendas] = useState([]);
    const [originalAgendas, setOriginalAgendas] = useState([]);
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

    useEffect(() => {
        // Guarda uma cópia profunda do estado inicial para comparação
        if (agendas.length > 0 && originalAgendas.length === 0) {
            setOriginalAgendas(JSON.parse(JSON.stringify(agendas)));
        }
    }, [agendas, originalAgendas]);

    const moveAgenda = (index, direction) => {
        const newAgendas = [...agendas];
        const targetIndex = index + direction;

        // Garante que o novo índice está dentro dos limites do array
        if (targetIndex < 0 || targetIndex >= newAgendas.length) {
            return;
        }

        // Troca os elementos de posição
        [newAgendas[index], newAgendas[targetIndex]] = [newAgendas[targetIndex], newAgendas[index]];

        setAgendas(newAgendas);
    };

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

    const handleSaveOrder = async () => {
        setError('');
        try {
            const response = await fetch('/agendas/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(agendas),
            });
            if (!response.ok) {
                throw new Error('Falha ao salvar a ordem.');
            }
            alert('Ordem salva com sucesso!');
        } catch (error) {
            console.error("Erro ao salvar ordem:", error);
            setError("Erro de conexão. Verifique o backend.");
        }
    };

    return (
        <div className="admin-container admin-page">
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
            {JSON.stringify(agendas) !== JSON.stringify(originalAgendas) && (
                <button onClick={handleSaveOrder} className="save-order-button">
                    Salvar Nova Ordem
                </button>
            )}
            <ul className="agendas-list">
                {agendas && agendas.map((agenda, index) => (
                    <li key={agenda.url}>
                        <div className="agenda-info">
                            <strong>{agenda.nome}</strong>
                            <span className="agenda-url">{agenda.url}</span>
                        </div>
                        <div className="agenda-actions">
                            <button onClick={() => moveAgenda(index, -1)} disabled={index === 0}>↑</button>
                            <button onClick={() => moveAgenda(index, 1)} disabled={index === agendas.length - 1}>↓</button>
                            <button onClick={() => handleDelete(agenda.url)} className="remove-button">Remover</button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default AdminPage;
