export type Either<L, R> = Left<L> | Right<R>;

export interface Left<L> {
  readonly _tag: 'Left';
  readonly left: L;
}

export interface Right<R> {
  readonly _tag: 'Right';
  readonly right: R;
}

export const left = <L>(value: L): Left<L> => ({ _tag: 'Left', left: value });
export const right = <R>(value: R): Right<R> => ({ _tag: 'Right', right: value });

export const isLeft = <L, R>(e: Either<L, R>): e is Left<L> => e._tag === 'Left';
export const isRight = <L, R>(e: Either<L, R>): e is Right<R> => e._tag === 'Right';

export const fold = <L, R, T>(
  e: Either<L, R>,
  onLeft: (l: L) => T,
  onRight: (r: R) => T,
): T => (isLeft(e) ? onLeft(e.left) : onRight(e.right));
