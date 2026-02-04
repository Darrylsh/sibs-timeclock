import { useState } from 'react';
import Keypad from '../components/Keypad';
import { useAuth } from '../AuthProvider';
import { login as apiLogin } from '../api';
import { useNavigate } from 'react-router-dom';

const LoginScreen = () => {
    const [step, setStep] = useState<'PHONE' | 'PIN'>('PHONE');
    const [phone, setPhone] = useState('');
    const [pin, setPin] = useState('');
    const [stayLoggedIn, setStayLoggedIn] = useState(true);
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const handlePress = (key: string) => {
        setError('');
        if (step === 'PHONE') {
            if (phone.length < 15) setPhone(prev => prev + key);
        } else {
            if (pin.length < 8) setPin(prev => prev + key);
        }
    };

    const handleBackspace = () => {
        if (step === 'PHONE') setPhone(prev => prev.slice(0, -1));
        else setPin(prev => prev.slice(0, -1));
    };

    const handleSubmit = async () => {
        if (step === 'PHONE') {
            if (phone.length < 3) return setError('Phone too short');
            setStep('PIN');
        } else {
            // API Login
            try {
                const data = await apiLogin(phone, pin);
                login(data.token, data.user, stayLoggedIn);
                navigate('/');
            } catch (e: any) {
                setError(e.message);
                setPin(''); // Clear PIN on error
            }
        }
    };

    return (
        <div style={{
            height: '100dvh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'radial-gradient(circle at top left, #1e1b4b, #0f172a)'
        }}>
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '1rem',
                gap: '1rem'
            }}>
                {/* Header Section - Shrinks if needed */}
                <div style={{ textAlign: 'center', marginBottom: 'auto' }}>
                    <h1 style={{ margin: '0.5rem 0', fontWeight: 300, fontSize: '1.5rem', color: 'var(--text-color)' }}>SIBS Payroll Services</h1>

                    <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '1px' }}>
                            {step === 'PHONE' ? 'ENTER PHONE NUMBER' : 'ENTER PIN'}
                        </label>
                        <div style={{
                            fontSize: '2rem',
                            letterSpacing: '2px',
                            fontWeight: '300',
                            height: '50px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: (step === 'PHONE' && !phone) || (step === 'PIN' && !pin) ? 'var(--text-muted)' : 'var(--text-color)'
                        }}>
                            {step === 'PHONE' ? (phone || '___-____') : (pin ? '•'.repeat(pin.length) : 'Enter PIN')}
                        </div>
                    </div>
                </div>

                {/* Keypad Section - Grows to fill space */}
                <div style={{ flex: 1, maxHeight: '60vh' }}>
                    <Keypad
                        onPress={handlePress}
                        onBackspace={handleBackspace}
                        onClear={() => step === 'PHONE' ? setPhone('') : setPin('')}
                        onSubmit={handleSubmit}
                    />
                </div>

                {/* Footer Actions */}
                <div style={{ marginTop: 'auto', textAlign: 'center' }}>
                    {step === 'PHONE' && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem' }}>
                            <input
                                type="checkbox"
                                id="stayLoggedIn"
                                checked={stayLoggedIn}
                                onChange={e => setStayLoggedIn(e.target.checked)}
                                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                            />
                            <label htmlFor="stayLoggedIn" style={{ fontSize: '0.9rem' }}>Stay Logged In</label>
                        </div>
                    )}
                    {step === 'PIN' && (
                        <button className="btn btn-ghost" onClick={() => setStep('PHONE')}>Back to Phone</button>
                    )}
                    {error && <div className="animate-fade-in" style={{ color: 'var(--danger)', fontSize: '0.9rem', marginTop: '0.5rem' }}>{error}</div>}
                </div>
            </div>
        </div>
    );
};
export default LoginScreen;
