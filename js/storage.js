const KEY = 'bracu_pro_data';

export const saveToCache = (cgpa, credits) => {
    const data = { cgpa, credits, timestamp: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(data));
};

export const loadFromCache = () => {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
};