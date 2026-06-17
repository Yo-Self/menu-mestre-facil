import { Routes, Route, Navigate } from 'react-router-dom';
import { AccountStep } from './steps/AccountStep';
import { RestaurantStep } from './steps/RestaurantStep';
import { MenuStep } from './steps/MenuStep';

export default function OnboardingPage() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="account" replace />} />
      <Route path="account" element={<AccountStep />} />
      <Route path="restaurant" element={<RestaurantStep />} />
      <Route path="menu" element={<MenuStep />} />
      <Route path="*" element={<Navigate to="account" replace />} />
    </Routes>
  );
}
