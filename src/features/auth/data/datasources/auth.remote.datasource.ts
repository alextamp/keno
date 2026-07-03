import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { EmailNotVerifiedFailure } from '@/core/errors/failures';
import { UserModel, userFromFirestore, userToFirestore } from '../models/user.model';

export interface SignUpData {
  name: string;
  email: string;
  password: string;
  universityName: string;
  department: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export const authRemoteDataSource = {
  async signUp({ name, email, password, universityName, department }: SignUpData): Promise<UserModel> {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = credential.user;

    await sendEmailVerification(firebaseUser);

    const user: UserModel = {
      id: firebaseUser.uid,
      name,
      universityEmail: email,
      universityName,
      department,
      joinedEvents: [],
      createdEvents: [],
      following: [],
      followers: [],
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), userToFirestore(user));
    return user;
  },

  async signIn({ email, password }: SignInData): Promise<UserModel> {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = credential.user;

    if (!firebaseUser.emailVerified) {
      await signOut(auth);
      throw new EmailNotVerifiedFailure();
    }

    const snapshot = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (!snapshot.exists()) throw new Error('User profile not found in Firestore.');
    return userFromFirestore(snapshot);
  },

  async fetchUser(userId: string): Promise<UserModel | null> {
    const snapshot = await getDoc(doc(db, 'users', userId));
    if (!snapshot.exists()) return null;
    return userFromFirestore(snapshot);
  },

  async signOut(): Promise<void> {
    await signOut(auth);
  },

  async sendEmailVerification(): Promise<void> {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  },

  async reloadUser(): Promise<void> {
    await auth.currentUser?.reload();
  },

  isEmailVerified(): boolean {
    return auth.currentUser?.emailVerified ?? false;
  },

  getCurrentUserId(): string | null {
    return auth.currentUser?.uid ?? null;
  },

  onAuthStateChanged(callback: (userId: string | null) => void): () => void {
    return onAuthStateChanged(auth, (user) => callback(user?.uid ?? null));
  },
};
