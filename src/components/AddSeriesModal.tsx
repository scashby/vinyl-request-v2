import React, { useState, FormEvent } from 'react';

interface AddSeriesModalProps {
  onClose: () => void;
  onAddSeries: (args: { startDate: string; endDate: string; dayOfWeek: string }) => void;
}

const AddSeriesModal: React.FC<AddSeriesModalProps> = ({ onClose, onAddSeries }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('Sunday');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onAddSeries({ startDate, endDate, dayOfWeek });
    onClose();
  };

  return (
    <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
      <h2>Add Event Series</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label>
          Start Date:
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </label>
        <label>
          End Date:
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </label>
        <label>
          Day of Week:
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
            {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </label>
        <button type="submit" style={{ background: '#2563eb', color: '#fff', padding: '0.5rem', borderRadius: '4px', border: 'none' }}>Add Series</button>
      </form>
    </div>
  );
};

export default AddSeriesModal;
