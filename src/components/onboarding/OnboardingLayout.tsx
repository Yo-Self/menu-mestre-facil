import { ReactNode } from 'react';
import { OnboardingProgress } from './OnboardingProgress';

interface OnboardingLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  currentStep: 1 | 2 | 3;
}

export function OnboardingLayout({
  children,
  title,
  description,
  currentStep,
}: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Menu Mestre Fácil</h1>
          <p className="text-muted-foreground mt-1">Configure sua conta em poucos passos</p>
        </div>

        <OnboardingProgress currentStep={currentStep} />

        <div className="mt-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">{title}</h2>
            {description && (
              <p className="text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
