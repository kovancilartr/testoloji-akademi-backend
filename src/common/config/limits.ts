import { SubscriptionTier, Role } from '@prisma/client';

export const PROJECT_LIMITS: Record<string, number> = {
  [SubscriptionTier.FREE]: 0,
  [SubscriptionTier.BRONZ]: 1,
  [SubscriptionTier.GUMUS]: 5,
  [SubscriptionTier.ALTIN]: 15,
};

export const QUESTION_LIMITS: Record<string, number> = {
  [SubscriptionTier.FREE]: 0,
  [SubscriptionTier.BRONZ]: 15,
  [SubscriptionTier.GUMUS]: 100,
  [SubscriptionTier.ALTIN]: 200,
};

export const getProjectLimit = (role: Role, tier: SubscriptionTier) => {
  if (role === Role.ADMIN) return 10000;
  return PROJECT_LIMITS[tier] || 0;
};

export const getQuestionLimit = (role: Role, tier: SubscriptionTier) => {
  if (role === Role.ADMIN) return 10000;
  return QUESTION_LIMITS[tier] || 0;
};
