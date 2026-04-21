-- 020_seed_explore_data.sql
-- Populates events with full schema (rounds, participants, judges, dates)
-- and updates users with events JSONB so "My Events" tab has data.

-- ════════════════════════════════════════════════════════════════════════════
-- 1) UPDATE EVENTS — add rounds, participants, judges, dates, max_participants
-- ════════════════════════════════════════════════════════════════════════════

-- Hacker's Quest
UPDATE events SET
  start_date  = '2026-05-16T10:00:00+05:30',
  end_date    = '2026-05-17T10:00:00+05:30',
  venue       = ARRAY['Block C', 'Lab 1'],
  judges      = ARRAY['Dr. Ishan Mehra', 'Prof. Kavya Nair'],
  max_participants = 100,
  registration_deadline = '2026-05-14T23:59:00+05:30',
  rounds = '{
    "phase1": {
      "title": "Qualifier",
      "description": "Build an MVP based on the theme revealed at kickoff.",
      "problemStatement": "Theme will be announced at the event.",
      "venue": ["Block C"],
      "start_time": "2026-05-16T10:00:00+05:30",
      "end_time": "2026-05-16T22:00:00+05:30",
      "submissionType": "url",
      "allowedFileTypes": [],
      "is_active": true,
      "is_locked": false
    },
    "phase2": {
      "title": "Finals",
      "description": "Present your project to the judges panel.",
      "problemStatement": "",
      "venue": ["Auditorium"],
      "start_time": "2026-05-17T08:00:00+05:30",
      "end_time": "2026-05-17T10:00:00+05:30",
      "submissionType": "url",
      "allowedFileTypes": [],
      "is_active": false,
      "is_locked": true
    }
  }'::jsonb,
  participants = '{
    "1abd0a5b-6104-4926-a1ac-e40e095c3abd": {
      "registeredAt": "2026-05-10T14:00:00+05:30",
      "currentPhase": 1,
      "status": "active",
      "isAttending": true,
      "submission": {}
    },
    "13c5a65a-a705-4687-b31b-ad49e1f197cc": {
      "registeredAt": "2026-05-10T15:30:00+05:30",
      "currentPhase": 1,
      "status": "active",
      "isAttending": true,
      "submission": {}
    },
    "dc530b92-377e-4ad2-a7a1-7ebc11477a6d": {
      "registeredAt": "2026-05-11T09:00:00+05:30",
      "currentPhase": 1,
      "status": "active",
      "isAttending": false,
      "submission": {}
    }
  }'::jsonb
WHERE id = '6a36f54b-61e5-41ce-b0bf-80f5c0022e10';

-- Design Sprint
UPDATE events SET
  start_date  = '2026-05-16T14:00:00+05:30',
  end_date    = '2026-05-16T22:00:00+05:30',
  venue       = ARRAY['Studio B'],
  judges      = ARRAY['Neha Sharma', 'Arjun Patel'],
  max_participants = 60,
  registration_deadline = '2026-05-14T23:59:00+05:30',
  rounds = '{
    "phase1": {
      "title": "Wireframe Round",
      "description": "Create wireframes for a given brief within 3 hours.",
      "problemStatement": "Design a mental-health check-in app for college students.",
      "venue": ["Studio B"],
      "start_time": "2026-05-16T14:00:00+05:30",
      "end_time": "2026-05-16T17:00:00+05:30",
      "submissionType": "file",
      "allowedFileTypes": ["pdf", "fig"],
      "is_active": true,
      "is_locked": false
    },
    "phase2": {
      "title": "Hi-Fi Prototype",
      "description": "Build a clickable hi-fi prototype from your wireframes.",
      "problemStatement": "",
      "venue": ["Studio B"],
      "start_time": "2026-05-16T18:00:00+05:30",
      "end_time": "2026-05-16T22:00:00+05:30",
      "submissionType": "url",
      "allowedFileTypes": [],
      "is_active": false,
      "is_locked": true
    }
  }'::jsonb,
  participants = '{
    "1abd0a5b-6104-4926-a1ac-e40e095c3abd": {
      "registeredAt": "2026-05-11T10:00:00+05:30",
      "currentPhase": 1,
      "status": "active",
      "isAttending": true,
      "submission": {}
    },
    "5f76f942-5f79-4aa5-b095-fe347b91948d": {
      "registeredAt": "2026-05-11T11:00:00+05:30",
      "currentPhase": 1,
      "status": "active",
      "isAttending": true,
      "submission": {}
    }
  }'::jsonb
