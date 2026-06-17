-- Onboarding fields for profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS onboarding_step text NOT NULL DEFAULT 'account'
    CHECK (onboarding_step IN ('account', 'restaurant', 'menu', 'completed')),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_checklist_dismissed_at timestamptz;

-- Existing users with restaurant + dishes: mark onboarding as completed
UPDATE profiles p SET
  onboarding_step = 'completed',
  onboarding_completed_at = now()
WHERE onboarding_step = 'account'
  AND EXISTS (
    SELECT 1 FROM restaurants r
    JOIN dishes d ON d.restaurant_id = r.id
    WHERE r.user_id = p.id
  );

-- Users with restaurant but no dishes yet: advance to menu step
UPDATE profiles p SET
  onboarding_step = 'menu'
WHERE onboarding_step = 'account'
  AND EXISTS (
    SELECT 1 FROM restaurants r WHERE r.user_id = p.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM restaurants r
    JOIN dishes d ON d.restaurant_id = r.id
    WHERE r.user_id = p.id
  );
