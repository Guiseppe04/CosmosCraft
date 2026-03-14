import { Users, Package, TrendingUp, Activity } from 'lucide-react'

/**
 * AdminPage - Admin Dashboard
 * Ref: fromFigma/pages/AdminPage - Admin management and analytics
 */
export function AdminPage() {
  const adminStats = [
    { label: 'Total Users', value: '1,284', icon: Users, color: 'bg-gold' },
    { label: 'Total Sales', value: '$48,592', icon: TrendingUp, color: 'bg-gold' },
    { label: 'Pending Orders', value: '23', icon: Package, color: 'bg-gold' },
    { label: 'Active Sessions', value: '342', icon: Activity, color: 'bg-gold' },
  ]

  const recentUsers = [
    { id: 1, name: 'John Doe', email: 'john@example.com', joined: '2024-03-10', status: 'Active' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', joined: '2024-03-09', status: 'Active' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', joined: '2024-03-08', status: 'Inactive' },
  ]

  return (
    <div className="min-h-screen bg-light">
      <div className="page">
        <h1 className="text-5xl font-bold text-dark mb-12">Admin Dashboard</h1>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          {adminStats.map((stat, i) => {
            const Icon = stat.icon
            return (
              <div key={i} className="bg-white rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-dark opacity-70">{stat.label}</h3>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="w-5 h-5 text-dark" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-dark">{stat.value}</p>
              </div>
            )
          })}
        </div>

        {/* Users */}
        <div className="bg-white rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-dark mb-6">Recent Users</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-light-dark">
                <tr>
                  <th className="text-left py-4 text-dark font-semibold">Name</th>
                  <th className="text-left py-4 text-dark font-semibold">Email</th>
                  <th className="text-left py-4 text-dark font-semibold">Joined</th>
                  <th className="text-left py-4 text-dark font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map(user => (
                  <tr key={user.id} className="border-b border-light-dark hover:bg-light transition">
                    <td className="py-4 text-dark font-semibold">{user.name}</td>
                    <td className="py-4 text-dark">{user.email}</td>
                    <td className="py-4 text-dark">{user.joined}</td>
                    <td className="py-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        user.status === 'Active'
                          ? 'bg-gold bg-opacity-20 text-gold'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Management Buttons */}
        <div className="bg-white rounded-2xl p-8 space-y-4">
          <h2 className="text-2xl font-bold text-dark mb-6">Quick Actions</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <button className="btn btn-primary">Add New Product</button>
            <button className="btn btn-primary">Manage Users</button>
            <button className="btn btn-primary">View Analytics</button>
          </div>
        </div>
      </div>
    </div>
  )
}
