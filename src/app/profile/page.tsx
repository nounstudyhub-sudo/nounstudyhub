'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

interface UserProfile {
  id: string;
  username: string;
  matriculationNumber: string;
  phoneNumber: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile');
        if (!response.ok) throw new Error('Failed to load profile');
        const data = await response.json();
        setUser(data.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="public-course-detail">
        <nav className="public-nav container">
          <Link className="brand" href="/">
            <span className="brand-mark">N</span>
            <span>NounStudyHub</span>
          </Link>
          <Link className="button button-secondary" href="/">
            Back
          </Link>
        </nav>
        <main className="container">
          <div style={{ padding: '40px 0', textAlign: 'center' }}>Loading profile...</div>
        </main>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="public-course-detail">
        <nav className="public-nav container">
          <Link className="brand" href="/">
            <span className="brand-mark">N</span>
            <span>NounStudyHub</span>
          </Link>
          <Link className="button button-secondary" href="/">
            Back
          </Link>
        </nav>
        <main className="container">
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#d32f2f' }}>
            {error || 'Profile not found'}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="public-course-detail">
      <nav className="public-nav container">
        <Link className="brand" href="/">
          <span className="brand-mark">N</span>
          <span>NounStudyHub</span>
        </Link>
        <Link className="button button-secondary" href="/">
          Back
        </Link>
      </nav>

      <main className="container">
        <div className="course-detail">
          <div className="course-detail-grid">
            <main className="detail-main course-detail-main">
              {/* Account Details Section */}
              <section className="course-detail-card">
                <div className="course-section-heading">
                  <div>
                    <h2>Account details</h2>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '16px' }}>
                  {/* Username */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #dfe7e1',
                    }}
                  >
                    <div style={{ width: '24px', marginRight: '12px', color: '#999' }}>👤</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: '#999' }}>Username</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#1c2a2b' }}>
                        {user.username}
                      </div>
                    </div>
                  </div>

                  {/* Matriculation Number */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #dfe7e1',
                    }}
                  >
                    <div style={{ width: '24px', marginRight: '12px', color: '#999', marginTop: '2px' }}>
                      📋
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: '#999' }}>Matriculation number</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#1c2a2b', textTransform: 'uppercase' }}>
                        {user.matriculationNumber}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                        One account per matriculation number
                      </div>
                    </div>
                  </div>

                  {/* Date Joined */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #dfe7e1',
                    }}
                  >
                    <div style={{ width: '24px', marginRight: '12px', color: '#999' }}>📅</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: '#999' }}>Date joined</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#1c2a2b' }}>
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Phone Number with Edit */}
                  <PhoneNumberField initialPhone={user.phoneNumber || ''} />
                </div>
              </section>

              {/* Data Privacy Section */}
              <section className="course-detail-card">
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ fontSize: '20px', marginRight: '12px' }}>🔒</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1c2a2b' }}>Your data stays yours</h3>
                </div>
                <p style={{ color: '#666', fontSize: '14px', lineHeight: 1.5 }}>
                  Your account details are used only to personalise your study experience.
                </p>
              </section>

              {/* Account Status Section */}
              <section className="course-detail-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1c2a2b', marginBottom: '4px' }}>
                      Account status
                    </h3>
                    <p style={{ fontSize: '14px', color: '#666' }}>
                      You have access to all admin features on NounStudyHub.
                    </p>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      backgroundColor: '#e8f5e9',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#1d7f63',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#1d7f63',
                        borderRadius: '50%',
                      }}
                    />
                    Active
                  </div>
                </div>
              </section>
            </main>
          </div>
        </div>
      </main>
    </div>
  );
}

interface PhoneNumberFieldProps {
  initialPhone: string;
}

function PhoneNumberField({ initialPhone }: PhoneNumberFieldProps) {
  const sanitizeDigits = (phone: string): string => {
    if (!phone) return '';
    // Remove country code prefix (+234, 234, or 0), dashes, spaces
    return phone
      .replace(/^(\+?234|0)/, '')
      .replace(/[-\s]/g, '')
      .replace(/\D/g, '')
      .slice(0, 10);
  };

  const [digits, setDigits] = useState<string>(sanitizeDigits(initialPhone));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDigits(sanitizeDigits(initialPhone));
  }, [initialPhone]);

  const handleToggleEdit = async () => {
    if (!isEditing) {
      // Enter edit mode
      setIsEditing(true);
      setSaveMessage(null);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      // Save
      setIsSaving(true);
      setSaveMessage(null);

      try {
        const fullNumber = digits ? `+234-${digits}` : '';
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: fullNumber }),
        });

        if (response.ok) {
          setSaveMessage({ type: 'success', text: 'Phone number updated.' });
          setIsEditing(false);
        } else {
          const error = await response.json();
          setSaveMessage({ type: 'error', text: error.error || 'Failed to update phone number' });
        }
      } catch (err) {
        setSaveMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'An error occurred',
        });
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingBottom: '12px',
          borderBottom: '1px solid #dfe7e1',
        }}
      >
        <div style={{ width: '24px', marginRight: '12px', color: '#999' }}>☎️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>
            Phone number <span style={{ fontSize: '11px' }}>Optional</span>
          </div>

          {/* Phone Input Container */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 0',
              position: 'relative',
            }}
          >
            {/* Country Code Prefix (Non-Editable) */}
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: isEditing ? '#1c2a2b' : '#999',
                userSelect: 'none',
              }}
            >
              +234-
            </span>

            {/* 10-Digit Phone Input */}
            <input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              disabled={!isEditing}
              value={digits}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, ''))}
              placeholder={isEditing ? '9014008284' : ''}
              style={{
                flex: 1,
                padding: '6px 0',
                fontSize: '14px',
                fontWeight: isEditing ? 400 : 600,
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: isEditing ? '2px solid #1d7f63' : 'none',
                outline: 'none',
                color: '#1c2a2b',
                cursor: isEditing ? 'text' : 'default',
              }}
            />

            {/* Edit / Save Button */}
            <button
              type="button"
              onClick={handleToggleEdit}
              disabled={isSaving}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#1d7f63',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.6 : 1,
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isSaving) e.currentTarget.style.backgroundColor = '#165a4a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1d7f63';
              }}
            >
              {isSaving ? 'Saving...' : isEditing ? 'Save' : 'Edit'}
            </button>
          </div>
        </div>
      </div>

      {/* Success / Error Message */}
      {saveMessage && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: saveMessage.type === 'success' ? '#e8f5e9' : '#ffebee',
            color: saveMessage.type === 'success' ? '#1d7f63' : '#d32f2f',
          }}
        >
          {saveMessage.text}
        </div>
      )}
    </div>
  );
}