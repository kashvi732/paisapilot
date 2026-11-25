import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { PageLayout } from './components/layout/PageLayout'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import { ProtectedRoute, SetupRequiredRoute, OnboardingRoute } from './routes/ProtectedRoute'

// Pages load on demand so the sign-in screen does not download the charting library.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Budgets = lazy(() => import('./pages/Budgets'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))
const Onboarding = lazy(() => import('./pages/Onboarding'))

const pageFallback = <div className="p-12 text-center text-secondary">Loading…</div>
const page = element => <Suspense fallback={pageFallback}>{element}</Suspense>

const router = createBrowserRouter([
  {
    path: '/',
    element: <ProtectedRoute><SetupRequiredRoute><PageLayout /></SetupRequiredRoute></ProtectedRoute>,
    children: [
      { index: true, element: page(<Dashboard />) },
      { path: 'dashboard', element: page(<Dashboard />) },
      { path: 'transactions', element: page(<Transactions />) },
      { path: 'budgets', element: page(<Budgets />) },
      { path: 'analytics', element: page(<Analytics />) },
      { path: 'settings', element: page(<Settings />) },
    ],
  },
  { path: '/onboarding', element: <ProtectedRoute><OnboardingRoute>{page(<Onboarding />)}</OnboardingRoute></ProtectedRoute> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
])

export default function App() {
  return (
    <RouterProvider router={router} />
  )
}
