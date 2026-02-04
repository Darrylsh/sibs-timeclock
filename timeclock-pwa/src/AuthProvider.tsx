import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
    id: number;
    phone: string;
    role: string;
    employee_id?: number;
    employee?: {
        first_name: string;
        last_name: string;
        company_id: number;
    };
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User, stayLoggedIn: boolean) => void;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check localStorage
        const savedToken = localStorage.getItem('timeclock_token');
        const savedUser = localStorage.getItem('timeclock_user');

        // Check sessionStorage (for non-persistent kiosk mode)
        const sessionToken = sessionStorage.getItem('timeclock_token');
        const sessionUser = sessionStorage.getItem('timeclock_user');

        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
        } else if (sessionToken && sessionUser) {
            setToken(sessionToken);
            setUser(JSON.parse(sessionUser));
        }
        setIsLoading(false);
    }, []);

    const login = (newToken: string, newUser: User, stayLoggedIn: boolean) => {
        setToken(newToken);
        setUser(newUser);
        const storage = stayLoggedIn ? localStorage : sessionStorage;
        storage.setItem('timeclock_token', newToken);
        storage.setItem('timeclock_user', JSON.stringify(newUser));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('timeclock_token');
        localStorage.removeItem('timeclock_user');
        sessionStorage.removeItem('timeclock_token');
        sessionStorage.removeItem('timeclock_user');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
