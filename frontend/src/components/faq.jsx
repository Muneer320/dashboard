// Ascent — FAQ Page
import { useState, useMemo } from 'react';
import { useMobile, NavBar, PageBackground, Footer } from './shared';

// ─── FAQ Data ───────────────────────────────────────────────────────────────

const FAQ_DATA = [
  {
    id: 'synapse',
    name: 'Synapse',
    subtitle: 'Kaggle Competition',
    tone: 'violet',
    sections: [
      {
        title: 'Participation & Eligibility',
        items: [
          { q: 'Who can participate?', a: 'College students with interest in AI/ML, data science, or coding.' },
          { q: 'What skills are required?', a: 'Basic knowledge of Python, Pandas, and ML concepts is recommended.' },
          { q: 'What is the team size?', a: '2–3 members per team.' },
          { q: 'Can cross-college teams participate?', a: 'Yes, cross-campus teams are allowed.' },
        ],
      },
      {
        title: 'Registration & Team Formation',
        items: [
          { q: 'Do we register individually or as a team?', a: 'Register individually first, then form a team.' },
          { q: 'Can we change teams later?', a: 'No. Teams are final once confirmed.' },
          { q: 'What happens after registration?', a: "You'll receive instructions for the Round 1 Kaggle competition." },
        ],
      },
      {
        title: 'Competition Structure',
        items: [
          { q: 'How many rounds are there?', a: '2 rounds: Round 1 is an Online Kaggle qualifier; Round 2 is an 8-hour offline finals.' },
          { q: 'How do we qualify for finals?', a: 'Top 25 teams from Round 1 leaderboard qualify.' },
        ],
      },
      {
        title: 'Round 1 (Online Qualifier)',
        items: [
          { q: 'How does Round 1 work?', a: "You'll get a dataset and submit predictions on Kaggle." },
          { q: 'Can we submit multiple times?', a: 'Yes. Your best score will be considered.' },
          { q: 'How are we evaluated?', a: 'Based on the defined metric (e.g., RMSE, F1-score) on hidden test data.' },
        ],
      },
      {
        title: 'Finals (Offline Event)',
        items: [
          { q: 'What happens in the finals?', a: 'Dataset release, 7-hour model building, leaderboard competition, and a code audit + pitch for top teams.' },
          { q: 'How long is the finals event?', a: '10 hours (10:00 AM – 6:00 PM).' },
          { q: 'What is the "leaderboard freeze"?', a: 'From 4 PM onward, scores are hidden until the final reveal.' },
        ],
      },
      {
        title: 'Data & Modeling Rules',
        items: [
          { q: 'Can we use external datasets?', a: 'No, unless explicitly allowed.' },
          { q: 'Can we use pre-trained models?', a: 'No, unless specified.' },
          { q: 'What is data leakage?', a: 'Using test data during training — this leads to disqualification.' },
        ],
      },
      {
        title: 'Compute & Tools',
        items: [
          { q: 'What compute resources are allowed?', a: 'Only free-tier compute (Kaggle / Colab Free).' },
          { q: 'Can we use paid GPUs (Colab Pro, etc.)?', a: 'No. This leads to immediate disqualification.' },
          { q: 'Can we use local machines?', a: 'Yes, but within fair usage guidelines.' },
        ],
      },
      {
        title: 'Mentorship',
        items: [
          { q: 'Will mentors help?', a: 'Yes, for guidance and debugging.' },
          { q: 'Will mentors help with modeling/code?', a: 'No direct solutions will be given.' },
        ],
      },
      {
        title: 'Evaluation & Final Round',
        items: [
          { q: 'What happens after submissions close?', a: 'Top 5 teams undergo a code audit.' },
          { q: 'What is checked in code audit?', a: 'Reproducibility, no hardcoding, and valid feature engineering.' },
          { q: 'Do finalists need to present?', a: 'Yes, top teams give a 3-minute explanation.' },
        ],
      },
      {
        title: 'Logistics',
        items: [
          { q: 'What should we bring?', a: 'Laptop + charger, and pre-installed tools (optional).' },
          { q: 'Will internet and food be provided?', a: 'Yes, both will be provided.' },
        ],
      },
      {
        title: 'Rules & Compliance',
        items: [
          { q: 'What leads to disqualification?', a: 'Data leakage, plagiarism / copied notebooks, hardcoding outputs, paid compute usage, or misconduct.' },
        ],
      },
    ],
  },
  {
    id: 'robo-soccer',
    name: 'Robo Soccer',
    subtitle: 'Robotics — Manual Control',
    tone: 'teal',
    sections: [
      {
        title: 'Event Overview',
        items: [
          { q: 'What is Robo Soccer?', a: 'A high-energy, team-based robotics competition where participants design and control robots to compete in a 2v2 football-style match on a turf arena.' },
          { q: 'What is the objective?', a: 'To score more goals than the opponent by pushing the ball into their goal while defending your own.' },
          { q: 'What skills are evaluated?', a: 'Real-time control & coordination, team strategy, robot design & stability, and offensive and defensive gameplay.' },
          { q: 'Is this autonomous or manual?', a: 'Manual control (real-time operation required).' },
        ],
      },
      {
        title: 'Eligibility & Team Rules',
        items: [
          { q: 'Who can participate?', a: 'Undergraduate students from any college/institution.' },
          { q: 'What is the team size?', a: '2–4 members per team.' },
          { q: 'How many robots per team?', a: '2 robots per team will play simultaneously.' },
          { q: 'Are cross-college teams allowed?', a: 'Yes.' },
          { q: 'Can a participant be part of multiple teams?', a: 'No.' },
          { q: 'Can team members be changed after registration?', a: 'No.' },
        ],
      },
      {
        title: 'Registration & Qualification',
        items: [
          { q: 'What is the registration process?', a: 'Register individually on Unstop → Create/join a team → Join WhatsApp community → Submit Round 1 video.' },
          { q: 'What is Round 1 (Online Qualification)?', a: 'Teams must upload a video demonstrating movement (forward, backward, turning) and ball control (if possible).' },
          { q: 'How are teams shortlisted?', a: 'Based on control, build quality, and functionality.' },
          { q: 'What happens after qualification?', a: 'Shortlisted teams move to Round 2 (on-campus matches).' },
        ],
      },
      {
        title: 'Important Dates & Timeline',
        items: [
          { q: 'What is the complete timeline?', a: '2 Apr 2026 → Registrations Open · 29 Apr → Registrations Close · 20–30 Apr → Round 1 Submission · 1 May → Round 1 Results · 2–4 May → RSVP Confirmation · By 5 May → Final Announcement · Event Day: 16 May 2026.' },
          { q: 'What is the event day schedule?', a: '10:30–11:30 AM Arena Setup · 11:30 AM–12:00 PM Registration & Robot Inspection · 12:00–2:30 PM Robo Soccer Matches · 2:15–2:45 PM Results & Prize Distribution.' },
        ],
      },
      {
        title: 'Match Format',
        items: [
          { q: 'What is the match format?', a: '2 vs 2 robot match; each team uses 2 robots.' },
          { q: 'What is the match duration?', a: '5 minutes total: 2-minute half, 1-minute break, 2-minute half.' },
          { q: 'How is the winner decided?', a: 'Team with more goals wins.' },
          { q: 'What happens in case of a tie?', a: '2-minute extra time; golden goal if still tied.' },
          { q: 'Is maintenance allowed during matches?', a: 'Yes, up to 30 seconds per match.' },
        ],
      },
      {
        title: 'Arena Details',
        items: [
          { q: 'What is the arena surface?', a: 'Artificial/false grass (football turf).' },
          { q: 'What is the arena size?', a: 'Approximately 10 m × 5 m.' },
          { q: 'What ball will be used?', a: 'Pool ball (~57 mm diameter).' },
          { q: 'Can robots leave the boundary?', a: 'No. Boundaries must not be crossed.' },
        ],
      },
      {
        title: 'Robot Specifications',
        items: [
          { q: 'What are the size constraints?', a: 'Max 30 cm × 30 cm × 20 cm.' },
          { q: 'What is the maximum weight allowed?', a: '3 kg (±5%).' },
          { q: 'Is there a budget limit?', a: '₹2000 (±5%).' },
          { q: 'Are prebuilt kits allowed?', a: 'No.' },
          { q: 'Are external mechanisms allowed?', a: 'Yes (kickers/pushers), but must not trap or damage the ball.' },
        ],
      },
      {
        title: 'Gameplay Rules',
        items: [
          { q: 'Can robots trap the ball?', a: 'No.' },
          { q: 'Is physical contact between robots allowed?', a: 'Yes (within fair play limits).' },
          { q: 'Can teams interfere manually during play?', a: 'No.' },
        ],
      },
      {
        title: 'Results & Rewards',
        items: [
          { q: 'What is the prize pool?', a: '₹10,000.' },
          { q: 'When are results announced?', a: '2:15 PM – 2:30 PM (event day).' },
        ],
      },
    ],
  },
  {
    id: 'robo-run',
    name: 'Robo Run',
    subtitle: 'Autonomous Line-Following',
    tone: 'amber',
    sections: [
      {
        title: 'Event Overview',
        items: [
          { q: 'What is Robo Run?', a: 'An autonomous robotics competition where participants design and build a robot capable of following a predefined black-line track with high precision and speed.' },
          { q: 'What is the objective?', a: 'To complete the track in the shortest possible time while maintaining accuracy and minimizing deviations.' },
          { q: 'Is this hardware-only or software + hardware?', a: 'Both. You are expected to integrate electronics, mechanical design, and programming.' },
        ],
      },
      {
        title: 'Eligibility & Team Rules',
        items: [
          { q: 'Who can participate?', a: 'Undergraduate students from any college, branch, or year.' },
          { q: 'What is the team size?', a: 'Minimum 1 and maximum 3 members.' },
          { q: 'Is individual participation allowed?', a: 'Yes (team of 1).' },
          { q: 'Are cross-college teams allowed?', a: 'Yes.' },
          { q: 'Can team members be changed after registration?', a: 'No changes allowed after confirmation.' },
        ],
      },
      {
        title: 'Registration & Qualification',
        items: [
          { q: 'What is the complete registration flow?', a: 'Register individually on Unstop → Create or join a team → Join official WhatsApp community → Upload Round 1 video.' },
          { q: 'What is Round 1 (Online Qualification)?', a: 'Teams must submit a video demonstrating basic robot movement (forward, backward, left, right) OR line-following capability.' },
          { q: 'How will submissions be evaluated?', a: 'Based on functionality, stability, and basic control logic.' },
        ],
      },
      {
        title: 'Important Dates & Timeline',
        items: [
          { q: 'What is the complete timeline?', a: '2 Apr 2026 → Registrations Open · 29 Apr → Registrations Close · 20–30 Apr → Round 1 Video Submission · 1 May → Round 1 Results · 2–4 May → RSVP Confirmation · By 5 May → Final Confirmation · Event Day: 16 May 2026.' },
          { q: 'What is the event day schedule?', a: '11:30 AM–12:00 PM Verification & Robot Inspection · 3:30–4:00 PM Arena Setup (Classroom 2B) · 4:00–5:45 PM Robo Run Competition · 5:45–6:00 PM Results & Prize Distribution.' },
        ],
      },
      {
        title: 'Arena & Track Details',
        items: [
          { q: 'What is the track format?', a: 'Black line on a white surface.' },
          { q: 'What are the approximate dimensions?', a: '~8 ft × 4 ft.' },
          { q: 'Are there sharp turns or curves?', a: 'Yes, expect turns requiring calibration and control.' },
          { q: 'Will the exact track be revealed beforehand?', a: 'No. Final track is revealed on event day.' },
        ],
      },
      {
        title: 'Robot Specifications',
        items: [
          { q: 'What are the size constraints?', a: 'Maximum 20 cm × 20 cm footprint.' },
          { q: 'What is the maximum battery voltage?', a: '18V.' },
          { q: 'What is the budget limit?', a: '₹2000 (±5%).' },
          { q: 'Are prebuilt kits allowed?', a: 'No. Robots must be self-built.' },
          { q: 'What types of sensors are allowed?', a: 'IR sensors and camera-based systems.' },
        ],
      },
      {
        title: 'Attempt Rules & Scoring',
        items: [
          { q: 'How many attempts are allowed?', a: '2 attempts per team.' },
          { q: 'What determines the winner?', a: 'Fastest completion time with minimum penalties.' },
          { q: 'What penalties apply?', a: 'Leaving track (+5 seconds), loss of control, manual interference (+10 seconds).' },
          { q: 'Is manual correction allowed during a run?', a: 'No.' },
        ],
      },
      {
        title: 'Results & Rewards',
        items: [
          { q: 'What is the prize pool?', a: '₹10,000.' },
          { q: 'When will results be announced?', a: '5:45 PM – 6:00 PM.' },
          { q: 'Will certificates be provided?', a: 'Yes (for participants/winners).' },
        ],
      },
    ],
  },
  {
    id: 'robo-race',
    name: 'Robo Race',
    subtitle: 'Obstacle Course Racing',
    tone: 'violet',
    sections: [
      {
        title: 'Event Overview',
        items: [
          { q: 'What is Robo Race?', a: 'A speed-based robotics competition where participants design and control robots to navigate through a challenging obstacle course in the shortest possible time.' },
          { q: 'What skills are evaluated?', a: 'Mechanical design & stability, control systems (manual wireless control), navigation & obstacle handling, and speed vs precision optimization.' },
          { q: 'Is this autonomous or manual?', a: 'Manual control (wireless operation required).' },
        ],
      },
      {
        title: 'Eligibility & Team Rules',
        items: [
          { q: 'Who can participate?', a: 'Undergraduate students from any college/institution.' },
          { q: 'What is the team size?', a: '2–4 members.' },
          { q: 'Is individual participation allowed?', a: 'Yes.' },
          { q: 'Are cross-college teams allowed?', a: 'Yes.' },
          { q: 'Can a participant be part of multiple teams?', a: 'No.' },
          { q: 'How many members can be near the arena during a run?', a: 'Only one member is allowed near the arena.' },
        ],
      },
      {
        title: 'Registration & Qualification',
        items: [
          { q: 'What is the registration process?', a: 'Register individually on Unstop → Create/join a team → Join WhatsApp community → Submit Round 1 video.' },
          { q: 'What is Round 1 (Online Qualification)?', a: 'Teams must upload a video demonstrating forward/backward movement, turning, and basic obstacle handling (if possible).' },
          { q: 'How are teams shortlisted?', a: 'Based on control, stability, and functionality.' },
        ],
      },
      {
        title: 'Important Dates & Timeline',
        items: [
          { q: 'What is the complete timeline?', a: '2 Apr 2026 → Registrations Open · 29 Apr → Registrations Close · 20–30 Apr → Round 1 Submission · 1 May → Round 1 Results · 2–4 May → RSVP Confirmation · By 5 May → Final Announcement · Event Day: 16 May 2026.' },
          { q: 'What is the event day schedule?', a: '10:30–11:30 AM Track Setup · 11:30 AM–12:00 PM Verification & Inspection · 2:30–4:00 PM Robo Race Event · 4:00–4:15 PM Results & Prize Distribution.' },
        ],
      },
      {
        title: 'Arena & Track Details',
        items: [
          { q: 'What does the arena consist of?', a: 'Cones, wooden planks (ramps & paths), barriers, and marbles/pebbles.' },
          { q: 'What is the approximate course size?', a: '~15 ft × 20 ft setup area, ~20 meters course length.' },
          { q: 'Will the exact track be shared before the event?', a: 'No. Final track is revealed on event day.' },
          { q: 'Can teams bypass obstacles?', a: 'No. Strictly prohibited.' },
        ],
      },
      {
        title: 'Robot Specifications',
        items: [
          { q: 'What are the size constraints?', a: 'Max 30 cm × 30 cm × 20 cm (penalty if exceeded).' },
          { q: 'What is the maximum weight allowed?', a: '3 kg (penalty if exceeded).' },
          { q: 'What type of power is allowed?', a: 'Onboard DC battery only.' },
          { q: 'What control system is required?', a: 'Wireless (Bluetooth / WiFi / RF).' },
        ],
      },
      {
        title: 'Attempt Rules & Scoring',
        items: [
          { q: 'How many runs are allowed?', a: '2 runs per team.' },
          { q: 'How is scoring calculated?', a: 'Best time out of two runs.' },
          { q: 'What happens if the robot leaves the track?', a: 'A penalty will be applied.' },
          { q: 'Can the robot be touched during the run?', a: 'No.' },
        ],
      },
      {
        title: 'Results & Rewards',
        items: [
          { q: 'What is the prize pool?', a: '₹10,000.' },
          { q: 'When will results be announced?', a: '4:00 PM – 4:15 PM (event day).' },
          { q: 'Will certificates be provided?', a: 'Yes.' },
        ],
      },
    ],
  },
  {
    id: 'rethesis',
    name: 'ReThesis',
    subtitle: 'AI Research Blitz',
    tone: 'teal',
    sections: [
      {
        title: 'Registration & Participation',
        items: [
          { q: 'How do I register and participate?', a: 'Register through Unstop → Form your team → Join the official WhatsApp group → Prepare and submit your abstract → Wait for shortlist results → If shortlisted, submit final presentation → Attend the offline finale.' },
          { q: 'Who is eligible to participate?', a: 'Open to aspiring AI researchers, developers, undergraduate and postgraduate students from any discipline with an interest in Artificial Intelligence. Technical and non-technical backgrounds are welcome.' },
          { q: 'Can participants join individually or as a team?', a: 'Yes, both individual and team participation are allowed.' },
          { q: 'Are inter-college teams allowed?', a: 'Yes.' },
          { q: 'Can multiple teams participate from the same college?', a: 'Yes, there is no restriction on the number of teams from a single college.' },
          { q: 'What type of ideas can be submitted?', a: 'AI-related research ideas, concepts, or models — including theoretical approaches, system designs, or early-stage prototypes.' },
          { q: 'Where will updates be shared?', a: 'All important communication will be shared via the official WhatsApp group.' },
        ],
      },
      {
        title: 'Round 1 – Abstract Submission',
        items: [
          { q: 'What is required in Round 1?', a: 'A well-structured research abstract explaining the problem statement, the proposed AI-based approach, and the expected impact or outcome.' },
          { q: 'Where should the abstract be submitted?', a: 'In the official WhatsApp group, following the specified format.' },
          { q: 'How will abstracts be evaluated?', a: 'Based on innovation, technical depth, clarity of presentation, and feasibility of the proposed idea.' },
        ],
      },
      {
        title: 'Shortlisting & Preparation',
        items: [
          { q: 'What should shortlisted teams do?', a: 'Prepare a comprehensive PPT explaining the problem, approach, methodology, and expected outcomes.' },
          { q: 'What are the requirements for the final round presentation?', a: 'Final presentation slides must be submitted before the specified deadline shared with shortlisted teams.' },
        ],
      },
      {
        title: 'Final Round',
        items: [
          { q: 'Where is the final round?', a: 'Offline at Scaler School of Technology, Bengaluru–560100.' },
          { q: 'When is the final round?', a: '16th May 2026 starting at 2:00 PM.' },
          { q: 'What is the presentation format?', a: 'Each team is given a strict time limit of 3 minutes to present.' },
          { q: 'When should participants arrive?', a: 'At least 1–2 hours before the event start time.' },
        ],
      },
      {
        title: 'Prizes',
        items: [
          { q: 'What are the prizes?', a: 'Winner: ₹10,000 · Runner-up: ₹6,000 · Best Social Impact: ₹4,000 · Certificates for winners and participants.' },
        ],
      },
      {
        title: 'Rules & Disqualification',
        items: [
          { q: 'What are the key rules?', a: 'Strictly follow all event guidelines including time limits, submission formats, and originality of ideas. Judges\' decisions are final.' },
          { q: 'What can lead to disqualification?', a: 'Plagiarism, missing submission deadlines, submitting incomplete or irrelevant content, exceeding time limits, or misconduct.' },
        ],
      },
    ],
  },
  {
    id: 'invariant',
    name: 'InVariant',
    subtitle: 'CP Individual Contest',
    tone: 'violet',
    sections: [
      {
        title: 'General',
        items: [
          { q: 'What is InVariant?', a: 'An individual competitive programming contest featuring carefully curated problems spanning algorithms, data structures, and mathematical thinking, organised by Scaler School of Technology under the Ascent banner.' },
          { q: 'Who can participate?', a: 'Students from all colleges across India, working professionals, and competitive programming enthusiasts. Any branch or academic background is welcome.' },
          { q: 'Is prior competitive programming experience required?', a: 'No. However, basic knowledge of C++, Java, or Python along with fundamental algorithms and data structures is recommended.' },
          { q: 'Where is the event held?', a: 'The Online Qualifier is conducted remotely. The Offline Finals are held on-campus at Scaler School of Technology, Bengaluru on 17th May.' },
          { q: 'Will accommodation and food be provided?', a: 'No, accommodation and food will not be provided. Participants are responsible for their own travel, stay, and meals.' },
        ],
      },
      {
        title: 'Format & Rounds',
        items: [
          { q: 'What are the stages of InVariant?', a: 'Round 1 (Online Qualifier): 2 hours, individual contest, on 24 Apr 2026 at 9:00 PM IST. Round 2 (Offline Finals): 3 hours, on 17 May 2026 at 09:30 AM IST, on campus.' },
          { q: 'What type of problems will be asked?', a: 'Problems cover algorithms, data structures, and mathematical thinking, crafted by experienced problem setters.' },
          { q: 'What programming languages are allowed?', a: 'C, C++, Java, and Python.' },
        ],
      },
      {
        title: 'Rules & Eligibility',
        items: [
          { q: 'Can I participate in a team?', a: 'No. InVariant is an individual contest only.' },
          { q: 'What happens if I use multiple accounts?', a: 'Multiple account usage is strictly prohibited and will result in immediate disqualification.' },
          { q: 'Can I access the internet during the contest?', a: 'Internet access is restricted to the contest platform only.' },
          { q: 'Are multiple submissions allowed?', a: 'Yes, but only the latest correct one counts.' },
          { q: 'Is there any time penalty?', a: 'Yes. Time penalties apply for wrong submissions on accepted problems (+10 minutes per wrong submission).' },
          { q: 'What leads to disqualification?', a: 'Plagiarism, code sharing, use of external/online solutions, misconduct, or multiple registrations. Getting caught results in a permanent ban from all future Ascent contests.' },
          { q: 'Are late logins allowed?', a: 'No. Please join on time.' },
        ],
      },
      {
        title: 'Registration',
        items: [
          { q: 'How do I register?', a: "Click 'Register Now' on the event page and complete your individual registration with your name, email ID, and college. You will receive a confirmation email with further instructions." },
          { q: 'What is the registration deadline?', a: '24 Apr 2026 at 8:30 PM IST — 30 minutes before the online qualifier begins.' },
          { q: 'How will I know if I qualify for the Offline Finals?', a: 'Selected participants will be notified via their registered email address.' },
        ],
      },
      {
        title: 'Key Dates',
        items: [
          { q: 'When is the Online Qualifier?', a: '24 Apr 2026, 9:00 PM IST.' },
          { q: 'When are the Offline Finals?', a: '17 May 2026, on-campus.' },
        ],
      },
    ],
  },
  {
    id: 'override',
    name: 'Override.exe',
    subtitle: 'Cybersecurity CTF',
    tone: 'teal',
    sections: [
      {
        title: 'Before the Event',
        items: [
          { q: 'What is Override.exe?', a: 'A Jeopardy-style cybersecurity CTF competition across multiple domains.' },
          { q: 'When is the event?', a: 'Online Qualifier: 26 April (1:00 PM – 5:00 PM) · Final Round: 16 May (3:00 PM – 7:00 PM).' },
          { q: 'Who can participate?', a: 'All undergraduate students.' },
          { q: 'Do I need prior experience?', a: 'Basic knowledge of programming and cybersecurity is recommended but not mandatory.' },
          { q: 'Where will updates be shared?', a: 'Email, Unstop dashboard, and WhatsApp Community.' },
          { q: 'What should I bring on the day?', a: 'Bring your laptop, charger, and pre-install any necessary tools and software.' },
        ],
      },
      {
        title: 'Team & Participation',
        items: [
          { q: 'What is the team size?', a: '1–3 members.' },
          { q: 'Can I change my team?', a: 'No. Once a team is confirmed, it cannot be changed under any circumstances.' },
          { q: 'Are cross-college teams allowed?', a: 'Yes.' },
          { q: 'Can I join multiple teams?', a: 'No.' },
        ],
      },
      {
        title: 'Event Details',
        items: [
          { q: 'How many rounds are there?', a: 'Two: Online Qualifier and Final Round.' },
          { q: 'How many teams will be shortlisted for the final round?', a: '150 participants (approx. 50 teams) will be shortlisted.' },
          { q: 'Which platform will be used?', a: 'A dedicated CTF platform. Access details will be shared before the event.' },
        ],
      },
      {
        title: 'Rules',
        items: [
          { q: 'Can we solve challenges prior to or after the event duration?', a: 'No. All challenges must be solved during the event duration.' },
          { q: 'Can we share flags between teams?', a: 'No. Sharing flags between teams is not allowed.' },
        ],
      },
      {
        title: 'Competition Structure',
        items: [
          { q: 'What challenges will be in the online qualifier?', a: 'Challenges testing basic problem-solving and cybersecurity skills.' },
          { q: 'What will be the shortlisting criteria?', a: 'Challenges solved, difficulty, and time of submission.' },
          { q: 'What is the mode of the final round?', a: 'Offline, on the campus of Scaler School of Technology.' },
          { q: 'How are winners decided?', a: 'Leaderboard ranking based on performance.' },
          { q: 'How to climb the leaderboard?', a: 'Solve challenges and submit flags to earn points. Challenges can be solved in any order.' },
        ],
      },
      {
        title: 'Disqualification',
        items: [
          { q: 'What can cause disqualification?', a: 'Plagiarism or sharing solutions between teams, exploiting the platform or infrastructure, submission of incorrect or manipulated flags, and misconduct during the event.' },
        ],
      },
      {
        title: 'Facilities',
        items: [
          { q: 'Will Wi-Fi be provided?', a: 'Yes. Wi-Fi will be available at the venue.' },
          { q: 'Will food be provided?', a: 'No. Food and refreshments will not be provided during the event.' },
        ],
      },
    ],
  },
  {
    id: 'launchpad',
    name: 'LaunchPad',
    subtitle: 'Startup Pitch Competition',
    tone: 'amber',
    sections: [
      {
        title: 'Registration & Participation',
        items: [
          { q: 'How do I register and participate?', a: 'Register on Unstop → Finalize your team (1–5 members) → Join the official WhatsApp group → Prepare your elevator pitch → Submit it before the deadline → Wait for shortlist results → If shortlisted, submit final deck → Attend the offline finale.' },
          { q: 'Who is eligible to participate?', a: 'Open to all aspiring entrepreneurs, undergraduate and postgraduate students from any discipline. Both technical and non-technical backgrounds are welcome.' },
          { q: 'What kind of ideas can be submitted?', a: 'Original startup ideas at any stage — early-stage concepts, prototype-level products, or startups with initial traction. Each must clearly define the problem, solution, target market, and potential scalability.' },
        ],
      },
      {
        title: 'Round 1 – Elevator Pitch',
        items: [
          { q: 'What is required in Round 1?', a: 'A clear and concise elevator pitch including the problem statement, proposed solution, and market fit. Additional details such as traction, prototype/demo, or revenue data can strengthen the pitch.' },
          { q: 'Where should the pitch be submitted?', a: 'In the official WhatsApp group in the required format (text or PDF).' },
          { q: 'What is the Round 1 pitch submission deadline?', a: 'April 30, 2026 (11:59 PM). Late submissions will not be accepted.' },
          { q: 'How will submissions be evaluated?', a: 'Based on innovation, clarity of idea, feasibility of execution, and scalability of the business model.' },
          { q: 'What happens after Round 1?', a: 'The top 12 teams will be shortlisted and notified via the WhatsApp group.' },
        ],
      },
      {
        title: 'Shortlisting & Deck Submission',
        items: [
          { q: 'What should shortlisted teams do?', a: 'Prepare a comprehensive presentation deck clearly explaining the startup idea, business model, market opportunity, and growth potential.' },
          { q: 'Deadline for deck submission?', a: 'May 14, 2026. This submission confirms participation in the final round.' },
        ],
      },
      {
        title: 'Final Round',
        items: [
          { q: 'Where is the final?', a: 'Offline at Scaler School of Technology, Bengaluru (560100).' },
          { q: 'When is the final?', a: 'May 16, 2026, from 1:00 PM to 5:00 PM.' },
          { q: 'What is the presentation format?', a: '4 minutes to pitch + 4 minutes Q&A with judges. A warning bell rings at 3:30, strict cutoff at 4 minutes.' },
          { q: 'When should participants arrive?', a: 'At least 1–2 hours before the scheduled start time.' },
        ],
      },
      {
        title: 'Prizes',
        items: [
          { q: 'What are the prizes?', a: 'Winner: ₹35,000 · Runner-up: ₹25,000 · Second Runner-up: ₹15,000 · Certificates of excellence for winners and participants.' },
        ],
      },
      {
        title: 'Rules & Disqualification',
        items: [
          { q: 'What are the key rules?', a: 'Strictly adhere to all guidelines, submission deadlines, format requirements, and time limits. All ideas must be original. Judges\' decisions are final.' },
          { q: 'What can lead to disqualification?', a: 'Plagiarism, copying ideas, missing deadlines, providing incomplete or misleading information, exceeding presentation time limits, or misconduct.' },
        ],
      },
    ],
  },
  {
    id: 'impulse',
    name: 'Impulse',
    subtitle: 'CP Team Contest (ICPC-style)',
    tone: 'violet',
    sections: [
      {
        title: 'General',
        items: [
          { q: 'What is Impulse?', a: 'An ICPC-style competitive programming team contest that tests teamwork, strategy, and algorithmic excellence. Teams collaborate to solve curated problems spanning algorithms, data structures, and mathematical reasoning.' },
          { q: 'What are the prizes?', a: 'Prizes worth ₹27,000. The top 10 teams win prizes.' },
          { q: 'Who can participate?', a: 'Students from all colleges across India and competitive programming enthusiasts. Any branch or academic background is welcome.' },
          { q: 'Is prior ICPC experience required?', a: 'No. However, familiarity with competitive programming and basic algorithmic concepts is recommended.' },
        ],
      },
      {
        title: 'Team & Eligibility',
        items: [
          { q: 'Can I participate alone?', a: 'No. Impulse is a team contest only. Each team must have 2 to 3 members.' },
          { q: 'Can team members be from different colleges?', a: 'Yes.' },
          { q: 'Will accommodation and food be provided?', a: 'No. Participants are responsible for their own travel, stay, and meals.' },
        ],
      },
      {
        title: 'Format & Rounds',
        items: [
          { q: 'What are the stages of Impulse?', a: 'Online Qualifier: 3 hours, ICPC-style team contest, on 30 Apr 2026 at 9:00 PM IST. Offline Finals: 5 hours, on-campus at Scaler School of Technology on 17 May 2026 at 2:00 PM IST.' },
          { q: 'What is the contest format?', a: 'ICPC-style — teams share a single computer and solve as many problems as possible. Objective is maximum problems solved in minimum time with fewer penalties.' },
          { q: 'What is the Freeze Period during Offline Finals?', a: 'From 6:00 PM to 7:00 PM, the leaderboard is frozen. Final standings are calculated after the contest ends.' },
        ],
      },
      {
        title: 'Rules & Regulations',
        items: [
          { q: 'What programming languages are allowed?', a: 'C, C++, Java, and Python.' },
          { q: 'How many computers can a team use?', a: 'Only one computer per team is allowed during the Offline Finals. ICPC-style rules apply.' },
          { q: 'Are multiple submissions allowed per problem?', a: 'Yes. Multiple submissions are allowed, but only the first correct solution counts for scoring.' },
          { q: 'Are time penalties applied?', a: 'Yes. Each wrong submission on a problem you eventually solve adds 20 minutes of penalty.' },
          { q: 'What leads to disqualification?', a: 'Plagiarism, use of online/external solutions, code sharing between teams, misconduct, or multiple registrations. Any misconduct results in a permanent ban from all future Ascent contests.' },
          { q: 'Are late logins allowed?', a: 'No. Please ensure your team joins on time.' },
        ],
      },
      {
        title: 'Balloon System (Offline Finals)',
        items: [
          { q: 'What is the balloon system?', a: 'Teams receive 1 balloon attached to their table for each problem they solve correctly.' },
          { q: 'What are the special coloured balloons?', a: '12 specially coloured balloons are awarded to the first team to solve each problem — one unique colour per problem. These are prestigious "First Solve" balloons.' },
        ],
      },
      {
        title: 'Key Dates & Requirements',
        items: [
          { q: 'When is the Online Qualifier?', a: '30 Apr 2026, 9:00 PM IST.' },
          { q: 'When are the Offline Finals?', a: '17 May 2026, 2:00 PM IST (on campus).' },
          { q: 'When should we arrive for the Offline Finals?', a: 'By 1:30 PM for seating and setup. The contest begins at 2:00 PM sharp.' },
          { q: 'What should we bring?', a: 'Your own laptop (only one per team). Test your IDE and development environment beforehand.' },
          { q: 'When will prize distribution happen?', a: '7:30 PM – 8:00 PM after the contest ends.' },
        ],
      },
    ],
  },
  {
    id: 'genesis',
    name: 'Genesis',
    subtitle: 'Build What You Wish Existed',
    tone: 'teal',
    sections: [
      {
        title: 'Participation & Eligibility',
        items: [
          { q: 'Who can participate?', a: 'Class 11–12 students from any school or coaching center.' },
          { q: 'Can beginners join?', a: 'Yes. No coding or AI experience is required.' },
          { q: 'What is the team size?', a: '2–3 members per team.' },
          { q: 'Can students from different schools form a team?', a: 'Yes, cross-school teams are allowed.' },
        ],
      },
      {
        title: 'Registration Process',
        items: [
          { q: 'Do we register individually or as a team?', a: 'First individually, then form a team.' },
          { q: 'Can we change our team later?', a: 'No. Once confirmed, teams cannot be changed.' },
          { q: 'What is the "Vibe Check" idea?', a: 'A simple idea: one everyday problem you wish an app solved.' },
          { q: 'What happens after registration?', a: 'Shortlisted teams receive a confirmation + Pre-Flight Checklist.' },
        ],
      },
      {
        title: 'Selection & Timeline',
        items: [
          { q: 'When will selected teams be announced?', a: 'By May 8, 2026.' },
          { q: 'What if we are waitlisted?', a: 'You may be invited between May 8 – May 10, 2026.' },
          { q: 'Do we need to confirm participation?', a: 'Yes, RSVP is mandatory within the given window.' },
        ],
      },
      {
        title: 'Mandatory Requirements',
        items: [
          { q: 'Is joining the WhatsApp group compulsory?', a: 'Yes. Not joining = disqualification.' },
          { q: 'Is the participation form mandatory?', a: 'Yes, must be submitted before the deadline.' },
          { q: 'Do we need to create AI tool accounts before the event?', a: 'Yes. This is mandatory.' },
        ],
      },
      {
        title: 'Event Format',
        items: [
          { q: 'What happens on event day?', a: 'Live AI demo, 3-hour build sprint, and final prototype demo.' },
          { q: 'How long is the event?', a: '8 hours total.' },
          { q: 'What do we have to build?', a: 'An app based on: "What is something you wish existed?"' },
        ],
      },
      {
        title: 'Tools & Building',
        items: [
          { q: 'Can we use AI tools?', a: 'Yes. Tools like v0.dev, Claude, and WebSim are encouraged.' },
          { q: 'Do we need to code?', a: 'No. You can build using AI tools.' },
          { q: 'Can we use pre-built projects?', a: 'No. Everything must be built during the event.' },
        ],
      },
      {
        title: 'Presentation & Judging',
        items: [
          { q: 'What is the final presentation format?', a: '2-minute live demo only (no slides allowed).' },
          { q: 'What are the judging criteria?', a: 'Creativity, technical implementation, impact/wow factor, and presentation.' },
        ],
      },
      {
        title: 'Rules & Logistics',
        items: [
          { q: 'What should we bring?', a: 'Laptop + charger, notebook (optional), and school ID.' },
          { q: 'Will internet be provided?', a: 'Yes.' },
          { q: 'Is full attendance required?', a: 'Yes, you must stay for the entire event.' },
          { q: 'What leads to disqualification?', a: 'Pre-built projects, plagiarism, misconduct, not joining WhatsApp group, or ignoring mandatory steps.' },
        ],
      },
    ],
  },
  {
    id: 'ship-to-scale',
    name: 'Ship to Scale',
    subtitle: 'Build-Break-Bank',
    tone: 'amber',
    sections: [
      {
        title: 'General Information',
        items: [
          { q: 'What is Ship to Scale?', a: 'A fast-paced, full-day product development challenge at Ascent 2026. Teams rapidly design, build, and pitch a working prototype within a single day, simulating a real startup build-and-launch cycle: Idea → Validate → Build → Refine → Pitch.' },
          { q: 'When and where is the event?', a: 'Grand Finale on May 17, 2026, at Scaler School of Technology campus.' },
          { q: 'How long is the event?', a: '9:00 AM to 7:00 PM IST, covering orientation, idea validation, full build sprint, mentor feedback, pitch preparation, demo presentations, judging, and result announcement.' },
          { q: 'Who is eligible to participate?', a: 'All students and individuals who have been shortlisted through the Round 1 Profile Submission and confirmed participation via RSVP.' },
          { q: 'What is the team size?', a: '2 to 4 members. Solo participation is not allowed.' },
        ],
      },
      {
        title: 'Registration & RSVP',
        items: [
          { q: 'How do I register for Ship to Scale?', a: 'Registration is open on Unstop from April 22, 2026 (5:00 PM IST) to April 28, 2026 (11:59 PM IST). After registering, join the official WhatsApp community to receive the Round 1 submission form.' },
          { q: 'What is the full pre-event timeline?', a: 'Registration: Apr 22–28 · Round 1 Profile Submission: Apr 23–29 · Profile Shortlisting: Apr 30 – May 1 · Result Announcement: May 2 · RSVP-1: May 2–3 · RSVP-2: May 4–5 · Final Announcement: May 5 · Grand Finale: May 17, 2026.' },
          { q: 'Is registration on Unstop enough?', a: 'No. Both Unstop registration and completing RSVP-1 and RSVP-2 are mandatory. Your spot is only confirmed after completing both.' },
          { q: 'What happens if I miss the RSVP windows?', a: 'Missing RSVP-1 (May 2–3) or RSVP-2 (May 4–5) will result in your selection being cancelled and your slot released to other registrants.' },
        ],
      },
      {
        title: 'Round 1 – Profile Submission',
        items: [
          { q: 'What do I need to submit in Round 1?', a: 'Your GitHub profile, LinkedIn profile, and a short description of your initial product idea (50–100 words). The submission form will be shared in the WhatsApp group.' },
          { q: 'Can my product idea change between Round 1 and the Grand Finale?', a: 'No. Your product idea is a primary criterion for shortlisting. Minor refinements are natural, but significantly deviating from your submitted concept is not permitted.' },
          { q: 'How will I know if I have been shortlisted?', a: 'Shortlisted candidates will be announced on May 2, 2026, via WhatsApp notification.' },
        ],
      },
      {
        title: 'Event Format & Rules',
        items: [
          { q: 'What is the format of the Grand Finale?', a: 'Opening & Orientation (9:00–9:30) → Idea Validation with Mentors (9:30–10:00) → Build Sprint Phase 1 (10:00–1:00 PM) → Lunch Break (1:00–2:00) → Build Sprint Phase 2 (2:00–4:00) → Mentor Feedback (4:00–4:30) → Pitch Prep (4:30–5:00) → Pitches & Demos (5:00–6:30) → Judging (6:30–6:50) → Result Announcement (6:50–7:00).' },
          { q: 'What is the pitch format?', a: 'Each team gets 6 minutes total: 3 minutes for the product pitch and live demo, followed by 3 minutes of Q&A from judges.' },
          { q: 'Are teams allowed to use open-source frameworks?', a: 'Yes. Using publicly available open-source libraries, frameworks, and APIs is permitted. The core product logic must be built during the event.' },
        ],
      },
      {
        title: 'Judging & Evaluation',
        items: [
          { q: 'What are the judging criteria?', a: 'Innovation, Technical Execution, Product Feasibility, User Experience, and Demo & Presentation.' },
          { q: 'Is a working prototype mandatory?', a: 'Yes. A concept-only pitch without a functional demonstration will score significantly lower across multiple evaluation parameters.' },
          { q: 'What counts as a "working prototype"?', a: 'A functional product that demonstrates at least the core feature your solution is built around. It does not need to be production-ready or feature-complete.' },
        ],
      },
      {
        title: 'Logistics & Requirements',
        items: [
          { q: 'What should I bring?', a: 'Your personal laptop (mandatory), all necessary development tools pre-installed, charger, and any accessories needed.' },
          { q: 'Will WiFi be available?', a: 'Yes, WiFi will be provided on-site.' },
          { q: 'Will food be provided?', a: 'Yes. Lunch will be provided during the Lunch Break (1:00–2:00 PM), along with refreshments.' },
          { q: 'Is accommodation provided?', a: 'No. All participants must independently arrange their travel and stay.' },
        ],
      },
      {
        title: 'Prizes & Incentives',
        items: [
          { q: 'What do the winning teams receive?', a: 'In addition to their titles, winning teams receive Direct Interview Opportunities with leading VC Ventures.' },
          { q: 'When are the winners announced?', a: '6:50 PM – 7:00 PM on May 17, 2026.' },
        ],
      },
      {
        title: 'Disqualification & Policies',
        items: [
          { q: 'What actions will lead to disqualification?', a: 'Submitting a pre-built or plagiarised project, using another team\'s code without attribution, presenting a non-functional prototype, violating event conduct guidelines, or failing to present without prior notice.' },
        ],
      },
    ],
  },
  {
    id: 'anvil',
    name: 'Anvil Hackathon',
    subtitle: '24-Hour Hackathon',
    tone: 'violet',
    sections: [
      {
        title: 'Before the Event',
        items: [
          { q: 'What should I bring on the day?', a: 'Bring your laptop, charger, all required software pre-installed, and any accessories your project might need. Do not rely on setting up tools at the venue.' },
          { q: 'Will accommodation be provided?', a: 'No. Participants must arrange their own stay.' },
          { q: 'When will the problem statements be revealed?', a: 'Problem statements will be released on the day of the hackathon to all confirmed participants.' },
        ],
      },
      {
        title: 'Team & Participation',
        items: [
          { q: 'Can I change my team members?', a: 'No. Once a team is confirmed, it cannot be changed under any circumstances.' },
          { q: 'Can I join more than one team?', a: 'No. Each participant can only be part of one team.' },
          { q: 'What if a team member drops out during the hackathon?', a: 'Your team must continue with the remaining members.' },
          { q: 'Can we change our project idea after the hackathon starts?', a: 'Yes. You can iterate or pivot your idea during the 24 hours. Just ensure the final submission is fully built within the hackathon window.' },
        ],
      },
      {
        title: 'Rules & Development',
        items: [
          { q: 'Can we use external libraries, frameworks, or APIs?', a: 'Yes. However, all core logic and product must be built during the event.' },
          { q: 'Can we leave the venue during the hackathon?', a: 'No. Participants are required to remain on campus for the full 24-hour duration.' },
        ],
      },
      {
        title: 'Mentors & Support',
        items: [
          { q: 'Will mentors be available?', a: 'Yes. Mentors will visit the venue twice during the hackathon to help with debugging, system architecture, API integrations, and product direction.' },
        ],
      },
      {
        title: 'Facilities',
        items: [
          { q: 'Will Wi-Fi be provided?', a: 'Yes. Wi-Fi will be available at the venue.' },
          { q: 'Will food be provided?', a: 'Yes. Food and refreshments will be arranged throughout the event.' },
        ],
      },
      {
        title: 'Submission',
        items: [
          { q: 'What do we need to submit?', a: 'GitHub repository link, deployed link, and a demo video.' },
          { q: 'What is the submission deadline?', a: '10:00 AM on 16th May. Late submissions will not be accepted — no exceptions.' },
          { q: 'What if our project is not fully complete?', a: 'You must present a working prototype. It is better to submit a smaller working feature than a broken full product.' },
        ],
      },
      {
        title: 'Judging',
        items: [
          { q: 'How will our project be judged?', a: 'Based on: Innovation and originality, Technical complexity, Feasibility, Impact and usefulness, and Demo and presentation quality.' },
          { q: 'How does the judging round work?', a: 'Judges visit each team between 11:00 AM and 2:00 PM on 16th May. You get 3 minutes to demo and 2 minutes for Q&A.' },
        ],
      },
      {
        title: 'Prizes & Awards',
        items: [
          { q: 'What are the top prizes?', a: 'Winner: ₹20,000 · Runner-Up: ₹12,000 · Second Runner-Up: ₹8,000.' },
          { q: 'Are there special category awards?', a: 'Yes — Most Innovative Idea (₹3,000), Best UI/UX (₹2,500), Best Social Impact (₹2,500), Best Use of Sponsor Technology (₹2,000).' },
          { q: 'Can we win both a podium prize and a special award?', a: 'No. Podium winners (top 3) are not eligible for special category awards.' },
          { q: 'Will certificates be provided?', a: 'Yes. All participants will receive e-certificates.' },
        ],
      },
      {
        title: 'Results',
        items: [
          { q: 'When will results be announced?', a: 'During the closing ceremony on 16th May, after the judging round concludes.' },
        ],
      },
    ],
  },
];

