export type OnboardingStep = 'account' | 'restaurant' | 'menu' | 'completed';

export const ONBOARDING_STEP_ROUTES: Record<OnboardingStep, string> = {
  account: '/onboarding/account',
  restaurant: '/onboarding/restaurant',
  menu: '/onboarding/menu',
  completed: '/dashboard',
};

export const ONBOARDING_STEP_ORDER: OnboardingStep[] = [
  'account',
  'restaurant',
  'menu',
  'completed',
];

export function getOnboardingRoute(step: OnboardingStep): string {
  return ONBOARDING_STEP_ROUTES[step] ?? '/onboarding/account';
}

export function getNextOnboardingStep(step: OnboardingStep): OnboardingStep {
  const index = ONBOARDING_STEP_ORDER.indexOf(step);
  if (index === -1 || index >= ONBOARDING_STEP_ORDER.length - 1) {
    return 'completed';
  }
  return ONBOARDING_STEP_ORDER[index + 1];
}

export function isOnboardingComplete(step: OnboardingStep): boolean {
  return step === 'completed';
}
