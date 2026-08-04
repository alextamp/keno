export type ReviewType = 'recommend';

export const REVIEW_EMOJI = '👍';
export const REVIEW_LABEL = 'Recommend';

export interface ReviewEntity {
  id: string;
  fromUid: string;
  toUid: string;
  eventId: string;
  type: ReviewType;
  createdAt: Date;
}

export interface ReviewSummary {
  count: number;
}

export function calculateReviewSummary(reviews: ReviewEntity[] | undefined): ReviewSummary {
  return { count: reviews?.length ?? 0 };
}
