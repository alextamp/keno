export abstract class Failure extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AuthFailure extends Failure {}
export class InvalidEmailFailure extends Failure {}
export class NetworkFailure extends Failure {}
export class ServerFailure extends Failure {}

export class EmailNotVerifiedFailure extends Failure {
  constructor() {
    super('Please verify your university email before continuing.');
  }
}

export class UnknownFailure extends Failure {
  constructor() {
    super('An unexpected error occurred. Please try again.');
  }
}
