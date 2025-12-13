// src/components/DatePicker.tsx - FIXED: Dark text on white background
'use client';

import { useState } from 'react';

interface DatePickerProps {
  value: { year: number | null; month: number | null; day: number | null };
  onChange: (date: { year: number | null; month: number | null; day: number | null }) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function DatePicker({ value, onChange, onClose, position }: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleDayClick = (day: number) => {
    onChange({
      year: currentYear,
      month: currentMonth + 1,
      day: day
    });
  };

  const handlePreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    onChange({
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate()
    });
  };

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} style={{ padding: '8px' }} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const isSelected = value.year === currentYear && value.month === currentMonth + 1 && value.day === day;
    days.push(
      <div
        key={day}
        onClick={() => handleDayClick(day)}
        style={{
          padding: '8px',
          textAlign: 'center',
          cursor: 'pointer',
          borderRadius: '4px',
          backgroundColor: isSelected ? '#3b82f6' : 'transparent',
          color: isSelected ? 'white' : '#111827',
          fontWeight: isSelected ? '600' : '400',
          fontSize: '13px',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = '#f3f4f6';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        {day}
      </div>
    );
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          backgroundColor: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
          width: '280px',
        }}
      >
        {/* Header with month/year navigation */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <button
            onClick={handlePreviousMonth}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#6b7280',
              padding: '4px 8px',
            }}
          >
            «
          </button>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: '600',
            color: '#111827'
          }}>
            {monthNames[currentMonth]} {currentYear}
          </div>
          <button
            onClick={handleNextMonth}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#6b7280',
              padding: '4px 8px',
            }}
          >
            »
          </button>
        </div>

        {/* Day names header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            marginBottom: '4px',
          }}
        >
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div
              key={day}
              style={{
                padding: '4px',
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: '600',
                color: '#6b7280',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px',
            marginBottom: '8px',
          }}
        >
          {days}
        </div>

        {/* Today button */}
        <button
          onClick={handleToday}
          style={{
            width: '100%',
            padding: '6px',
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            color: '#111827',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e5e7eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f3f4f6';
          }}
        >
          Today
        </button>
      </div>
    </>
  );
}