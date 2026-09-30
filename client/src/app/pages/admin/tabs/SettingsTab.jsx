import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Settings, User, MapPin, Save, Info, History, ArrowRight, ArrowLeft, ShieldCheck, Activity, Mail, Phone } from 'lucide-react'
import { AuditLogsSection } from '../components/settings/AuditLogsSection'

export function SettingsTab({
  user,
  isSuperAdmin,
  appointmentBranchAddress,
  setAppointmentBranchAddress,
  saveAppointmentBranchAddress,
  siteContactInfo,
  setSiteContactInfo,
  saveSiteContactInfo,
  showToast,
}) {
  const [activeSubTab, setActiveSubTab] = useState('settings')

  return (
    <AnimatePresence mode="wait">
      {activeSubTab === 'settings' ? (
        <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
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

            {/* Audit Trail Quick Access Banner */}
            <div className="bg-gradient-to-br from-[var(--surface-dark)] to-[var(--surface-elevated)] border border-[var(--gold-primary)]/30 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-[var(--gold-primary)]/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-primary)]/15 text-[var(--gold-primary)] text-xs font-semibold mb-3">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Security & Compliance</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
                  <History className="w-5 h-5 text-[var(--gold-primary)]" />
                  Audit Trail & System Activity
                </h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  Review complete chronological event logs including order state updates, custom project milestones, refunds, payments, and inventory adjustments.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-[var(--border)]">
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  Active logging enabled
                </span>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('audit')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold text-xs hover:shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-all"
                >
                  <span>Open Audit Logs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
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

            {isSuperAdmin && (
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                  <Mail className="w-5 h-5 text-[var(--gold-primary)]" />
                  Site Contact Information
                </h3>
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[var(--text-muted)]">Contact Email</span>
                    <input
                      type="email"
                      value={siteContactInfo?.email || ''}
                      onChange={(event) => setSiteContactInfo((current) => ({ ...current, email: event.target.value }))}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/50"
                      placeholder="Contact email"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[var(--text-muted)]">Contact Phone</span>
                    <input
                      type="tel"
                      value={siteContactInfo?.phone || ''}
                      onChange={(event) => setSiteContactInfo((current) => ({ ...current, phone: event.target.value }))}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/50"
                      placeholder="Contact phone"
                    />
                  </label>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={saveSiteContactInfo}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--gold-primary)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
                  >
                    <Phone className="w-4 h-4" />
                    Save Contact Information
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
      ) : (
          <motion.div
            key="subtab-audit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              onClick={() => setActiveSubTab('settings')}
              className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--gold-primary)] hover:text-[var(--gold-secondary)]"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Settings
            </button>
            <AuditLogsSection isSuperAdmin={isSuperAdmin} showToast={showToast} />
          </motion.div>
        )}
      </AnimatePresence>
  )
}

export default SettingsTab
