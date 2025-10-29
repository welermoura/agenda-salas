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

    // Gera as horas cheias para as linhas, começando das 8:00
    const hours = Array.from({ length: 13 }, (_, i) => (i + 8).toString().padStart(2, '0'));

    // Extrai as salas para as colunas
    const rooms = Object.entries(schedules).map(([url, data]) => ({ url, nome: data.nome }));

    const currentHour = new Date().getHours();

    useEffect(() => {
        if (!loading) {
            const now = new Date();
            const hour = now.getHours().toString().padStart(2, '0');
            const currentHourRowId = `hour-row-${hour}`;

            const element = document.getElementById(currentHourRowId);
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
                                    {hours.map(hour => (
                                        <tr key={hour} id={`hour-row-${hour}`} className={parseInt(hour) < currentHour ? 'past-time-slot' : ''}>
                                            <th className="time-cell">{hour}:00</th>
                                            {rooms.map(room => {
                                                const slot1_status = schedules[room.url]?.status[`${hour}:00`] || 'indisponivel';
                                                const slot2_status = schedules[room.url]?.status[`${hour}:30`] || 'indisponivel';
                                                return (
                                                    <td key={room.url} className="status-cell">
                                                        <div className={`half-hour-slot slot-top status-${slot1_status}`}>
                                                            {slot1_status.charAt(0).toUpperCase() + slot1_status.slice(1)}
                                                        </div>
                                                        <div className={`half-hour-slot slot-bottom status-${slot2_status}`}>
                                                            {slot2_status.charAt(0).toUpperCase() + slot2_status.slice(1)}
                                                        </div>
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
