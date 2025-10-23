// frontend/src/pages/GroupsPage.js
import React, { useState, useEffect } from 'react';
import groupService from '../services/groupService';

const GroupsPage = () => {
    const [groups, setGroups] = useState([]);

    useEffect(() => {
        groupService.getGroups().then(data => {
            setGroups(data);
        });
    }, []);

    return (
        <div>
            <h1>Gerenciamento de Grupos</h1>
            <ul>
                {groups.map(group => (
                    <li key={group.dn}>{group.attrs.cn[0]}</li>
                ))}
            </ul>
        </div>
    );
};

export default GroupsPage;