WHERE id = '8c6746fa-1474-4091-9cbd-9e0c75aa5b9e';

-- Algo Rumble
UPDATE events SET
  start_date  = '2026-05-17T09:00:00+05:30',
  end_date    = '2026-05-17T13:00:00+05:30',
  venue       = ARRAY['Block C', 'Room 2A'],
  judges      = ARRAY['Prof. Ravi Kumar'],
  max_participants = 200,
  registration_deadline = '2026-05-15T23:59:00+05:30',
  rounds = '{
    "phase1": {
      "title": "Online Qualifier",
      "description": "Solve 5 problems in 2 hours on the online judge.",
      "problemStatement": "Problems range from easy to hard. Top 50 advance.",
      "venue": ["Room 2A"],
      "start_time": "2026-05-17T09:00:00+05:30",
      "end_time": "2026-05-17T11:00:00+05:30",
      "submissionType": "url",
      "allowedFileTypes": [],
      "is_active": true,
      "is_locked": false
    },
    "phase2": {
      "title": "Head-to-Head Finals",
      "description": "1v1 bracket elimination with live audience.",
      "problemStatement": "",
      "venue": ["Block C"],
      "start_time": "2026-05-17T11:30:00+05:30",
      "end_time": "2026-05-17T13:00:00+05:30",
      "submissionType": "url",
      "allowedFileTypes": [],
      "is_active": false,
      "is_locked": true
    }
  }'::jsonb,
  participants = '{
    "1abd0a5b-6104-4926-a1ac-e40e095c3abd": {
      "registeredAt": "2026-05-09T08:00:00+05:30",
      "currentPhase": 2,
      "status": "completed",
      "isAttending": true,
      "submission": {
        "phase1": {
          "type": "url",
          "value": "https://codeforces.com/submission/12345",
          "submittedAt": "2026-05-17T10:50:00+05:30"
        }
      }
    },
    "5f76f942-5f79-4aa5-b095-fe347b91948d": {
      "registeredAt": "2026-05-09T12:00:00+05:30",
      "currentPhase": 1,
      "status": "eliminated",
      "isAttending": true,
      "submission": {
        "phase1": {
          "type": "url",
          "value": "https://codeforces.com/submission/67890",
          "submittedAt": "2026-05-17T10:55:00+05:30"
        }
      }
    },
    "9cfb536a-a863-499a-97f6-802c3e87541f": {
      "registeredAt": "2026-05-10T09:00:00+05:30",
      "currentPhase": 1,
      "status": "active",
      "isAttending": true,
      "submission": {}
    },
    "8cca6610-dfd3-4a6d-88b8-5bf892e00d4f": {
      "registeredAt": "2026-05-10T10:00:00+05:30",
      "currentPhase": 1,
      "status": "active",
      "isAttending": false,
      "submission": {}
    }
  }'::jsonb
WHERE id = 'e32cc54b-3720-4a48-bff1-5fedb8d73e05';

