import { useState } from 'react'
import { motion } from 'motion/react'
import { Send, Star, ThumbsUp, MessageSquare, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * FeedbackPage - Customer Feedback System
 * Features:
 * - Send feedback/ratings
 * - View feedback history
 * - Rate products and services
 */
export function FeedbackPage() {
  const { isAuthenticated, user, openLogin } = useAuth()
  const [feedbackType, setFeedbackType] = useState('general')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [feedbackHistory, setFeedbackHistory] = useState([])

  const feedbackTypes = [
    { id: 'general', label: 'General Feedback', icon: MessageSquare },
    { id: 'product', label: 'Product Feedback', icon: Star },
    { id: 'service', label: 'Service Feedback', icon: ThumbsUp },
    { id: 'suggestion', label: 'Suggestion', icon: MessageSquare },
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!isAuthenticated) {
      openLogin(handleSubmit)
      return
    }

    if (rating === 0) {
      alert('Please select a rating')
      return
    }

    if (!subject.trim() || !message.trim()) {
      alert('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)

    try {
      // Simulated API call
      const newFeedback = {
        id: `FB-${Date.now()}`,
        userId: user?.id || 'guest',
        userName: user?.name ? `${user.name.firstName} ${user.name.lastName}` : user?.email,
        type: feedbackType,
        subject: subject.trim(),
        message: message.trim(),
        rating,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }

      // Store in localStorage for demo
      const stored = JSON.parse(localStorage.getItem('cosmoscraft_feedback') || '[]')
      stored.unshift(newFeedback)
      localStorage.setItem('cosmoscraft_feedback', JSON.stringify(stored.slice(0, 50)))

      // Update history
      setFeedbackHistory(prev => [newFeedback, ...prev])
      
      setSubmitted(true)
      setSubject('')
      setMessage('')
      setRating(0)
      
      // Reset success message after 3 seconds
      setTimeout(() => setSubmitted(false), 3000)
    } catch (error) {
      console.error('Failed to submit feedback:', error)
      alert('Failed to submit feedback. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStars = () => {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={`w-8 h-8 transition-colors ${
                star <= (hoverRating || rating)
                  ? 'fill-[var(--gold-primary)] text-[var(--gold-primary)]'
                  : 'text-[var(--text-muted)]'
              }`}
            />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-24 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">Send Feedback</h1>
          <p className="text-[var(--text-muted)]">
            Help us improve by sharing your thoughts
          </p>
        </motion.div>

        {/* Feedback Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit}
          className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8 space-y-6"
        >
          {/* Success Message */}
          {submitted && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-center">
              Thank you for your feedback! We appreciate your input.
            </div>
          )}

          {/* Feedback Type */}
          <div>
            <label className="block text-sm font-semibold text-white mb-3">
              Feedback Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {feedbackTypes.map((type) => {
                const Icon = type.icon
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFeedbackType(type.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 ${
                      feedbackType === type.id
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]'
                        : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{type.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm font-semibold text-white mb-3">
              Rating *
            </label>
            <div className="flex items-center gap-4">
              {renderStars()}
              <span className="text-sm text-[var(--text-muted)]">
                {rating > 0 ? `${rating}/5` : 'Select rating'}
              </span>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Subject *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your feedback"
              className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Message *
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us more about your experience..."
              rows={5}
              className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-transparent transition-all duration-200 resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-8 py-4 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-[var(--text-dark)]/30 border-t-[var(--text-dark)] rounded-full animate-spin"></div>
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Feedback
              </>
            )}
          </button>
        </motion.form>

        {/* Feedback History */}
        {feedbackHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <h2 className="text-xl font-bold text-white mb-4">Your Recent Feedback</h2>
            <div className="space-y-4">
              {feedbackHistory.slice(0, 5).map((fb) => (
                <div
                  key={fb.id}
                  className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-medium text-[var(--gold-primary)] uppercase">
                        {fb.type}
                      </span>
                      <h3 className="text-white font-semibold">{fb.subject}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < fb.rating
                              ? 'fill-[var(--gold-primary)] text-[var(--gold-primary)]'
                              : 'text-[var(--text-muted)]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[var(--text-muted)] text-sm mb-2">{fb.message}</p>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <Clock className="w-3 h-3" />
                    {new Date(fb.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default FeedbackPage
