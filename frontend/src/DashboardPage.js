import React, { useState, useEffect, useRef } from 'react';

// --- Funções Auxiliares de Data ---
// Formata um objeto Date para 'YYYY-MM-DD' ou 'DD/MM/YYYY'
const formatDate = (date, format = 'YYYY-MM-DD') => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    if (format === 'DD/MM/YYYY') {
        return `${day}/${month}/${year}`;
    }
    return `${year}-${month}-${day}`;
};

// Adiciona ou subtrai dias de uma data no formato 'YYYY-MM-DD'
const addDays = (dateStr, days) => {
    const date = new Date(dateStr + 'T00:00:00'); // Adiciona T00:00:00 para evitar problemas de fuso
    date.setDate(date.getDate() + days);
    return formatDate(date);
};
// --- Fim das Funções Auxiliares ---


const DashboardPage = () => {
    const [schedules, setSchedules] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
    const [scheduleCache, setScheduleCache] = useState({}); // Cache para as agendas
    const [displayHour, setDisplayHour] = useState(new Date().getHours()); // Novo estado para a hora de exibição

    const ws = useRef(null);
    const scrollContainerRef = useRef(null); // Ref para o contêiner de rolagem
    const WS_URL = `ws://${window.location.hostname}/ws`;
    const selectedDateRef = useRef(selectedDate); // Ref para evitar closure estagnado

    // Atualiza a ref sempre que a data selecionada mudar
    useEffect(() => {
        selectedDateRef.current = selectedDate;
    }, [selectedDate]);


    // Efeito para gerenciar a conexão WebSocket e o recebimento de dados
    useEffect(() => {
        const connect = () => {
            ws.current = new WebSocket(WS_URL);

            ws.current.onopen = () => {
                console.log("Conexão WebSocket estabelecida.");
                // Solicita os dados para a data inicial se não estiverem em cache
                if (!scheduleCache[selectedDateRef.current]) {
                    ws.current.send(JSON.stringify({ date: selectedDateRef.current }));
                }
            };

            ws.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                // Atualiza o cache com os novos dados
                setScheduleCache(prevCache => ({ ...prevCache, [data.date]: data.statuses }));

                // Se os dados recebidos forem para a data atualmente selecionada, atualiza a UI
                if (data.date === selectedDateRef.current) {
                    setSchedules(data.statuses);
                    setLoading(false);
                }
            };

            ws.current.onclose = () => console.log("Conexão WebSocket fechada.");
            ws.current.onerror = (error) => {
                console.error("Erro no WebSocket:", error);
                setLoading(false);
            };
        };

        connect();

        return () => {
            if (ws.current) ws.current.close();
        };
        // Roda apenas uma vez para estabelecer a conexão
    }, [WS_URL]); // eslint-disable-line react-hooks/exhaustive-deps

    // Efeito para solicitar dados quando a data selecionada muda
    useEffect(() => {
        if (scheduleCache[selectedDate]) {
            // Se os dados estiverem no cache, usa-os diretamente
            setSchedules(scheduleCache[selectedDate]);
            setLoading(false);
        } else {
            // Caso contrário, solicita ao WebSocket se a conexão estiver aberta
            setLoading(true);
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ date: selectedDate }));
            }
            // Se a conexão não estiver aberta, o 'onopen' do primeiro useEffect fará a solicitação inicial.
        }
    }, [selectedDate, scheduleCache]);

    // Gera as horas cheias para as linhas, começando das 8:00
    const hours = Array.from({ length: 13 }, (_, i) => (i + 8).toString().padStart(2, '0'));

    // Extrai as salas para as colunas, garantindo que schedules não seja nulo
    const rooms = schedules ? Object.entries(schedules).map(([url, data]) => ({ url, nome: data.nome })) : [];

    const isToday = selectedDate === formatDate(new Date());

    // Efeito para monitorar a mudança da hora e acionar a rolagem
    useEffect(() => {
        if (isToday) {
            const timer = setInterval(() => {
                const currentHour = new Date().getHours();
                setDisplayHour(prevHour => {
                    if (currentHour !== prevHour) {
                        return currentHour;
                    }
                    return prevHour;
                });
            }, 1000 * 60); // Verifica a cada minuto

            return () => clearInterval(timer);
        }
    }, [isToday]);

    // Efeito para rolar para a hora atual (agora depende de displayHour)
    useEffect(() => {
        if (!loading && isToday) {
            const scrollTimer = setTimeout(() => {
                const hour = displayHour.toString().padStart(2, '0');
                const currentHourRowId = `hour-row-${hour}`;
                const element = document.getElementById(currentHourRowId);
                const container = scrollContainerRef.current;

                if (element && container) {
                    // Calcula a posição do topo do elemento em relação ao topo do contêiner da tabela
                    const elementTop = element.offsetTop;
                    // Calcula a posição do topo do cabeçalho da tabela
                    const tableHeaderTop = container.querySelector('thead').offsetHeight;

                    // Define a posição da barra de rolagem
                    container.scrollTop = elementTop - tableHeaderTop;
                }
            }, 100);

            return () => clearTimeout(scrollTimer);
        }
    }, [loading, isToday, displayHour]);


    // Efeito para pré-carregar (pre-fetch) o dia seguinte
    useEffect(() => {
        // Só executa se o carregamento da data atual estiver concluído e a conexão WS estiver aberta
        if (!loading && ws.current && ws.current.readyState === WebSocket.OPEN) {
            const nextDate = addDays(selectedDate, 1);

            // Pré-carrega o dia seguinte se ainda não estiver no cache
            if (!scheduleCache[nextDate]) {
                console.log(`Pré-carregando dados para: ${nextDate}`);
                ws.current.send(JSON.stringify({ date: nextDate }));
            }
        }
    }, [loading, selectedDate, scheduleCache]); // Roda sempre que a data selecionada ou o estado de loading muda


    const goToToday = () => {
        const today = formatDate(new Date());
        setSelectedDate(today);
        setLoading(true);
    };

    const goToPreviousDay = () => {
        setSelectedDate(prevDate => addDays(prevDate, -1));
        setLoading(true);
    };

    const goToNextDay = () => {
        setSelectedDate(prevDate => addDays(prevDate, 1));
        setLoading(true);
    };

    // Formata a data para exibição no formato DD/MM/YYYY
    const displayDate = formatDate(new Date(selectedDate + 'T00:00:00'), 'DD/MM/YYYY');


    return (
        <div className="dashboard-page">
            <div className="date-navigation">
                <button onClick={goToPreviousDay} className="nav-button">Anterior</button>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="date-picker"
                />
                <button onClick={goToNextDay} className="nav-button">Próximo</button>
                <button onClick={goToToday} className="today-button">Hoje</button>
            </div>

            {(loading || schedules === null) ? (
                <div className="loading-message">
                    <div className="spinner"></div>
                    <span>Carregando Agendas para {displayDate}, favor aguarde...</span>
                </div>
            ) : (
                <>
                    {rooms.length === 0 ? (
                        <p>Nenhuma agenda cadastrada. Adicione uma na <a href="/admin">página de administração</a>.</p>
                    ) : (
                        <div className="table-scroll-container" ref={scrollContainerRef}>
                            <table className="schedule-table schedule-table-vertical">
                                <thead>
                                    <tr>
                                        <th className="time-header-cell">Horário</th>
                                        {rooms.map(room => <th key={room.url}>{room.nome}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {hours.map(hour => (
                                        <tr key={hour} id={`hour-row-${hour}`}>
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