-- Pitch Perfect
UPDATE events SET
  start_date  = '2026-05-16T16:00:00+05:30',
  end_date    = '2026-05-17T04:00:00+05:30',
  venue       = ARRAY['Auditorium'],
  judges      = ARRAY['Sneha Gupta', 'Vikram Bhat', 'Anjali Rao'],
  max_participants = 40,
  registration_deadline = '2026-05-14T23:59:00+05:30',
  rounds = '{
    "phase1": {
      "title": "Pitch Deck",
      "description": "Submit your startup pitch deck for screening.",
      "problemStatement": "Build a solution for rural healthcare access.",
      "venue": ["Auditorium"],
      "start_time": "2026-05-16T16:00:00+05:30",
      "end_time": "2026-05-16T18:00:00+05:30",
      "submissionType": "file",
      "allowedFileTypes": ["pdf", "pptx"],
      "is_active": true,
      "is_locked": false
    }
  }'::jsonb,
  participants = '{
    "13c5a65a-a705-4687-b31b-ad49e1f197cc": {
      "registeredAt": "2026-05-12T16:00:00+05:30",
      "currentPhase": 1,
      "status": "active",
      "isAttending": true,
      "submission": {
        "phase1": {
          "type": "file",
          "value": "/uploads/pitch_user2.pdf",
          "submittedAt": "2026-05-16T17:30:00+05:30"
        }
      }
    },
    "9cfb536a-a863-499a-97f6-802c3e87541f": {
      "registeredAt": "2026-05-12T17:00:00+05:30",
      "currentPhase": 1,
      "status": "active",
      "isAttending": true,
      "submission": {}
    }
  }'::jsonb
WHERE id = '2a64e34b-eea3-4f56-b910-1c2a39c9ee39';

-- Capture The Flag
UPDATE events SET
  start_date  = '2026-05-17T14:00:00+05:30',
  end_date    = '2026-05-17T20:00:00+05:30',
  venue       = ARRAY['Lab 2', 'Server Room'],
  judges      = ARRAY['Amit Deshmukh'],
  max_participants = 80,
  registration_deadline = '2026-05-15T23:59:00+05:30',
  rounds = '{
    "phase1": {
      "title": "Jeopardy CTF",
      "description": "Solve challenges across web, crypto, forensics, and pwn.",
      "problemStatement": "Flag format: ascent{...}",
      "venue": ["Lab 2"],
      "start_time": "2026-05-17T14:00:00+05:30",
      "end_time": "2026-05-17T20:00:00+05:30",
      "submissionType": "url",
      "allowedFileTypes": [],
      "is_active": true,
      "is_locked": false
    }
  }'::jsonb,
  participants = '{
    "8cca6610-dfd3-4a6d-88b8-5bf892e00d4f": {
      "registeredAt": "2026-05-13T09:00:00+05:30",
      "currentPhase": 1,
      "status": "active",
      "isAttending": true,
      "submission": {}
    },
    "dc530b92-377e-4ad2-a7a1-7ebc11477a6d": {
      "registeredAt": "2026-05-13T10:00:00+05:30",
      "currentPhase": 1,
      "status": "active",
      "isAttending": true,
      "submission": {}
    }
  }'::jsonb
WHERE id = '65bbb00e-182d-4825-9b4c-3009ff90022b';


-- ════════════════════════════════════════════════════════════════════════════
-- 2) UPDATE USERS — populate events JSONB, details, and food
-- ════════════════════════════════════════════════════════════════════════════

-- user1 (1abd0a5b…): registered for Hacker's Quest, Design Sprint, Algo Rumble
UPDATE users SET
  is_attending = true,
  details = '{
    "email": "archived-24a5c23956@example.invalid",
    "phone": "0000000000",
    "college": "IIIT Bangalore",
    "year": "3rd",
    "branch": "CSE",
    "profile_pic": "",
    "gender": "Male",
    "city": "Bangalore",
    "emergency_contact": "0000000000"
  }'::jsonb,
  events = '{
    "6a36f54b-61e5-41ce-b0bf-80f5c0022e10": {
      "isAttending": true,
      "phase": 1,
      "status": "active",
      "restricted": false,
      "submission": false,
      "submissionType": null,
      "submissionURL": null,
      "submissionFile": null,
      "submissionTime": null,
      "teamId": "913b836c-e27b-444d-bd82-546df86306f2",
      "score": 0,
      "rank": null
    },
    "8c6746fa-1474-4091-9cbd-9e0c75aa5b9e": {
      "isAttending": true,
      "phase": 1,
      "status": "active",
      "restricted": false,
      "submission": false,
      "submissionType": null,
      "submissionURL": null,
      "submissionFile": null,
      "submissionTime": null,
      "teamId": null,
      "score": 0,
      "rank": null
    },
    "e32cc54b-3720-4a48-bff1-5fedb8d73e05": {
      "isAttending": true,
      "phase": 2,
      "status": "completed",
      "restricted": false,
      "submission": true,
      "submissionType": "url",
      "submissionURL": "https://codeforces.com/submission/12345",
      "submissionFile": null,
      "submissionTime": "2026-05-17T10:50:00+05:30",
      "teamId": null,
      "score": 450,
      "rank": 3
    }
  }'::jsonb,
  food = '{"meal1": true, "meal2": false, "meal3": false}'::jsonb,
  cents = 150
