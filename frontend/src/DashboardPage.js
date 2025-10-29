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

    // Gera os intervalos de 30 minutos para as linhas
    const timeSlots = [];
    for (let i = 6; i < 21; i++) {
        const hour = i.toString().padStart(2, '0');
        timeSlots.push(`${hour}:00`);
        timeSlots.push(`${hour}:30`);
    }

    // Extrai as salas para as colunas
    const rooms = Object.entries(schedules).map(([url, data]) => ({ url, nome: data.nome }));

    useEffect(() => {
        if (!loading) {
            const now = new Date();
            const hour = now.getHours().toString().padStart(2, '0');
            const minute = now.getMinutes() < 30 ? '00' : '30';
            const currentTimeSlotId = `time-${hour}-${minute}`;

            const element = document.getElementById(currentTimeSlotId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [loading]);

    return (
        <div className="dashboard-page">
            {loading ? (
                <p className="loading-message">Carregando Agendas, favor aguarde</p>
            ) : (
                <>
                    <div className="dashboard-header">
                        <h1>Disponibilidade das Salas de Reunião</h1>
                    </div>

                    {Object.keys(schedules).length === 0 ? (
                        <p>Nenhuma agenda cadastrada. Adicione uma na <a href="/admin">página de administração</a>.</p>
                    ) : (
                        <div className="table-scroll-container">
                            <table className="schedule-table schedule-table-vertical">
                                <thead>
                                    <tr>
                                        <th className="time-header-cell">Horário</th>
                                        {rooms.map(room => <th key={room.url}>{room.nome}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeSlots.map(slot => (
                                        <tr key={slot} id={`time-${slot.replace(':', '-')}`}>
                                            <th className="time-cell">{slot}</th>
                                            {rooms.map(room => {
                                                const status = schedules[room.url]?.status[slot] || 'indisponivel';
                                                return (
                                                    <td key={room.url} className={`status-cell status-${status}`}>
                                                        {status === 'ocupado' ? 'Ocupado' : 'Livre'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default DashboardPage;
