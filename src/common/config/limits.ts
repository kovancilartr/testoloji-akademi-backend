import { SubscriptionTier, Role } from '@prisma/client';

export const PROJECT_LIMITS: Record<string, number> = {
  [SubscriptionTier.FREE]: 1,
  [SubscriptionTier.BRONZ]: 5,
  [SubscriptionTier.GUMUS]: 20,
  [SubscriptionTier.ALTIN]: 50,
};

export const QUESTION_LIMITS: Record<string, number> = {
  [SubscriptionTier.FREE]: 15,
  [SubscriptionTier.BRONZ]: 50,
  [SubscriptionTier.GUMUS]: 150,
  [SubscriptionTier.ALTIN]: 450,
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
