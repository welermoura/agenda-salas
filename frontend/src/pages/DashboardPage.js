import React, { useState, useEffect } from 'react';

const API_BASE_URL = `http://${window.location.hostname}:8000`;
const WS_URL = API_BASE_URL.replace(/^http/, 'ws');

function DashboardPage() {
    const [schedules, setSchedules] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ws = new WebSocket(`${WS_URL}/ws`);

        ws.onopen = () => {
            console.log("Conectado ao WebSocket.");
        };

        ws.onmessage = (event) => {
            console.log("Dados recebidos via WebSocket:", event.data);
            setLoading(false);
            const data = JSON.parse(event.data);
            console.log("Dados após o parse:", data);
            setSchedules(prev => {
                const newState = { ...prev, ...data };
                console.log("Novo estado dos agendamentos:", newState);
                return newState;
            });
        };

        ws.onerror = (error) => {
            console.error("Erro no WebSocket:", error);
            setLoading(false);
        };

        ws.onclose = () => {
            console.log("Desconectado do WebSocket.");
        };

        return () => {
            ws.close();
        };
    }, []);

    const horas = Array.from({ length: 15 }, (_, i) => `${(i + 6).toString().padStart(2, '0')}:00`);

    return (
        <div className="dashboard-page">
            <h1>Monitor de Salas de Reunião</h1>
            {loading ? (
                <p>Carregando status das salas...</p>
            ) : (
                <div className="schedule-grid">
                    <div className="grid-header">
                        <div className="sala-header">Sala</div>
                        {horas.map(hora => <div key={hora}>{hora}</div>)}
                    </div>
                    {Object.keys(schedules).length > 0 ? (
                        Object.entries(schedules).map(([url, data]) => (
                            <div className="grid-row" key={url}>
                                <div className="sala-nome">{data.nome}</div>
                                {horas.map(hora => {
                                    const statusClass = data.status[hora] || 'desconhecido';
                                    return <div key={hora} className={`grid-cell status-${statusClass}`}></div>;
                                })}
                            </div>
                        ))
                    ) : (
                        <p>Nenhuma agenda cadastrada para monitorar.</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default DashboardPage;
