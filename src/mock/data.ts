import { UserEntity } from '@/features/auth/domain/entities/user.entity';
import { EventCategory, EventEntity } from '@/features/events/domain/entities/event.entity';

export const MOCK_USER: UserEntity = {
  id: 'mock-user-1',
  name: 'Alex Tampas',
  universityEmail: 'alextamp@aueb.gr',
  universityName: 'Athens University of Economics and Business',
  department: 'Informatics',
  joinedEvents: ['event-1', 'event-3'],
  createdEvents: ['event-1'],
  bio: 'Informatics student @ AUEB. Into basketball, coffee, and late-night study sessions ☕',
  avatarColor: '#F26522',
};

export const MOCK_USER_REGISTRY: Record<string, { name: string; avatarColor: string; university: string; photoUri?: string }> = {
  'mock-user-1': { name: 'Alex Tampas', avatarColor: '#F26522', university: 'AUEB' },
  'mock-user-2': { name: 'Maria Papadaki', avatarColor: '#7C3AED', university: 'NTUA' },
  'mock-user-3': { name: 'Nikos Stavros', avatarColor: '#059669', university: 'AUEB' },
  'mock-user-4': { name: 'Elena Christou', avatarColor: '#DB2777', university: 'UOA' },
  'mock-user-5': { name: 'Kostas Dimitriou', avatarColor: '#2563EB', university: 'AUEB' },
  'mock-user-6': { name: 'Sofia Andreou', avatarColor: '#D97706', university: 'UOA' },
  'mock-user-7': { name: 'Giorgos Petrakis', avatarColor: '#0891B2', university: 'NTUA' },
  'mock-user-8': { name: 'Anna Nikolaou', avatarColor: '#DC2626', university: 'AUEB' },
  'mock-user-9': { name: 'Thanasis Vlachos', avatarColor: '#7C3AED', university: 'UOA' },
};

const now = new Date();
const h = (hours: number) => new Date(now.getTime() + hours * 3600000);

export const MOCK_EVENTS: EventEntity[] = [
  {
    id: 'event-1',
    title: 'Basketball at the courts',
    description: 'Quick 3v3 game before afternoon lectures. All levels welcome, just bring energy.',
    category: EventCategory.Sports,
    dateTime: h(2),
    location: 'AUEB Sports Courts, Patision',
    creatorId: 'mock-user-1',
    maxAttendees: 6,
    attendeeIds: ['mock-user-1', 'mock-user-2', 'mock-user-3'],
    genderFilter: 'any',
    minAge: 18,
  },
  {
    id: 'event-2',
    title: 'Econometrics study group',
    description: 'Going through problem sets 4 & 5 together. Bring your notes and laptop.',
    category: EventCategory.Study,
    dateTime: h(4),
    location: 'Library 2nd floor, quiet zone',
    creatorId: 'mock-user-2',
    maxAttendees: 5,
    attendeeIds: ['mock-user-2', 'mock-user-4'],
    allowedUniversities: ['AUEB', 'NTUA'],
  },
  {
    id: 'event-3',
    title: 'Coffee & chill after exams',
    description: 'Finally done with midterms. Grabbing coffee at the cafeteria, come decompress.',
    category: EventCategory.Coffee,
    dateTime: h(1),
    location: 'Campus Cafeteria',
    creatorId: 'mock-user-3',
    maxAttendees: 8,
    attendeeIds: ['mock-user-3', 'mock-user-1', 'mock-user-5', 'mock-user-6'],
  },
  {
    id: 'event-4',
    title: 'End of semester rooftop party',
    description: "Semester is OVER. Rooftop at Nikos's place, bring something to drink 🎉",
    category: EventCategory.Party,
    dateTime: h(8),
    location: 'Exarcheia, ask for address',
    creatorId: 'mock-user-4',
    maxAttendees: 20,
    attendeeIds: ['mock-user-4', 'mock-user-2', 'mock-user-7'],
    minAge: 20,
    genderFilter: 'any',
  },
  {
    id: 'event-5',
    title: 'Frisbee in Pedion tou Areos',
    description: 'Casual frisbee session in the park. No experience needed at all.',
    category: EventCategory.Sports,
    dateTime: h(3),
    location: 'Pedion tou Areos Park',
    creatorId: 'mock-user-5',
    maxAttendees: 10,
    attendeeIds: ['mock-user-5', 'mock-user-8', 'mock-user-9'],
  },
  {
    id: 'event-6',
    title: 'Board games afternoon',
    description: 'Catan, Codenames, whatever you bring. 2-3 hours of good vibes.',
    category: EventCategory.Chill,
    dateTime: h(5),
    location: 'Student common room, building B',
    creatorId: 'mock-user-6',
    maxAttendees: 8,
    attendeeIds: ['mock-user-6'],
  },
];
