import React from 'react';
import './Keypad.css';
import { Delete } from 'lucide-react';

interface KeypadProps {
    onPress: (key: string) => void;
    onClear: () => void;
    onBackspace: () => void;
    onSubmit: () => void;
}

const Keypad: React.FC<KeypadProps> = ({ onPress, onClear, onBackspace, onSubmit }) => {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    return (
        <div className="keypad">
            <div className="keypad-grid">
                {keys.map(k => (
                    <button key={k} className="key-btn" onClick={() => onPress(k)}>{k}</button>
                ))}
                <button className="key-btn action" onClick={onClear}>CLR</button>
                <button className="key-btn" onClick={() => onPress('0')}>0</button>
                <button className="key-btn action" onClick={onBackspace}>
                    <Delete size={24} />
                </button>
            </div>
            <button className="btn btn-primary btn-block" onClick={onSubmit}>
                LOG IN
            </button>
        </div>
    );
};

export default Keypad;
