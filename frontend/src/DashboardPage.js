import React, { useState, useEffect, useRef } from 'react';
import Arrow from 'arrow-js';

const DashboardPage = () => {
    const [schedules, setSchedules] = useState({});
    const [loading, setLoading] = useState(true);
    // Estado para controlar a data, inicializado com a data atual
    const [selectedDate, setSelectedDate] = useState(Arrow.utc().format('YYYY-MM-DD'));

    const ws = useRef(null);
    const WS_URL = `ws://${window.location.hostname}:8000/ws`;

    useEffect(() => {
        // A função de conexão é movida para dentro do useEffect para lidar com selectedDate
        const connect = () => {
            ws.current = new WebSocket(WS_URL);

            ws.current.onopen = () => {
                console.log("Conexão WebSocket estabelecida.");
                // Solicita os dados para a data selecionada ao conectar
                ws.current.send(JSON.stringify({ date: selectedDate }));
            };

            ws.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                // Apenas atualiza o estado se a data recebida for a mesma da selecionada
                if (data.date === selectedDate) {
                    setSchedules(data.statuses);
                    setLoading(false);
                }
            };

            ws.current.onclose = () => {
                console.log("Conexão WebSocket fechada.");
            };

            ws.current.onerror = (error) => {
                console.error("Erro no WebSocket:", error);
                setLoading(false);
            };
        };

        connect();

        // Limpa a conexão ao desmontar o componente
        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [WS_URL, selectedDate]);

    // Gera as horas cheias para as linhas, começando das 8:00
    const hours = Array.from({ length: 13 }, (_, i) => (i + 8).toString().padStart(2, '0'));

    // Extrai as salas para as colunas
    const rooms = Object.entries(schedules).map(([url, data]) => ({ url, nome: data.nome }));

    const currentHour = new Date().getHours();
    const isToday = selectedDate === Arrow.utc().format('YYYY-MM-DD');

    useEffect(() => {
        // Rola para a hora atual apenas se for hoje e os dados estiverem carregados
        if (!loading && isToday) {
            const now = new Date();
            const hour = now.getHours().toString().padStart(2, '0');
            const currentHourRowId = `hour-row-${hour}`;

            const element = document.getElementById(currentHourRowId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [loading, isToday]);

    // Funções para navegar entre as datas
    const handleDateChange = (days) => {
        const newDate = Arrow.from(selectedDate).shift({ days: days }).format('YYYY-MM-DD');
        setSelectedDate(newDate);
        setLoading(true); // Mostra o loading ao mudar de data
    };

    const goToToday = () => {
        const today = Arrow.utc().format('YYYY-MM-DD');
        setSelectedDate(today);
        setLoading(true);
    };

    return (
        <div className="dashboard-page">
            <div className="date-navigation">
                <button onClick={() => handleDateChange(-1)}>&lt; Anterior</button>
                <span className="current-date">
                    {Arrow.from(selectedDate).format('DD/MM/YYYY')}
                </span>
                <button onClick={() => handleDateChange(1)}>Próximo &gt;</button>
                <button onClick={goToToday} className="today-button">Hoje</button>
            </div>

            {loading ? (
                <p className="loading-message">Carregando Agendas para {Arrow.from(selectedDate).format('DD/MM/YYYY')}, favor aguarde</p>
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
                                        <tr key={hour} id={`hour-row-${hour}`} className={(isToday && parseInt(hour) < currentHour) ? 'past-time-slot' : ''}>
                                            <th className="time-cell">{hour}:00</th>
                                            {rooms.map(room => {
                                                // Garante que schedules e schedules[room.url] existam
                                                const status = schedules && schedules[room.url] ? schedules[room.url].status : {};
                                                const slot1_status = status[`${hour}:00`] || 'indisponivel';
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
