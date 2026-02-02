
export type OpportunityType = 'Internship' | 'Hackathon' | 'Workshop' | 'Competition' | 'Full-time' | 'Other';

export type UserRole = 'student' | 'event_manager' | 'alumni' | 'management';

export type ApplicationStatus = 'Pending' | 'Applied' | 'Shortlisted' | 'Rejected' | 'Selected';

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface Opportunity {
  id: string;
  title: string;
  company: string;
  type: OpportunityType;
  source?: string;
  matchMethod?: 'groq' | 'base' | 'direct' | string;
  deadline: string;
  description: string;
  tags: string[];
  location: string;
  postedDate: string;
  eligibility: string;
  requirements: string[];
  sourceUrl?: string;
  groundingChunks?: GroundingChunk[];
}

export interface CrawlMeta {
  groqEnabled: boolean;
  groqUsed: boolean;
  webSearchEnabled?: boolean;
  webSearchProvider?: string | null;
  webSearchUsed?: boolean;
  webSearchError?: string | null;
}

export interface Interview {
  id: string;
  opportunityId: string;
  date: string;
  time: string;
  type: 'Technical' | 'HR' | 'Group Discussion';
  link?: string;
  status: 'Upcoming' | 'Completed' | 'Cancelled';
}

export interface Application {
  id: string;
  opportunityId: string;
  studentId: string;
  appliedDate: string;
  status: ApplicationStatus;
  notes?: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  department: string;
  email: string;
  skills: string[];

  // Extended profile fields (optional)
  roll_number?: string;
  dob?: string;
  personal_email?: string;
  phone_number?: string;
  cgpa?: number;
  arrears_history?: number;
  interests?: string[];
  achievements?: string[];
  blogs?: string[];
  linkedin_url?: string;
  github_url?: string;
  leetcode_url?: string;
  portfolio_url?: string;
  projects?: Array<{ title: string; description: string; link?: string }>;
  resume?: {
    originalName: string;
    storedName: string;
    contentType: string;
    size: number;
    uploadedAt: string;
    url: string;
  };
}
