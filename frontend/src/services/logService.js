// frontend/src/services/logService.js
const API_URL = '/api';

const getLogs = async () => {
    const response = await fetch(`${API_URL}/logs`);
    return response.json();
};

export default {
    getLogs,
};
