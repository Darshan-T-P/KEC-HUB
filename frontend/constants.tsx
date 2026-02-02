
import { Opportunity, User, Application, Interview } from './types';

export const MOCK_USER: User = {
  id: 'u1',
  name: 'John Doe',
  role: 'student',
  department: 'Computer Science',
  email: 'john.doe@kec.ac.in',
  skills: ['React', 'TypeScript', 'Tailwind', 'Python', 'AI/ML']
};

export const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: 'o1',
    title: 'Summer Internship - Frontend Developer',
    company: 'TechCorp Solutions',
    type: 'Internship',
    deadline: '2024-08-30',
    postedDate: '2024-05-15',
    location: 'Remote/Chennai',
    description: 'Looking for a passionate frontend developer intern to work on cutting-edge React applications.',
    eligibility: '3rd year B.E./B.Tech Students',
    tags: ['React', 'Frontend', 'Remote'],
    requirements: ['Proficiency in React', 'Knowledge of CSS/Tailwind']
  },
  {
    id: 'o2',
    title: 'Smart India Hackathon 2024',
    company: 'MHRD, Government of India',
    type: 'Hackathon',
    deadline: '2024-09-15',
    postedDate: '2024-05-10',
    location: 'National Level',
    description: 'The world\'s biggest open innovation model.',
    eligibility: 'All college students',
    tags: ['Innovation', 'Coding'],
    requirements: ['Team of 6 students']
  }
];

export const MOCK_APPLICATIONS: Application[] = [
  {
    id: 'a1',
    opportunityId: 'o1',
    studentId: 'u1',
    appliedDate: '2024-05-16',
    status: 'Shortlisted'
  }
];

export const MOCK_INTERVIEWS: Interview[] = [
  {
    id: 'i1',
    opportunityId: 'o1',
    date: '2024-06-25',
    time: '14:00',
    type: 'Technical',
    status: 'Upcoming',
    link: 'https://meet.google.com/abc-defg-hij'
  }
];