WHERE id = '1abd0a5b-6104-4926-a1ac-e40e095c3abd';

-- user2 (13c5a65a…): registered for Hacker's Quest, Pitch Perfect
UPDATE users SET
  is_attending = true,
  details = '{
    "email": "archived-1886f24e07@example.invalid",
    "phone": "0000000000",
    "college": "BITS Pilani",
    "year": "2nd",
    "branch": "ECE",
    "profile_pic": "",
    "gender": "Female",
    "city": "Pilani",
    "emergency_contact": "0000000000"
  }'::jsonb,
  events = '{
    "6a36f54b-61e5-41ce-b0bf-80f5c0022e10": {
      "isAttending": true,
      "phase": 1,
      "status": "active",
      "restricted": false,
      "submission": false,
      "submissionType": null,
      "submissionURL": null,
      "submissionFile": null,
      "submissionTime": null,
      "teamId": null,
      "score": 0,
      "rank": null
    },
    "2a64e34b-eea3-4f56-b910-1c2a39c9ee39": {
      "isAttending": true,
      "phase": 1,
      "status": "active",
      "restricted": false,
      "submission": true,
      "submissionType": "file",
      "submissionURL": null,
      "submissionFile": "/uploads/pitch_user2.pdf",
      "submissionTime": "2026-05-16T17:30:00+05:30",
      "teamId": null,
      "score": 0,
      "rank": null
    }
  }'::jsonb,
  food = '{"meal1": true, "meal2": true, "meal3": false}'::jsonb,
  cents = 80
WHERE id = '13c5a65a-a705-4687-b31b-ad49e1f197cc';

-- user3 (5f76f942…): registered for Design Sprint, Algo Rumble
UPDATE users SET
  is_attending = true,
  details = '{
    "email": "archived-01b0aba0d2@example.invalid",
    "phone": "0000000000",
    "college": "NIT Trichy",
    "year": "4th",
    "branch": "IT",
    "profile_pic": "",
    "gender": "Male",
    "city": "Trichy",
    "emergency_contact": "0000000000"
  }'::jsonb,
  events = '{
    "8c6746fa-1474-4091-9cbd-9e0c75aa5b9e": {
      "isAttending": true,
      "phase": 1,
      "status": "active",
      "restricted": false,
      "submission": false,
      "submissionType": null,
      "submissionURL": null,
      "submissionFile": null,
      "submissionTime": null,
      "teamId": null,
      "score": 0,
      "rank": null
    },
    "e32cc54b-3720-4a48-bff1-5fedb8d73e05": {
      "isAttending": true,
      "phase": 1,
      "status": "eliminated",
      "restricted": false,
      "submission": true,
      "submissionType": "url",
      "submissionURL": "https://codeforces.com/submission/67890",
      "submissionFile": null,
      "submissionTime": "2026-05-17T10:55:00+05:30",
      "teamId": null,
      "score": 120,
      "rank": 28
    }
  }'::jsonb,
  food = '{"meal1": false, "meal2": false, "meal3": false}'::jsonb,
  cents = 40
WHERE id = '5f76f942-5f79-4aa5-b095-fe347b91948d';

