// src/components/DatePicker.tsx
'use client';

import { useState } from 'react';

interface DatePickerProps {
  value: { year: number | null; month: number | null; day: number | null };
  onChange: (date: { year: number | null; month: number | null; day: number | null }) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function DatePicker({ value, onChange, onClose, position }: DatePickerProps) {
  const [viewYear, setViewYear] = useState(value.year || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(value.month || new Date().getMonth() + 1);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month - 1, 1).getDay();
  };

  const handleDayClick = (day: number) => {
    onChange({
      year: viewYear,
      month: viewMonth,
      day: day,
    });
    onClose();
  };

  const handleToday = () => {
    const today = new Date();
    onChange({
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate(),
    });
    onClose();
  };

  const previousMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const days: (number | null)[] = [];

  // Add empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Add days of month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40000,
        }}
        onClick={onClose}
      />

      {/* Calendar */}
      <div
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          zIndex: 40001,
          background: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          padding: '12px',
          width: '280px',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          padding: '0 4px',
        }}>
          <button
            onClick={previousMonth}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#6b7280',
              padding: '4px 8px',
            }}
          >
            «
          </button>
          <div style={{ fontSize: '14px', fontWeight: '600' }}>
            {monthNames[viewMonth - 1]} {viewYear}
          </div>
          <button
            onClick={nextMonth}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#6b7280',
              padding: '4px 8px',
            }}
          >
            »
          </button>
        </div>

        {/* Day headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px',
          marginBottom: '4px',
        }}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} style={{
              textAlign: 'center',
              fontSize: '11px',
              fontWeight: '600',
              color: '#9ca3af',
              padding: '4px',
            }}>
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '2px',
          marginBottom: '8px',
        }}>
          {days.map((day, index) => (
            <div key={index}>
              {day ? (
                <button
                  onClick={() => handleDayClick(day)}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    border: 'none',
                    borderRadius: '4px',
                    background: day === value.day && viewMonth === value.month && viewYear === value.year
                      ? '#3b82f6'
                      : 'transparent',
                    color: day === value.day && viewMonth === value.month && viewYear === value.year
                      ? 'white'
                      : '#1f2937',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  {day}
                </button>
              ) : (
                <div style={{ width: '100%', aspectRatio: '1' }} />
              )}
            </div>
          ))}
        </div>

        {/* Today button */}
        <button
          onClick={handleToday}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            background: 'white',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
          }}
        >
          Today
        </button>
      </div>
    </>
  );
}