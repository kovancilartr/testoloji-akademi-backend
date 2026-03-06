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

export const FEATURE_FLAGS: Record<string, SubscriptionTier[]> = {
  CAN_CREATE_COURSE: [SubscriptionTier.ALTIN],
  CAN_CREATE_CLASSROOM: [SubscriptionTier.GUMUS, SubscriptionTier.ALTIN],
  CAN_USE_LIVE_SESSIONS: [SubscriptionTier.GUMUS, SubscriptionTier.ALTIN],
  CAN_USE_AI_COACHING: [SubscriptionTier.BRONZ, SubscriptionTier.GUMUS, SubscriptionTier.ALTIN],
};

export const hasFeatureAccess = (role: Role, tier: SubscriptionTier, feature: keyof typeof FEATURE_FLAGS) => {
  if (role === Role.ADMIN) return true;
  return FEATURE_FLAGS[feature].includes(tier);
};
