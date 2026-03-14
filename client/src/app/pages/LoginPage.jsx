import { useState } from 'react'
import { Mail, Lock } from 'lucide-react'

/**
 * LoginPage - User Authentication
 * Ref: fromFigma/pages/LoginPage - User login and authentication
 */
export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      alert(`Logged in as ${email}`)
      setEmail('')
      setPassword('')
      setIsLoading(false)
    }, 1000)
  }

  const handleSocialLogin = (provider) => {
    alert(`Logging in with ${provider}...`)
  }

  return (
    <div className="min-h-screen bg-light flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="mb-8">
          <a href="/" className="text-2xl font-bold text-dark">CosmosCraft</a>
        </div>

        {/* Welcome Section */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-dark mb-2">Welcome Back</h1>
          <p className="text-dark opacity-60">Sign in to continue to CosmosCraft</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-lg space-y-6">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-dark mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-light-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-dark mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-light-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent"
            />
          </div>

          {/* Remember & Forgot */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 border border-light-dark rounded cursor-pointer"
              />
              <span className="text-sm text-dark">Remember me</span>
            </label>
            <a href="#" className="text-sm text-gold hover:text-gold-dark font-medium">
              Forgot password?
            </a>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gold hover:bg-gold-dark text-dark font-bold py-3 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-light-dark"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-dark opacity-60">Or continue with</span>
            </div>
          </div>

          {/* Social Logins */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleSocialLogin('Google')}
              className="w-full border border-light-dark hover:border-gold rounded-lg py-3 font-medium text-dark transition"
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => handleSocialLogin('Facebook')}
              className="w-full border border-light-dark hover:border-gold rounded-lg py-3 font-medium text-dark transition"
            >
              Facebook
            </button>
          </div>
        </form>

        {/* Sign Up Link */}
        <div className="mt-6 text-center space-y-4">
          <p className="text-dark">
            Don't have an account?{' '}
            <a href="#" className="text-gold font-bold hover:text-gold-dark">
              Sign up
            </a>
          </p>
        </div>

        {/* Demo Accounts */}
        <div className="mt-12 bg-white rounded-2xl p-6 shadow-lg space-y-6">
          <h3 className="font-bold text-dark text-lg">DEMO ACCOUNTS</h3>

          <div className="space-y-4">
            {/* User Account */}
            <div>
              <h4 className="font-bold text-dark mb-2">User Account</h4>
              <div className="space-y-1 text-sm text-dark opacity-70">
                <p>Email: <span className="font-semibold text-dark">user@cosmoscraft.com</span></p>
                <p>Password: <span className="font-semibold text-dark">user123</span></p>
              </div>
            </div>

            {/* Admin Account */}
            <div>
              <h4 className="font-bold text-dark mb-2">Admin Account</h4>
              <div className="space-y-1 text-sm text-dark opacity-70">
                <p>Email: <span className="font-semibold text-dark">admin@cosmoscraft.com</span></p>
                <p>Password: <span className="font-semibold text-dark">admin123</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <a href="/" className="text-gold hover:text-gold-dark font-medium">
            ← Back to home
          </a>
        </div>
      </div>
    </div>
  )
}
