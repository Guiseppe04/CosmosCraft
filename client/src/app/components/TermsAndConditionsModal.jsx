import { motion, AnimatePresence } from 'motion/react'

export default function TermsAndConditionsModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-light)] shadow-2xl"
        >
          {/* Header */}
          <div className="border-b border-[var(--border)] px-6 py-5 flex justify-between items-center">
            <div>
              <h3 className="mt-2 text-2xl font-bold text-[var(--text-light)]">
                Custom Build Terms and Conditions
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] p-2.5 text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--bg-primary)] hover:text-[var(--text-light)]"
            >
              X
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[70vh] overflow-y-auto px-6 py-6 space-y-5 text-sm text-[var(--text-muted)]">
            <div className="rounded-2xl border border-[var(--gold-primary)]/35 bg-[var(--gold-primary)]/10 px-5 py-4">
              <p className="font-semibold text-[var(--text-light)]">
                Please read these terms and conditions carefully before confirming a custom build with
                {' '}<span className="font-bold">CosmosCraft</span>.
              </p>
            </div>

            <section>
              <h4 className="font-bold text-[var(--text-light)]">Specifications Document</h4>
              <p className="mt-2">
                The Specifications Document is compiled from the Custom Build Inquiry form and contains
                the detailed specifications of the instrument. If any detail is not presented in the
                form, the owner may contact us to provide more in-depth specifications.
              </p>
              <p className="mt-2">
                Once the specifications document is quoted with a price, signed, and paid with a
                down-payment, the build will be placed in our production queue.
              </p>
              
            </section>

            <section>
              <h4 className="font-bold text-[var(--text-light)]">Changes in Specs</h4>
              <p className="mt-2">
                The specifications document will serve as the basis for the entire build. Changes in
                specs may or may not be possible depending on the current production stage of the
                instrument.
              </p>
              <p className="mt-2">
                The owner may contact us at any time to request changes or ask whether the requested
                changes are still possible.
              </p>
            </section>

            <section>
              <h4 className="font-bold text-[var(--text-light)]">Payment</h4>
              <p className="mt-2">
                A 50% down-payment of the agreed price, plus the cost of additional purchases for the
                instrument, is required before the instrument is included in the queue. The remaining
                balance must be paid once the instrument is completed and ready for shipment.
              </p>
              <p className="mt-2">
                Additional purchases include materials, accessories, or services that we do not have or
                do not offer. This may include specific machine heads, strings, top/back/side woods, or
                services such as laser engraving or pyrography.
              </p>
              
              
            </section>

            <section>
              <h4 className="font-bold text-[var(--text-light)]">Progress Photos</h4>
              <p className="mt-2">
                Build progress photos will be provided throughout the build process. The owner may also
                request high-definition photos of the guitar once final shots are completed.
              </p>
            </section>

            <section>
              <h4 className="font-bold text-[var(--text-light)]">Owner-Supplied Materials</h4>
              <p className="mt-2">
                We accept owner-supplied materials such as wood for the top, back, and sides; purflings;
                machine heads; strings; and similar items. However, we are not liable for any issues
                related to owner-supplied materials, and these are not covered by our warranty.
              </p>
              <p className="mt-2">
                For warranty-related questions, please contact CosmosCraft support directly.
              </p>
            </section>

            <section>
              <h4 className="font-bold text-[var(--text-light)]">Risk of Loss and Damage During Shipment</h4>
              <p className="mt-2">
                All items purchased from CosmosCraft are made pursuant to a shipment
                contract. This means that the risk of loss and damage during shipment, as well as title
                for such items, pass to the owner upon our delivery to the carrier.
              </p>
            </section>

            <section>
              <h4 className="font-bold text-[var(--text-light)]">Applicable Law</h4>
              <p className="mt-2">
                By using this site and confirming a custom build, you agree that the laws of the
                Philippines, without regard to conflict of law principles, will govern these terms and
                conditions and any dispute that may arise between you and CosmosCraft, including its
                business partners and associates.
              </p>
            </section>

            <section>
              <h4 className="font-bold text-[var(--text-light)]">Disputes</h4>
              <p className="mt-2">
                Any dispute related in any way to products purchased from us shall be arbitrated by the
                courts in the Philippines, and you consent to the exclusive jurisdiction and venue of
                such courts.
              </p>
            </section>

            <section>
              <h4 className="font-bold text-[var(--text-light)]">Site Policies, Modification, and Severability</h4>
              <p className="mt-2">
                Please review our other policies, such as our Privacy Policy and Returns Policy, posted
                on this site. We reserve the right to make changes to our site, policies, and these
                terms and conditions at any time.
              </p>
              <p className="mt-2">
                If any provision of these terms is deemed invalid, void, or unenforceable for any
                reason, that provision shall be considered severable and shall not affect the validity
                and enforceability of the remaining provisions.
              </p>
            </section>

            <section>
              <h4 className="font-bold text-[var(--text-light)]">Questions</h4>
              <p className="mt-2">
                Questions regarding our Terms and Conditions, Privacy Policy, Return Policy, or other
                policy-related material may be directed to our support staff through the Contact Us page
                or by email.
              </p>
              <a
                href="mailto:cosmosguitars@gmail.com"
                className="mt-2 inline-block text-[var(--gold-primary)] underline decoration-[var(--gold-secondary)] underline-offset-4 hover:text-[var(--gold-secondary)]"
              >
                cosmosguitars@gmail.com
              </a>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
              <h4 className="font-bold text-[var(--text-light)]">Summary</h4>
              <p className="mt-2">
                By proceeding with a custom build, you acknowledge that the approved specifications
                document, payment terms, production limitations, owner-supplied material policy, and
                shipment risk terms above will apply to your order.
              </p>
            </section>
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border)] bg-[var(--surface-elevated)] px-6 py-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-[var(--text-light)] transition-colors hover:bg-[var(--bg-primary)]"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
