import { DocumentData, DocumentSnapshot, serverTimestamp } from 'firebase/firestore';
import { UserEntity } from '../../domain/entities/user.entity';

export type UserModel = UserEntity;

export function userFromFirestore(doc: DocumentSnapshot<DocumentData>): UserModel {
  const data = doc.data()!;
  return {
    id: doc.id,
    name: data.name as string,
    universityEmail: data.universityEmail as string,
    universityName: data.universityName as string,
    department: data.department as string,
    joinedEvents: (data.joinedEvents as string[]) ?? [],
    createdEvents: (data.createdEvents as string[]) ?? [],
  };
}

export function userToFirestore(
  user: Omit<UserModel, 'id'>,
): DocumentData & { createdAt: ReturnType<typeof serverTimestamp> } {
  return {
    name: user.name,
    universityEmail: user.universityEmail,
    universityName: user.universityName,
    department: user.department,
    joinedEvents: user.joinedEvents,
    createdEvents: user.createdEvents,
    createdAt: serverTimestamp(),
  };
}
