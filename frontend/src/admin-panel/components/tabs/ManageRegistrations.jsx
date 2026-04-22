import React, { useState } from 'react'
import { useData } from '../../context/DataContext'
import './ManageRegistrations.css' // We will reuse or create some styles. We can actually use generic admin styles.

export default function ManageRegistrations() {
  const { events } = useData()
  const [selectedEvent, setSelectedEvent] = useState('')
  const [file, setFile] = useState(null)
  
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState(null)

  const fileInputRef = React.useRef(null)
  
  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file to upload.')
      return
    }
    if (!selectedEvent) {
      alert('Please select an event.')
      return
    }

    setIsLoading(true)
    setStats(null)

    try {
      const formData = new FormData()
      formData.append('event_id', selectedEvent)
      formData.append('file', file)

      const token = localStorage.getItem('ascent_admin_token')
      const BASE = (import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/$/, '')

      const res = await fetch(`${BASE}/admin-panel/registrations/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(errData?.detail || `HTTP Error ${res.status}`)
      }

      const created = res.headers.get('x-stats-created')
      const altered = res.headers.get('x-stats-added')
      const duplicates = res.headers.get('x-stats-duplicates')
      const errors = res.headers.get('x-stats-errors')

      if (created !== null) {
        setStats({ created, altered, duplicates, errors })
      }

      // Automatically download the generated CSV
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      // Use the returned content-disposition if possible, otherwise fallback
      const disposition = res.headers.get('content-disposition')
      let filename = 'credentials.csv'
      if (disposition && disposition.indexOf('filename=') !== -1) {
        filename = disposition.split('filename=')[1].replace(/['"]/g, '')
      }
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
      
      // Clear file input
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
    } catch (e) {
      console.error(e)
      alert(e.message || 'An error occurred during upload.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="manage-registrations-page fade-in">
      <div className="section-header">
        <span className="section-title">Manage Users Registrations</span>
      </div>
      
      <div className="card" style={{ maxWidth: 800 }}>
        <h3 style={{ marginBottom: '16px' }}>Upload Attendees List</h3>
        <p style={{ marginBottom: '24px' }}>Upload a CSV or Excel file containing the list of users you want to register or manage for a specific event. The file should map Unstop headers.</p>
        
        <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              1. Select Event
            </label>
            <select
              className="input-field"
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              disabled={isLoading}
            >
              <option value="">-- Choose an Event --</option>
              {events.map((ev) => (
                <option key={ev.eventId || ev.id} value={ev.eventId || ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1', minWidth: '220px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              2. Choose File (CSV / Excel)
            </label>
            <input 
              type="file" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileChange}
              className="input-field"
              style={{ paddingTop: 8, paddingBottom: 8 }}
              disabled={isLoading}
              ref={fileInputRef}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleUpload}
              disabled={!file || !selectedEvent || isLoading}
              style={{ height: '42px', position: 'relative', overflow: 'hidden' }}
            >
              {isLoading ? (
                <>
                   <span style={{ position: 'relative', zIndex: 2 }}>Processing...</span>
                   <div style={{
                     position: 'absolute', top: 0, left: 0, bottom: 0, width: '100%', 
                     background: 'rgba(255,255,255,0.2)',
                     animation: 'progress-indeterminate 1.5s infinite linear',
                     transformOrigin: 'left'
                   }} />
                </>
              ) : 'Upload Registrations'}
            </button>
          </div>

        </div>

        {/* CSS for pseudo progress bar animation */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes progress-indeterminate {
            0% { transform: scaleX(0); transform-origin: left; opacity: 1; }
            50% { transform: scaleX(1); transform-origin: left; opacity: 1; }
            50.1% { transform: scaleX(1); transform-origin: right; opacity: 1; }
            100% { transform: scaleX(0); transform-origin: right; opacity: 0; }
          }
        `}} />

        {stats && (
          <div style={{ marginTop: '30px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', animation: 'fade-in 0.3s ease' }}>
            <h4 style={{ marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🎉 Upload Successful
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px' }}>
              <div style={{ padding: '15px', background: 'var(--bg-card)', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>New Entries</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{stats.created}</div>
              </div>
              <div style={{ padding: '15px', background: 'var(--bg-card)', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Rows Altered</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{stats.altered}</div>
              </div>
              <div style={{ padding: '15px', background: 'var(--bg-card)', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Duplicates Evaded</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{stats.duplicates}</div>
              </div>
              <div style={{ padding: '15px', background: 'var(--bg-card)', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Errors Skipped</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{stats.errors}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
