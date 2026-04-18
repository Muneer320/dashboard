import React, { useState, useEffect } from 'react';
import Landing from './components/landing';
import { Credentials, Login } from './components/auth';
import { Dashboard, EventDetail } from './components/dashboard';
import { Explore, Schedule, Leaderboard } from './components/discover';
import { Mirage, Announcements, LostFound } from './components/community';
import { Rating, Feedback, Report } from './components/forms';

function getPage() {
  return window.location.hash.slice(1) || 'landing';
}

function PageHost({ onNav, id }) {
  switch (id) {
    case 'landing':       return <Landing onNav={onNav}/>;
    case 'credentials':   return <Credentials onNav={onNav}/>;
    case 'login':         return <Login onNav={onNav}/>;
    case 'dashboard':     return <Dashboard onNav={onNav}/>;
    case 'event-detail':  return <EventDetail onNav={onNav}/>;
    case 'explore':       return <Explore onNav={onNav}/>;
    case 'schedule':      return <Schedule onNav={onNav}/>;
    case 'leaderboard':   return <Leaderboard onNav={onNav}/>;
    case 'mirage':        return <Mirage onNav={onNav}/>;
    case 'announcements': return <Announcements onNav={onNav}/>;
    case 'lost-found':    return <LostFound onNav={onNav}/>;
    case 'rating':        return <Rating onNav={onNav}/>;
    case 'feedback':      return <Feedback onNav={onNav}/>;
    case 'report':        return <Report onNav={onNav}/>;
    default:              return <Landing onNav={onNav}/>;
  }
}

export default function App() {
  const [page, setPage] = useState(getPage);

  const onNav = (id) => {
    window.location.hash = id;
  };

  useEffect(() => {
    const onHash = () => {
      const next = getPage();
      setPage(next);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return <PageHost onNav={onNav} id={page} />;
}
