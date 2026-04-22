import React from 'react'
import ReactDOM from 'react-dom'
import './ConfirmModal.css'

export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', isDanger = false, onConfirm, onCancel }) {
  return ReactDOM.createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-box fade-in">
        <div className={`modal-icon-wrap ${isDanger ? 'icon-danger' : 'icon-success'}`}>
          {isDanger ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 11 12 14 22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          )}
        </div>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button id="modal-cancel-btn" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            id="modal-confirm-btn"
            className={`btn ${isDanger ? 'btn-danger' : 'btn-success'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
