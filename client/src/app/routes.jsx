import { createBrowserRouter } from 'react-router'
import { RootLayout } from './components/layouts/RootLayout.jsx'
import { LandingPage } from './pages/LandingPage.jsx'
import { CustomizePage } from './pages/CustomizePage.jsx'
import { BassCustomizePage } from './pages/BassCustomizePage.jsx'
import { ShopPage } from './pages/ShopPage.jsx'
import { AppointmentPage } from './pages/AppointmentPage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { AdminPage } from './pages/AdminPage.jsx'
import { StaffDashboard } from './pages/StaffDashboard.jsx'
import { CartPage } from './pages/CartPage.jsx'
import { CheckoutPage } from './pages/CheckoutPage.jsx'
import { SignupPage } from './pages/SignupPage.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { OTPVerificationPage } from './pages/OTPVerificationPage.jsx'
import { OAuthSuccessPage } from './pages/OAuthSuccessPage.jsx'
import { OAuthSignupPage } from './pages/OAuthSignupPage.jsx'
import { FeedbackPage } from './pages/FeedbackPage.jsx'

/**
 * Application routes configuration
 * Ref: Use Case Diagram aligned routes
 * 
 * Customer Routes: Landing, Shop, Customize, Appointments, Cart, Checkout, Dashboard, Feedback
 * Staff Routes: StaffDashboard (limited access)
 * Admin Routes: AdminDashboard (full control)
 */
export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      // Public routes
      { index: true, Component: LandingPage },
      { path: 'customize', Component: CustomizePage },
      { path: 'customize-bass', Component: BassCustomizePage },
      { path: 'shop', Component: ShopPage },
      { path: 'appointments', Component: AppointmentPage },
      
      // Authentication routes
      { path: 'login', Component: LoginPage },
      { path: 'signup', Component: SignupPage },
      { path: 'verify-otp', Component: OTPVerificationPage },
      { path: 'auth/success', Component: OAuthSuccessPage },
      { path: 'auth/signup', Component: OAuthSignupPage },
      
      // Customer routes (authenticated)
      { path: 'dashboard', Component: DashboardPage },
      { path: 'cart', Component: CartPage },
      { path: 'checkout', Component: CheckoutPage },
      { path: 'feedback', Component: FeedbackPage },
      
      // Staff routes (staff role only)
      { path: 'staff', Component: StaffDashboard },
      
      // Admin routes (admin role only)
      { path: 'admin', Component: AdminPage },
    ],
  },
])