// ─── Accordion Item ──────────────────────────────────────────────────────────

function AccordionItem({ q, a, isOpen, onToggle, tone }) {
  const accentColor = tone === 'teal' ? 'var(--teal)' : tone === 'amber' ? 'var(--amber)' : 'var(--violet)';
  return (
    <div
      style={{
        borderBottom: '1px solid var(--glass-border)',
        transition: 'background .2s',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--ink)',
        }}
      >
        <span style={{
          fontFamily: 'var(--f-body)',
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.5,
          color: isOpen ? 'var(--ink)' : 'var(--ink-dim)',
          transition: 'color .2s',
          flex: 1,
        }}>
          {q}
        </span>
        <span style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: `1px solid ${isOpen ? accentColor : 'var(--glass-border-strong)'}`,
          display: 'grid',
          placeItems: 'center',
          color: isOpen ? accentColor : 'var(--ink-mute)',
          fontSize: 14,
          lineHeight: 1,
          transition: 'all .25s',
          transform: isOpen ? 'rotate(45deg)' : 'none',
          marginTop: 1,
        }}>
          +
        </span>
      </button>
      <div style={{
        overflow: 'hidden',
        maxHeight: isOpen ? 600 : 0,
        opacity: isOpen ? 1 : 0,
        transition: 'max-height .35s cubic-bezier(.4,0,.2,1), opacity .3s ease',
      }}>
        <div style={{
          paddingBottom: 20,
          fontSize: 13.5,
          lineHeight: 1.75,
          color: 'var(--ink-dim)',
          fontFamily: 'var(--f-body)',
        }}>
          {a}
        </div>
      </div>
    </div>
  );
}

