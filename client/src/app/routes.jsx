import { createBrowserRouter } from 'react-router'
import { RootLayout } from './components/layouts/RootLayout.jsx'
import { LandingPage } from './pages/LandingPage.jsx'
import { CustomizePage } from './pages/CustomizePage.jsx'
import { ShopPage } from './pages/ShopPage.jsx'
import { AppointmentPage } from './pages/AppointmentPage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { AdminPage } from './pages/AdminPage.jsx'
import { CartPage } from './pages/CartPage.jsx'
import { CheckoutPage } from './pages/CheckoutPage.jsx'
import { SignupPage } from './pages/SignupPage.jsx'
import { OTPVerificationPage } from './pages/OTPVerificationPage.jsx'
import { OAuthSuccessPage } from './pages/OAuthSuccessPage.jsx'

/**
 * Application routes configuration
 * Ref: fromFigma/routes - all application pages
 */
export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: LandingPage },
      { path: 'customize', Component: CustomizePage },
      { path: 'shop', Component: ShopPage },
      { path: 'appointments', Component: AppointmentPage },
      { path: 'dashboard', Component: DashboardPage },
      { path: 'admin', Component: AdminPage },
      { path: 'signup', Component: SignupPage },
      { path: 'verify-otp', Component: OTPVerificationPage },
      { path: 'cart', Component: CartPage },
      { path: 'checkout', Component: CheckoutPage },
      { path: 'auth/success', Component: OAuthSuccessPage },
    ],
  },
])
