// frontend/src/services/groupService.js
const API_URL = '/api';

const getGroups = async () => {
    const response = await fetch(`${API_URL}/groups`);
    return response.json();
};

export default {
    getGroups,
};
