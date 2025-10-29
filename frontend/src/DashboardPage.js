import React, { useState, useEffect } from 'react';

const DashboardPage = () => {
    const [schedules, setSchedules] = useState({});
    const [loading, setLoading] = useState(true);

    const WS_URL = `ws://${window.location.hostname}:8000/ws`;

    useEffect(() => {
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log("Conexão WebSocket estabelecida.");
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setSchedules(data);
            setLoading(false); // Dados recebidos, para de carregar
        };

        ws.onclose = () => {
            console.log("Conexão WebSocket fechada.");
        };

        ws.onerror = (error) => {
            console.error("Erro no WebSocket:", error);
            setLoading(false);
        };

        // Limpa a conexão ao desmontar o componente
        return () => {
            ws.close();
        };
    }, [WS_URL]);

    // Define o cabeçalho de horas
    const hours = Array.from({ length: 15 }, (_, i) => `${(i + 6).toString().padStart(2, '0')}:00`);

    return (
        <div className="dashboard-page">
            <h1>Dashboard de Salas</h1>
            {loading && <p>Carregando status das salas...</p>}

            {!loading && Object.keys(schedules).length === 0 && (
                <p>Nenhuma agenda cadastrada. Adicione uma na <a href="/admin">página de administração</a>.</p>
            )}

            {Object.keys(schedules).length > 0 && (
                <table className="schedule-table">
                    <thead>
                        <tr>
                            <th>Sala</th>
                            {hours.map(hour => <th key={hour}>{hour}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(schedules).map(([url, data]) => (
                            <tr key={url}>
                                <td>{data.nome}</td>
                                {hours.map(hour => {
                                    const status = data.status[hour] || 'indisponivel';
                                    return (
                                        <td key={hour} className={`status-${status}`}>
                                            {status === 'error' ? 'Erro' : status}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default DashboardPage;