-- user4 (9cfb536a…): registered for Algo Rumble, Pitch Perfect
UPDATE users SET
  is_attending = true,
  details = '{
    "email": "archived-daa60323cd@example.invalid",
    "phone": "0000000000",
    "college": "IIT Madras",
    "year": "3rd",
    "branch": "CSE",
    "profile_pic": "",
    "gender": "Female",
    "city": "Chennai",
    "emergency_contact": "0000000000"
  }'::jsonb,
  events = '{
    "e32cc54b-3720-4a48-bff1-5fedb8d73e05": {
      "isAttending": true,
      "phase": 1,
      "status": "active",
      "restricted": false,
      "submission": false,
      "submissionType": null,
      "submissionURL": null,
      "submissionFile": null,
      "submissionTime": null,
      "teamId": null,
      "score": 0,
      "rank": null
    },
    "2a64e34b-eea3-4f56-b910-1c2a39c9ee39": {
      "isAttending": true,
      "phase": 1,
      "status": "active",
      "restricted": false,
      "submission": false,
      "submissionType": null,
      "submissionURL": null,
      "submissionFile": null,
      "submissionTime": null,
      "teamId": null,
      "score": 0,
      "rank": null
    }
  }'::jsonb,
  food = '{"meal1": true, "meal2": true, "meal3": true}'::jsonb,
  cents = 200
WHERE id = '9cfb536a-a863-499a-97f6-802c3e87541f';

-- user5 (8cca6610…): registered for Algo Rumble, Capture The Flag
UPDATE users SET
  is_attending = true,
  details = '{
    "email": "archived-f198e40331@example.invalid",
    "phone": "0000000000",
    "college": "VIT Vellore",
    "year": "2nd",
    "branch": "CSE",
    "profile_pic": "",
    "gender": "Male",
    "city": "Vellore",
    "emergency_contact": "0000000000"
  }'::jsonb,
  events = '{
    "e32cc54b-3720-4a48-bff1-5fedb8d73e05": {
      "isAttending": false,
      "phase": 1,
      "status": "active",
      "restricted": false,
      "submission": false,
      "submissionType": null,
      "submissionURL": null,
      "submissionFile": null,
      "submissionTime": null,
      "teamId": null,
      "score": 0,
      "rank": null
    },
    "65bbb00e-182d-4825-9b4c-3009ff90022b": {
      "isAttending": true,
      "phase": 1,
      "status": "active",
      "restricted": false,
      "submission": false,
      "submissionType": null,
      "submissionURL": null,
      "submissionFile": null,
      "submissionTime": null,
      "teamId": null,
      "score": 0,
      "rank": null
    }
  }'::jsonb,
  food = '{"meal1": true, "meal2": false, "meal3": false}'::jsonb,
  cents = 60
WHERE id = '8cca6610-dfd3-4a6d-88b8-5bf892e00d4f';

-- user6 (dc530b92…): registered for Hacker's Quest, Capture The Flag
UPDATE users SET
  is_attending = true,
  details = '{
    "email": "archived-2ade4187ff@example.invalid",
    "phone": "0000000000",
    "college": "Manipal Institute",
    "year": "1st",
    "branch": "AI & ML",
    "profile_pic": "",
    "gender": "Male",
    "city": "Manipal",
    "emergency_contact": "0000000000"
  }'::jsonb,
  events = '{
    "6a36f54b-61e5-41ce-b0bf-80f5c0022e10": {
      "isAttending": false,
      "phase": 1,
      "status": "active",
      "restricted": false,
      "submission": false,
      "submissionType": null,
      "submissionURL": null,
      "submissionFile": null,
      "submissionTime": null,
      "teamId": null,
      "score": 0,
      "rank": null
    },
    "65bbb00e-182d-4825-9b4c-3009ff90022b": {
      "isAttending": true,
      "phase": 1,
      "status": "active",
      "restricted": false,
      "submission": false,
      "submissionType": null,
      "submissionURL": null,
      "submissionFile": null,
      "submissionTime": null,
      "teamId": null,
      "score": 0,
      "rank": null
    }
  }'::jsonb,
  food = '{"meal1": false, "meal2": false, "meal3": false}'::jsonb,
  cents = 20
WHERE id = 'dc530b92-377e-4ad2-a7a1-7ebc11477a6d';
