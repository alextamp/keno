import { Either } from '@/core/utils/either';
import { Failure } from '@/core/errors/failures';
import { UserEntity } from '../entities/user.entity';

export interface SignUpParams {
  name: string;
  email: string;
  password: string;
  universityName: string;
  department: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface AuthRepository {
  signUp(params: SignUpParams): Promise<Either<Failure, UserEntity>>;
  signIn(params: SignInParams): Promise<Either<Failure, UserEntity>>;
  signOut(): Promise<Either<Failure, void>>;
  sendEmailVerification(): Promise<Either<Failure, void>>;
  reloadUser(): Promise<Either<Failure, void>>;
  fetchCurrentUser(userId: string): Promise<Either<Failure, UserEntity>>;
  isEmailVerified(): boolean;
  getCurrentUserId(): string | null;
  onAuthStateChanged(callback: (userId: string | null) => void): () => void;
}
