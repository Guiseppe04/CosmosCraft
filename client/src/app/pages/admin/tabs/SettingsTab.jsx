import { useState } from 'react'
import PhoneInput from '../../../components/PhoneInput'
import { motion, AnimatePresence } from 'motion/react'
import { Settings, User, Info, History, ArrowRight, ArrowLeft, Mail } from 'lucide-react'
import { AuditLogsSection } from '../components/settings/AuditLogsSection'
import { BranchAddressSettings } from '../components/settings/BranchAddressSettings'
import { getRoleLabel } from '../../../utils/roles'

const SETTINGS_SEARCH_TERMS = {
  account: 'your account profile email name role administrator',
  contact: 'site contact information email phone storefront landing page terms conditions',
  branch: 'appointment branch address location pickup country street province city barangay postal',
  general: 'general settings dashboard theme light dark appearance',
  audit: 'audit logs history orders projects refunds payments inventory',
  system: 'system information version updated admin role',
}

function SettingsCard({ icon: Icon, title, description, children }) {
  return (
    <section className="admin-settings-card">
      <div className="admin-settings-heading">
        <span className="admin-settings-icon"><Icon /></span>
        <div>
          <h3 className="admin-settings-title">{title}</h3>
          <p className="admin-settings-description">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

export function SettingsTab({
  user,
  isSuperAdmin,
  siteContactInfo,
  setSiteContactInfo,
  saveSiteContactInfo,
  showToast,
  searchQuery = '',
}) {
  const [activeSubTab, setActiveSubTab] = useState('settings')
  const visibleSections = Object.entries(SETTINGS_SEARCH_TERMS)
    .filter(([key, text]) => (isSuperAdmin || !['contact', 'branch'].includes(key)) && text.includes(searchQuery.trim().toLowerCase()))
    .map(([key]) => key)

  return (
    <AnimatePresence mode="wait">
      {activeSubTab === 'settings' ? (
        <motion.div className="admin-settings-stack" key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          {visibleSections.includes('account') && (
            <SettingsCard icon={User} title="Your account" description="Your workspace account and access details.">
              <div className="admin-settings-details">
                <div className="admin-settings-detail-row">
                  <span>Email</span><span className="admin-settings-detail-value">{user?.email || 'Not available'}</span>
                </div>
                <div className="admin-settings-detail-row">
                  <span>Name</span><span className="admin-settings-detail-value">{user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName || 'Admin'}</span>
                </div>
                <div className="admin-settings-detail-row">
                  <span>Role</span><span className="admin-settings-role">{getRoleLabel(user?.role) || 'Administrator'}</span>
                </div>
              </div>
            </SettingsCard>
          )}

          {isSuperAdmin && visibleSections.includes('contact') && (
            <SettingsCard icon={Mail} title="Site contact information" description="Used across your storefront and policy pages.">
              <div className="admin-settings-fields">
                <label>
                  <span className="admin-settings-label">Contact email</span>
                  <input type="email" value={siteContactInfo?.email || ''}
                    onChange={(event) => setSiteContactInfo((current) => ({ ...current, email: event.target.value }))}
                    className="admin-settings-input" placeholder="Contact email" />
                </label>
                <label>
                  <span className="admin-settings-label">Contact phone</span>
                  <div className="admin-settings-phone">
                    <PhoneInput value={siteContactInfo?.phone || ''}
                      onChange={(event) => setSiteContactInfo((current) => ({ ...current, phone: event.target.value }))}
                      className="admin-settings-input" />
                  </div>
                </label>
              </div>
              <p className="admin-settings-note"><Info />Changes update the public contact details shown to customers.</p>
              <button type="button" onClick={saveSiteContactInfo} className="admin-settings-save">
                <Settings />Save contact information
              </button>
            </SettingsCard>
          )}

          {isSuperAdmin && visibleSections.includes('branch') && <BranchAddressSettings showToast={showToast} />}

          {visibleSections.includes('general') && (
            <SettingsCard icon={Settings} title="General settings" description="Personalize the appearance of your workspace.">
              <p className="admin-settings-description">Switch between light and dark mode using the theme toggle in the top bar.</p>
            </SettingsCard>
          )}

          {visibleSections.includes('audit') && (
            <SettingsCard icon={History} title="Audit logs" description="Review order updates, project milestones, refunds, payments, and inventory changes.">
              <button type="button" onClick={() => setActiveSubTab('audit')} className="admin-settings-link">
                Open Audit Logs<ArrowRight />
              </button>
            </SettingsCard>
          )}

          {visibleSections.includes('system') && (
            <SettingsCard icon={Info} title="System information" description="Application details and workspace access.">
              <div className="admin-settings-details">
                <div className="admin-settings-detail-row"><span>System version</span><span className="admin-settings-detail-value">v1.0.0</span></div>
                <div className="admin-settings-detail-row"><span>Last updated</span><span className="admin-settings-detail-value">{new Date().toLocaleDateString()}</span></div>
                <div className="admin-settings-detail-row"><span>Admin role</span><span className="admin-settings-detail-value capitalize">{user?.role?.replace('_', ' ')}</span></div>
              </div>
            </SettingsCard>
          )}
          {visibleSections.length === 0 && <p className="admin-settings-empty" role="status">No settings found for “{searchQuery}”.</p>}
        </motion.div>
      ) : (
        <motion.div key="subtab-audit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          <button type="button" onClick={() => setActiveSubTab('settings')} className="admin-settings-link mb-5">
            <ArrowLeft />Back to Settings
          </button>
          <AuditLogsSection isSuperAdmin={isSuperAdmin} showToast={showToast} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default SettingsTab
