import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, Circle, ChevronDown, ChevronRight, Plus, Trash2, Edit, User, Clock, AlertCircle, Guitar, Package, Search, Calendar } from 'lucide-react';
import { adminApi } from '../../utils/adminApi';
import { formatCurrency } from '../../utils/formatCurrency';

export default function ProjectTaskTracker({ projectId, projectName, isAdmin = false, parts = [], projectData = null }) {
  const [hierarchy, setHierarchy] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Parts panel state
  const [partsSearchQuery, setPartsSearchQuery] = useState('');
  const [expandedPartCategories, setExpandedPartCategories] = useState(new Set());

  // Exanded state for accordions
  const [expandedMilestones, setExpandedMilestones] = useState(new Set());
  const navigate = useNavigate();

  // Form states for Admin
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [addingSubtaskTo, setAddingSubtaskTo] = useState(null); // tracking milestone_id
  const [form, setForm] = useState({});

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getProjectHierarchy(projectId);
      setHierarchy(res.data);
      
      const logsRes = await adminApi.getProjectActivity(projectId);
      setLogs(logsRes.data || []);
      
      // Auto-expand all milestones
      if (res.data?.milestones) {
        setExpandedMilestones(new Set(res.data.milestones.map(m => m.milestone_id)));
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMilestone = (mId) => {
    setExpandedMilestones(prev => {
      const next = new Set(prev);
      if (next.has(mId)) next.delete(mId);
      else next.add(mId);
      return next;
    });
  };

  const togglePartCategory = (category) => {
    setExpandedPartCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const resolvedParts = parts.length > 0 ? parts : (Array.isArray(hierarchy?.parts) ? hierarchy.parts : []);

  // Group parts by category
  const groupedParts = resolvedParts.reduce((groups, part) => {
    const category = part.type_mapping || part.part_category || 'Other';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(part);
    return groups;
  }, {});

  // Filter parts based on search query
  const getFilteredParts = () => {
    const filtered = {};
    Object.entries(groupedParts).forEach(([category, categoryParts]) => {
      const filteredCategoryParts = categoryParts.filter(part =>
        part.name.toLowerCase().includes(partsSearchQuery.toLowerCase())
      );
      if (filteredCategoryParts.length > 0) {
        filtered[category] = filteredCategoryParts;
      }
    });
    return filtered;
  };

  const getStockColor = (stock) => {
    if (stock === null || stock === undefined || Number.isNaN(Number(stock))) return 'text-slate-300';
    if (stock === 0) return 'text-red-400';
    if (stock <= 5) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getStockDot = (stock) => {
    if (stock === null || stock === undefined || Number.isNaN(Number(stock))) return 'bg-slate-400';
    if (stock === 0) return 'bg-red-500';
    if (stock <= 5) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  // User Actions
  const toggleSubtaskStatus = async (subtask) => {
    // If not admin, check if updatable
    if (!isAdmin && !subtask.is_customer_updatable) return;

    try {
      const newStatus = subtask.status === 'completed' ? 'pending' : 'completed';
      await adminApi.updateSubtask(subtask.subtask_id, { status: newStatus });
      loadData(); // Re-fetch to get new progress %
    } catch (err) {
      alert("Failed to update task: " + err.message);
    }
  };

  // Admin Actions
  const handleAddMilestone = async () => {
    try {
      await adminApi.createMilestone(projectId, { title: form.milestoneTitle, description: form.milestoneDesc });
      setIsAddingMilestone(false);
      setForm({});
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteMilestone = async (mId) => {
    if(!window.confirm("Are you sure? This deletes all subtasks within this milestone.")) return;
    try {
      await adminApi.deleteMilestone(mId);
      loadData();
    } catch (err) { alert(err.message); }
  };

  const handleAddSubtask = async (mId) => {
    try {
      await adminApi.createSubtask(mId, { 
        title: form.subtaskTitle, 
        is_customer_updatable: form.isCustomerUpdatable || false 
      });
      setAddingSubtaskTo(null);
      setForm({});
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteSubtask = async (sId) => {
    if(!window.confirm("Delete this subtask?")) return;
    try {
      await adminApi.deleteSubtask(sId);
      loadData();
    } catch (err) { alert(err.message); }
  };


  if (loading) return <div className="text-center py-10 text-[var(--text-muted)] animate-pulse">Loading tracker data...</div>;
  if (error) return <div className="text-red-400 p-4 border border-red-500/30 bg-red-500/10 rounded-xl">{error}</div>;
  if (!hierarchy) return null;

  return (
    <div className="grid lg:grid-cols-[1fr_350px] gap-6">
      
      {/* ── MAIN TRACKER SECTION ── */}
      <div className="space-y-6">
        
        {/* Progress Header */}
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--gold-primary)]/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white text-2xl font-bold">{hierarchy.name || hierarchy.title || projectName || 'Project Tracker'}</h2>
              <p className="text-[var(--text-muted)] text-sm">{hierarchy.customer_name ? `For: ${hierarchy.customer_name}` : '—'}</p>
            </div>
            <div className="text-right">
              <span className="text-[var(--gold-primary)] text-3xl font-black">{hierarchy.progress}%</span>
              <p className="text-white font-semibold flex items-center justify-end gap-2">
                {hierarchy.status}
              </p>
            </div>
          </div>
          
          <div className="h-3 w-full bg-[var(--bg-primary)] rounded-full overflow-hidden mb-2">
             <motion.div 
               initial={{ width: 0 }} 
               animate={{ width: `${hierarchy.progress}%` }} 
               transition={{ duration: 1, ease: 'easeOut' }}
               className="h-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)]" 
             />
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-[var(--text-muted)] text-xs">Total Completion</p>
            
            {/* Customer Book Appointment Action */}
            {!isAdmin && (
              <button
                onClick={() => navigate('/appointments')}
                disabled={hierarchy.progress !== 100}
                className={`py-2 px-6 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                  hierarchy.progress === 100 
                    ? 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] shadow-[0_0_15px_rgba(212,175,55,0.4)] hover:shadow-[0_0_20px_rgba(212,175,55,0.6)]'
                    : 'bg-[var(--surface-elevated)] text-[var(--text-muted)] cursor-not-allowed opacity-60'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Book Appointment
              </button>
            )}
          </div>
        </div>

        {/* Finished Notification */}
        {!isAdmin && hierarchy.progress === 100 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-start gap-3"
          >
            <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-green-400 font-bold mb-1">Your Project is Finished!</h4>
              <p className="text-sm text-green-400/80">We have completed your build. You can now book an appointment to finalize the details and arrange for pickup or delivery.</p>
            </div>
          </motion.div>
        )}

        {/* Milestones Accordion */}
        <div className="space-y-4">
          {hierarchy.milestones?.length === 0 ? (
             <div className="text-center py-12 bg-white/5 border border-[var(--border)] rounded-2xl">
               <AlertCircle className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
               <p className="text-white font-semibold">No milestones built yet.</p>
               <p className="text-[var(--text-muted)] text-sm">{(isAdmin ? 'Create a milestone to get started.' : 'Awaiting admin initialization.')}</p>
             </div>
          ) : (
            hierarchy.milestones?.map((milestone, i) => {
              const isExpanded = expandedMilestones.has(milestone.milestone_id);
              const mProgress = milestone.subtasks?.length 
                ? Math.round((milestone.subtasks.filter(s => s.status === 'completed').length / milestone.subtasks.length) * 100)
                : 0;
              
              return (
                <div key={milestone.milestone_id} className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden transition-all hover:border-[var(--gold-primary)]/30">
                  
                  {/* Milestone Header (Clickable) */}
                  <div 
                    className="p-5 cursor-pointer flex items-center justify-between select-none"
                    onClick={() => toggleMilestone(milestone.milestone_id)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg
                        ${mProgress === 100 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--gold-primary)]'}
                      `}>
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold text-lg">{milestone.title}</h3>
                        <div className="flex items-center gap-4 mt-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${milestone.status === 'completed' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                            {milestone.status === 'completed' ? 'Done' : 'Pending'}
                          </span>
                          <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                            <div className="h-1.5 flex-1 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                              <div className="h-full bg-[var(--gold-primary)]" style={{ width: `${mProgress}%` }} />
                            </div>
                            <span className="text-[var(--text-muted)] text-xs font-mono">{mProgress}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isAdmin && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteMilestone(milestone.milestone_id); }} className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div className="p-2 bg-[var(--bg-primary)] rounded-lg">
                        {isExpanded ? <ChevronDown className="w-5 h-5 text-white" /> : <ChevronRight className="w-5 h-5 text-white" />}
                      </div>
                    </div>
                  </div>

                  {/* Subtasks Block */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-[var(--border)] bg-[var(--bg-primary)]/30"
                      >
                        <div className="p-5 space-y-3">
                          {milestone.subtasks?.length === 0 ? (
                            <p className="text-[var(--text-muted)] text-sm text-center italic py-2">No tasks defined for this milestone.</p>
                          ) : (
                            milestone.subtasks?.map(subtask => {
                              const isCompleted = subtask.status === 'completed';
                              const canUserUpdate = isAdmin || subtask.is_customer_updatable;

                              return (
                                <div key={subtask.subtask_id} className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${isCompleted ? 'bg-green-500/5 border-green-500/30' : 'bg-[var(--surface-dark)] border-[var(--border)] hover:border-[var(--gold-primary)]/50'}`}>
                                  <button 
                                    onClick={() => toggleSubtaskStatus(subtask)}
                                    disabled={!canUserUpdate}
                                    className={`mt-0.5 rounded-full outline-none focus:ring-2 focus:ring-[var(--gold-primary)] transition-all ${canUserUpdate && !isCompleted ? 'hover:scale-110' : ''}`}
                                  >
                                    {isCompleted ? (
                                      <CheckCircle className="w-6 h-6 text-green-400" />
                                    ) : (
                                      <Circle className={`w-6 h-6 ${canUserUpdate ? 'text-[var(--text-muted)] hover:text-[var(--gold-primary)]' : 'text-gray-600 cursor-not-allowed'}`} />
                                    )}
                                  </button>
                                  <div className="flex-1">
                                    <p className={`font-medium ${isCompleted ? 'text-[var(--text-muted)] line-through' : 'text-white'}`}>{subtask.title}</p>
                                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                      {subtask.is_customer_updatable && (
                                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] uppercase font-bold tracking-wider rounded">CUSTOMER ACTION REQ</span>
                                      )}
                                      {subtask.assignee_first && (
                                        <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                                          <User className="w-3 h-3" /> {subtask.assignee_first} {subtask.assignee_last}
                                        </span>
                                      )}
                                      {isCompleted && (
                                        <span className="flex items-center gap-1 text-xs text-green-400/70">
                                          <Clock className="w-3 h-3" /> {new Date(subtask.completed_at).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {isAdmin && (
                                     <button onClick={() => handleDeleteSubtask(subtask.subtask_id)} className="p-1.5 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 rounded">
                                       <Trash2 className="w-4 h-4" />
                                     </button>
                                  )}
                                </div>
                              );
                            })
                          )}

                          {/* Admin: Add Subtask Row */}
                          {isAdmin && (
                            addingSubtaskTo === milestone.milestone_id ? (
                              <div className="p-4 bg-[var(--surface-dark)] border border-[var(--gold-primary)]/50 rounded-xl mt-4">
                                <input autoFocus type="text" placeholder="Task description..." value={form.subtaskTitle || ''} onChange={e => setForm({...form, subtaskTitle: e.target.value})} className="w-full bg-transparent text-white border-b border-[var(--border)] focus:border-[var(--gold-primary)] px-2 py-1 outline-none mb-3" />
                                <label className="flex items-center gap-2 mb-4 cursor-pointer w-fit">
                                  <input type="checkbox" checked={form.isCustomerUpdatable || false} onChange={e => setForm({...form, isCustomerUpdatable: e.target.checked})} className="w-4 h-4" />
                                  <span className="text-sm text-[var(--text-muted)]">Customer can mark this complete</span>
                                </label>
                                <div className="flex gap-2">
                                  <button onClick={() => handleAddSubtask(milestone.milestone_id)} className="px-4 py-1.5 bg-[var(--gold-primary)] text-black font-bold text-sm rounded-lg">Save Task</button>
                                  <button onClick={() => setAddingSubtaskTo(null)} className="px-4 py-1.5 bg-white/10 text-white font-medium text-sm rounded-lg">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setAddingSubtaskTo(milestone.milestone_id)} className="flex items-center gap-2 w-full p-3 rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--gold-primary)]/50 text-[var(--text-muted)] hover:text-[var(--gold-primary)] transition-all justify-center mt-2">
                                <Plus className="w-4 h-4" /> Add Subtask
                              </button>
                            )
                          )}

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}

          {/* Admin: Add Milestone Global */}
          {isAdmin && (
             isAddingMilestone ? (
               <div className="bg-[var(--surface-dark)] border border-[var(--gold-primary)] shadow-[0_0_20px_rgba(212,175,55,0.1)] rounded-2xl p-6">
                 <h3 className="text-white font-bold mb-4">New Milestone</h3>
                 <div className="space-y-4">
                   <input type="text" placeholder="Milestone Title (e.g. Body Construction)" value={form.milestoneTitle || ''} onChange={e => setForm({...form, milestoneTitle: e.target.value})} className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white outline-none focus:border-[var(--gold-primary)]" />
                   <textarea placeholder="Description (optional)" value={form.milestoneDesc || ''} onChange={e => setForm({...form, milestoneDesc: e.target.value})} className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white outline-none focus:border-[var(--gold-primary)] min-h-[80px]" />
                   <div className="flex gap-3">
                      <button onClick={handleAddMilestone} className="flex-1 py-2.5 bg-[var(--gold-primary)] text-black font-bold rounded-xl">Create Milestone</button>
                      <button onClick={() => setIsAddingMilestone(false)} className="flex-1 py-2.5 bg-white/10 text-white font-medium rounded-xl">Cancel</button>
                   </div>
                 </div>
               </div>
             ) : (
               <button onClick={() => setIsAddingMilestone(true)} className="flex items-center justify-center gap-2 w-full p-4 rounded-2xl border-2 border-dashed border-[var(--border)] hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/5 text-[var(--text-muted)] hover:text-white transition-all font-semibold">
                 <Plus className="w-5 h-5" /> Add Milestone
               </button>
             )
          )}

        </div>
      </div>

      {/* ── GUITAR PARTS PANEL ── */}
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Guitar className="w-5 h-5 text-[var(--gold-primary)]" />
          <h3 className="text-white font-bold text-lg">Project Parts</h3>
          <span className="ml-auto px-2 py-0.5 bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] text-xs font-bold rounded-full">
            {resolvedParts.length}
          </span>
        </div>

        {/* Search Input */}
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Filter parts..."
            value={partsSearchQuery}
            onChange={(e) => setPartsSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm"
          />
        </div>

        {/* Parts List */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
          {resolvedParts.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center justify-center">
              <Guitar className="w-12 h-12 text-[var(--text-muted)]/30 mb-3" />
              <p className="text-[var(--text-muted)] text-sm font-semibold">No parts linked to this project yet.</p>
            </div>
          ) : Object.keys(getFilteredParts()).length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-8 h-8 text-[var(--text-muted)]/30 mx-auto mb-2" />
              <p className="text-[var(--text-muted)] text-xs">No parts match your search.</p>
            </div>
          ) : (
            Object.entries(getFilteredParts()).map(([category, categoryParts]) => {
              const isExpanded = expandedPartCategories.has(category) || Object.keys(getFilteredParts()).length === 1;
              
              return (
                <div key={category} className="overflow-hidden">
                  {/* Category Header */}
                  <button
                    onClick={() => togglePartCategory(category)}
                    className="w-full flex items-center justify-between p-3 bg-[var(--bg-primary)]/60 border-l-2 border-[var(--gold-primary)] hover:bg-[var(--bg-primary)] transition-colors rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm capitalize">{category}</span>
                      <span className="px-2 py-0.5 bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] text-xs font-bold rounded-full">
                        {categoryParts.length}
                      </span>
                    </div>
                    <motion.div
                      initial={false}
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                    </motion.div>
                  </button>

                  {/* Parts Cards (Collapsible) */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2 mt-2"
                      >
                        {categoryParts.map((part) => {
                          const stock = part.stock === null || part.stock === undefined ? null : Number(part.stock);
                          const hasInventoryState = Number.isFinite(stock);
                          const isLowStock = hasInventoryState && stock > 0 && stock <= 5;
                          const isOutOfStock = hasInventoryState && stock === 0;

                          return (
                            <div
                              key={part.part_id}
                              className="p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl hover:border-[var(--gold-primary)]/30 transition-all"
                            >
                              {/* Part Header */}
                              <div className="flex gap-3 mb-2">
                                {/* Image */}
                                <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-black/30 overflow-hidden border border-[var(--border)] flex items-center justify-center">
                                  {part.image_url ? (
                                    <img
                                      src={part.image_url}
                                      alt={part.name}
                                      className="w-full h-full object-contain"
                                    />
                                  ) : (
                                    <Guitar className="w-5 h-5 text-[var(--text-muted)]/50" />
                                  )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-semibold text-xs line-clamp-1">{part.name}</p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    <span className="px-1.5 py-0.5 bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] text-[10px] font-bold uppercase rounded">
                                      {category}
                                    </span>
                                    {part.guitar_type && (
                                      <span className="px-1.5 py-0.5 bg-gray-500/20 text-gray-400 text-[10px] font-medium rounded capitalize">
                                        {part.guitar_type}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Stock & Price */}
                              <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]/30">
                                <div className="flex items-center gap-1">
                                  <span className={`w-2 h-2 rounded-full ${getStockDot(stock)}`} />
                                  <span className={`text-xs font-semibold ${getStockColor(stock)}`}>
                                    {!hasInventoryState
                                      ? 'Configured'
                                      : isOutOfStock
                                      ? 'Out of stock'
                                      : isLowStock
                                      ? `Low: ${stock}`
                                      : `${stock} in stock`}
                                  </span>
                                </div>
                                {part.price && (
                                  <span className="text-[var(--gold-primary)] font-bold text-xs">
                                    {formatCurrency(part.price, true)}
                                  </span>
                                )}
                              </div>

                              {/* Active Badge */}
                              {part.is_active !== undefined && (
                                <div className="mt-2 flex justify-end">
                                  <span
                                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                                      part.is_active
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                        : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                                    }`}
                                  >
                                    {part.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