// ─── Section Group ───────────────────────────────────────────────────────────

function SectionGroup({ section, openSet, setOpenSet, eventId, tone }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontFamily: 'var(--f-mono)',
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--ink-mute)',
        marginBottom: 4,
        marginTop: 28,
      }}>
        {section.title}
      </div>
      {section.items.map((item, idx) => {
        const key = `${eventId}__${section.title}__${idx}`;
        return (
          <AccordionItem
            key={key}
            q={item.q}
            a={item.a}
            tone={tone}
            isOpen={openSet.has(key)}
            onToggle={() =>
              setOpenSet(prev => {
                const next = new Set(prev);
                next.has(key) ? next.delete(key) : next.add(key);
                return next;
              })
            }
          />
        );
      })}
    </div>
  );
}

// ─── Main FAQ Component ──────────────────────────────────────────────────────

export default function FAQ() {
  const isMobile = useMobile();
  const [activeEvent, setActiveEvent] = useState('all');
  const [search, setSearch] = useState('');
  const [openSet, setOpenSet] = useState(new Set());

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();

    const events = activeEvent === 'all'
      ? FAQ_DATA
      : FAQ_DATA.filter(e => e.id === activeEvent);

    if (!q) return events;

    return events
      .map(ev => ({
        ...ev,
        sections: ev.sections
          .map(sec => ({
            ...sec,
            items: sec.items.filter(
              item =>
                item.q.toLowerCase().includes(q) ||
                item.a.toLowerCase().includes(q)
            ),
          }))
          .filter(sec => sec.items.length > 0),
      }))
      .filter(ev => ev.sections.length > 0);
  }, [activeEvent, search]);

  const totalResults = useMemo(
    () => filteredData.reduce((acc, ev) => acc + ev.sections.reduce((s, sec) => s + sec.items.length, 0), 0),
    [filteredData]
  );

  const expandAll = () => {
    const keys = new Set();
    filteredData.forEach(ev =>
      ev.sections.forEach((sec, _) =>
        sec.items.forEach((_, idx) => {
          keys.add(`${ev.id}__${sec.title}__${idx}`);
        })
      )
    );
    setOpenSet(keys);
  };

  const collapseAll = () => setOpenSet(new Set());

  return (
    <PageBackground>
      <NavBar variant="public" active="faq" />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '32px 16px 80px' : '56px 28px 100px' }}>

        {/* Header */}
        <div className="eyebrow" style={{ marginBottom: 16 }}>§ PARTICIPANT FAQ · ASCENT 2026</div>
        <h1 className="display" style={{
          fontSize: isMobile ? 42 : 72,
          letterSpacing: '-0.03em',
          lineHeight: 0.92,
          marginBottom: 20,
        }}>
          Got<br />
          <span style={{ color: 'var(--violet)' }}>questions?</span>
        </h1>
        <p style={{
          fontSize: 14,
          color: 'var(--ink-dim)',
          lineHeight: 1.7,
          maxWidth: 480,
          marginBottom: 0,
        }}>
          Everything you need to know about every event at ASCENT TechFest 2026.
          Can't find your answer? Email{' '}
          <a href="mailto:archived-559b490477@example.invalid" style={{ color: 'var(--violet)', textDecoration: 'none' }}>
            archived-559b490477@example.invalid
          </a>
        </p>

        {/* Search */}
        <div style={{
          marginTop: 36,
          position: 'relative',
        }}>
          <svg
            style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--ink-mute)', pointerEvents: 'none',
            }}
            width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="input"
            placeholder="Search questions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 40, fontSize: 14 }}
          />
        </div>

        {/* Event Filter Tabs */}
        <div style={{
          marginTop: 24,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          padding: 4,
          borderRadius: 14,
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid var(--glass-border)',
        }}>
          {[{ id: 'all', name: 'All Events', tone: null }, ...FAQ_DATA].map(ev => {
            const isActive = activeEvent === ev.id;
            const toneClass = ev.tone || 'violet';
            const accentBg = {
              violet: 'rgba(127,119,221,0.2)',
              teal: 'rgba(29,158,117,0.2)',
              amber: 'rgba(232,185,116,0.2)',
            }[toneClass];
            const accentBorder = {
              violet: 'rgba(127,119,221,0.5)',
              teal: 'rgba(29,158,117,0.5)',
              amber: 'rgba(232,185,116,0.5)',
            }[toneClass];
            return (
              <button
                key={ev.id}
                onClick={() => { setActiveEvent(ev.id); setOpenSet(new Set()); }}
                style={{
                  padding: isMobile ? '7px 12px' : '8px 16px',
                  borderRadius: 10,
                  border: isActive ? `1px solid ${accentBorder}` : '1px solid transparent',
                  background: isActive ? accentBg : 'transparent',
                  color: isActive ? 'var(--ink)' : 'var(--ink-dim)',
                  fontSize: isMobile ? 11.5 : 12.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all .2s',
                  fontFamily: 'var(--f-body)',
                  whiteSpace: 'nowrap',
                }}
              >
                {ev.name}
              </button>
            );
          })}
        </div>

        {/* Meta bar */}
        <div style={{
          marginTop: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}>
          <div style={{
            fontFamily: 'var(--f-mono)',
            fontSize: 10.5,
            color: 'var(--ink-mute)',
            letterSpacing: '0.1em',
          }}>
            {search
              ? `${totalResults} RESULT${totalResults !== 1 ? 'S' : ''} FOR "${search.toUpperCase()}"`
              : `${totalResults} QUESTIONS ACROSS ${filteredData.length} EVENT${filteredData.length !== 1 ? 'S' : ''}`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={expandAll}
              className="btn sm ghost"
              style={{ fontSize: 11, padding: '6px 12px' }}
            >
              Expand all
            </button>
            <button
              onClick={collapseAll}
              className="btn sm ghost"
              style={{ fontSize: 11, padding: '6px 12px' }}
            >
              Collapse all
            </button>
          </div>
        </div>

        {/* No results */}
        {filteredData.length === 0 && (
          <div style={{
            marginTop: 60,
            textAlign: 'center',
            color: 'var(--ink-mute)',
            fontFamily: 'var(--f-mono)',
            fontSize: 13,
            letterSpacing: '0.06em',
          }}>
            NO MATCHES FOR "{search.toUpperCase()}"
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-faint)' }}>
              Try a different keyword or email us at archived-559b490477@example.invalid
            </div>
          </div>
        )}

        {/* FAQ Content */}
        <div style={{ marginTop: 12 }}>
          {filteredData.map((ev, evIdx) => {
            const accentColor = ev.tone === 'teal' ? 'var(--teal)' : ev.tone === 'amber' ? 'var(--amber)' : 'var(--violet)';
            return (
              <div
                key={ev.id}
                className="glass"
                style={{
                  marginTop: 24,
                  padding: isMobile ? '20px 20px' : '28px 32px',
                  animation: 'fadeUp .6s cubic-bezier(.2,.8,.2,1) both',
                  animationDelay: `${evIdx * 60}ms`,
                }}
              >
                {/* Event header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 4,
                  flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h2 style={{
                        fontFamily: 'var(--f-display)',
                        fontSize: isMobile ? 20 : 24,
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        margin: 0,
                        color: 'var(--ink)',
                      }}>
                        {ev.name}
                      </h2>
                      <span className={`chip ${ev.tone}`} style={{ fontSize: 9.5 }}>
                        {ev.subtitle}
                      </span>
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'var(--f-mono)',
                    fontSize: 10,
                    color: 'var(--ink-mute)',
                    letterSpacing: '0.1em',
                    paddingTop: 4,
                  }}>
                    {ev.sections.reduce((s, sec) => s + sec.items.length, 0)} Q&As
                  </div>
                </div>

                <div style={{ width: 32, height: 2, background: accentColor, borderRadius: 2, marginBottom: 2, opacity: 0.7 }} />

                {/* Sections */}
                {ev.sections.map((sec, secIdx) => (
                  <SectionGroup
                    key={secIdx}
                    section={sec}
                    openSet={openSet}
                    setOpenSet={setOpenSet}
                    eventId={ev.id}
                    tone={ev.tone}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        {filteredData.length > 0 && (
          <div className="glass" style={{
            marginTop: 32,
            padding: isMobile ? '24px 20px' : '32px 40px',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--f-display)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Still have questions?
            </div>
            <div style={{ color: 'var(--ink-dim)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              Our team is happy to help. Reach out before the event and we'll get back to you quickly.
            </div>
            <a
              href="mailto:archived-559b490477@example.invalid"
              className="btn primary"
              style={{ display: 'inline-flex' }}
            >
              archived-559b490477@example.invalid ↗
            </a>
          </div>
        )}
      </div>

      <Footer />
    </PageBackground>
  );
}
