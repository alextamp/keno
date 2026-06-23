export interface UserEntity {
  id: string;
  name: string;
  universityEmail: string;
  universityName: string;
  department: string;
  joinedEvents: string[];
  createdEvents: string[];
  bio?: string;
  avatarColor?: string;
  photoUri?: string;
}
