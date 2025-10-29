import React from 'react';

const RoomCard = ({ name, schedule }) => {
    // Define as horas a serem exibidas na linha do tempo
    const hours = Array.from({ length: 15 }, (_, i) => `${(i + 6).toString().padStart(2, '0')}:00`);

    // Determina o status atual (a primeira hora no objeto de agendamento)
    const currentHour = new Date().getHours().toString().padStart(2, '0') + ':00';
    const currentStatus = schedule[currentHour] || 'indisponivel';

    // Fallback para caso o schedule seja um erro
    if (schedule.error) {
        return (
            <div className="room-card error-card">
                <h3 className="room-name">{name}</h3>
                <p className="current-status-text">Erro ao carregar dados</p>
                <div className="timeline">
                    <div className="timeline-bar status-error-full"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="room-card">
            <div className="card-header">
                <h3 className="room-name">{name}</h3>
                <div className="current-status">
                    <span className={`status-indicator status-${currentStatus}`}></span>
                    <span className="current-status-text">{currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}</span>
                </div>
            </div>

            <div className="timeline">
                {hours.map(hour => {
                    const status = schedule[hour] || 'indisponivel';
                    return (
                        <div key={hour} className={`timeline-block status-${status}`}>
                            <span className="tooltip">{`${hour} - ${status}`}</span>
                        </div>
                    );
                })}
            </div>
            <div className="timeline-labels">
                {hours.filter((_, i) => i % 2 === 0).map(hour => <span key={hour}>{hour}</span>)}
            </div>
        </div>
    );
};

export default RoomCard;
