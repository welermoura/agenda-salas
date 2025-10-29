import React from 'react';

const RoomRow = ({ name, schedule }) => {
    // Gera os slots de 30 minutos das 06:00 às 20:00
    const timeSlots = [];
    for (let hour = 6; hour <= 20; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
        if (hour < 20) {
            timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
        }
    }

    // Fallback para caso o schedule seja um erro
    if (schedule.error) {
        return (
            <div className="room-row error-row">
                <div className="room-name-container">
                    <h3 className="room-name">{name}</h3>
                </div>
                <div className="timeline-container">
                    <p>Erro ao carregar dados</p>
                </div>
            </div>
        );
    }

    return (
        <div className="room-row">
            <div className="room-name-container">
                <h3 className="room-name">{name}</h3>
            </div>
            <div className="timeline-container">
                <div className="timeline">
                    {timeSlots.map(time => {
                        const status = schedule[time] || 'indisponivel';
                        const statusText = status.charAt(0).toUpperCase() + status.slice(1);
                        return (
                            <div key={time} className={`timeline-block status-${status}`}>
                                <span className="time-label">{time}</span>
                                <span className="status-label">{statusText}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default RoomRow;
