import { FirebaseError } from 'firebase/app';
import {
  AuthFailure,
  EmailNotVerifiedFailure,
  Failure,
  InvalidEmailFailure,
  ServerFailure,
} from '@/core/errors/failures';
import { Either, left, right } from '@/core/utils/either';
import { validateUniversityEmail } from '@/core/utils/validators';
import { UserEntity } from '../../domain/entities/user.entity';
import {
  AuthRepository,
  SignInParams,
  SignUpParams,
} from '../../domain/repositories/auth.repository';
import { authRemoteDataSource } from '../datasources/auth.remote.datasource';

export class AuthRepositoryImpl implements AuthRepository {
  async signUp(params: SignUpParams): Promise<Either<Failure, UserEntity>> {
    const emailCheck = validateUniversityEmail(params.email);
    if (!emailCheck.isValid) {
      return left(new InvalidEmailFailure(emailCheck.errorMessage!));
    }
    try {
      const user = await authRemoteDataSource.signUp(params);
      return right(user);
    } catch (e) {
      return left(this.mapError(e));
    }
  }

  async signIn(params: SignInParams): Promise<Either<Failure, UserEntity>> {
    try {
      const user = await authRemoteDataSource.signIn(params);
      return right(user);
    } catch (e) {
      if (e instanceof EmailNotVerifiedFailure) return left(e);
      return left(this.mapError(e));
    }
  }

  async fetchCurrentUser(userId: string): Promise<Either<Failure, UserEntity>> {
    try {
      const user = await authRemoteDataSource.fetchUser(userId);
      if (!user) return left(new ServerFailure('User profile not found.'));
      return right(user);
    } catch (e) {
      return left(this.mapError(e));
    }
  }

  async signOut(): Promise<Either<Failure, void>> {
    try {
      await authRemoteDataSource.signOut();
      return right(undefined);
    } catch (e) {
      return left(this.mapError(e));
    }
  }

  async sendEmailVerification(): Promise<Either<Failure, void>> {
    try {
      await authRemoteDataSource.sendEmailVerification();
      return right(undefined);
    } catch (e) {
      return left(this.mapError(e));
    }
  }

  async reloadUser(): Promise<Either<Failure, void>> {
    try {
      await authRemoteDataSource.reloadUser();
      return right(undefined);
    } catch (e) {
      return left(this.mapError(e));
    }
  }

  isEmailVerified(): boolean {
    return authRemoteDataSource.isEmailVerified();
  }

  getCurrentUserId(): string | null {
    return authRemoteDataSource.getCurrentUserId();
  }

  onAuthStateChanged(callback: (userId: string | null) => void): () => void {
    return authRemoteDataSource.onAuthStateChanged(callback);
  }

  private mapError(e: unknown): Failure {
    if (e instanceof Failure) return e;
    if (e instanceof FirebaseError) {
      const message =
        FIREBASE_ERROR_MESSAGES[e.code] ?? 'Authentication failed. Please try again.';
      return new AuthFailure(message);
    }
    return new ServerFailure(
      e instanceof Error ? e.message : 'An unexpected error occurred.',
    );
  }
}

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'The email address is not valid.',
  'auth/weak-password': 'Password must be at least 8 characters.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/network-request-failed': 'Network error. Please check your connection.',
};
