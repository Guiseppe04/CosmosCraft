import { motion } from 'motion/react'
import { Settings, User, MapPin, Save, Info } from 'lucide-react'

export function SettingsTab({
  user,
  isSuperAdmin,
  appointmentBranchAddress,
  setAppointmentBranchAddress,
  saveAppointmentBranchAddress,
}) {
  return (
    <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings Section */}
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
            <Settings className="w-5 h-5 text-[var(--gold-primary)]" />
            General Settings
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Dashboard Theme</label>
              <p className="text-white text-sm">Light mode is the default. You can switch to dark mode using the theme toggle in the top bar.</p>
            </div>
          </div>
        </div>

        {/* User Account */}
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
            <User className="w-5 h-5 text-[var(--gold-primary)]" />
            Your Account
          </h3>
          <div className="space-y-3">
            <div>
              <span className="text-[var(--text-muted)] text-sm">Email</span>
              <p className="text-white font-mono">{user?.email || 'Not available'}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)] text-sm">Name</span>
              <p className="text-white font-mono">{user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName || 'Admin'}</p>
            </div>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <MapPin className="w-5 h-5 text-[var(--gold-primary)]" />
              Appointment Branch
            </h3>
            <p className="text-sm text-[var(--text-muted)] mb-3">
              This address is shown in the customer appointment flow (Step 3 Location).
            </p>
            <textarea
              value={appointmentBranchAddress}
              onChange={(e) => setAppointmentBranchAddress(e.target.value)}
              className="w-full h-24 px-4 py-3 bg-[var(--bg-primary)] text-white border border-[var(--border)] rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/50"
              placeholder="Branch address"
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={saveAppointmentBranchAddress}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--gold-primary)] text-black font-semibold text-sm hover:opacity-90 transition"
              >
                <Save className="w-4 h-4" />
                Save Branch Address
              </button>
            </div>
          </div>
        )}

        {/* System Information */}
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
            <Info className="w-5 h-5 text-[var(--gold-primary)]" />
            System Information
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">System Version</span>
              <span className="text-white font-mono">v1.0.0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Last Updated</span>
              <span className="text-white font-mono">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Admin Role</span>
              <span className="text-white font-mono capitalize">{user?.role?.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
