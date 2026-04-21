import React, { createContext, useContext, useState } from 'react'
import rawData from '../data.json'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [events]         = useState(rawData.events)
  const [eventManagers]  = useState(rawData.eventManagers)
  const [participants, setParticipants] = useState(rawData.participants)

  function updateParticipantStatus(id, newStatus) {
    setParticipants(prev =>
      prev.map(p => p.id === id ? { ...p, status: newStatus } : p)
    )
  }

  function markAttended(participantId) {
    setParticipants(prev =>
      prev.map(p => p.id === participantId ? { ...p, attended: true } : p)
    )
  }

  function markFoodClaimed(participantId) {
    setParticipants(prev =>
      prev.map(p => p.id === participantId ? { ...p, foodClaimed: true } : p)
    )
  }

  function markEntryScanned(participantId) {
    setParticipants(prev =>
      prev.map(p => p.id === participantId ? { ...p, entryScanned: true } : p)
    )
  }

  // Stats helpers
  const stats = {
    totalRegistered: participants.length,
    attending:       participants.filter(p => p.attended).length,
    restricted:      participants.filter(p => p.status === 'restricted').length,
    foodClaimed:     participants.filter(p => p.foodClaimed).length,
    entryScanned:    participants.filter(p => p.entryScanned).length,
    submitted:       participants.filter(p => p.submitted).length,
  }

  return (
    <DataContext.Provider value={{
      events, eventManagers, participants,
      updateParticipantStatus, markAttended, markFoodClaimed, markEntryScanned,
      stats
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
