<template>
  <div class="shutdown-page">
    <div class="shutdown-container">

      <!-- Service Status -->
      <div class="status-badge">
        <span class="status-dot"></span>
        SERVICE TERMINATED
      </div>

      <!-- Site Name -->
      <div class="site-name">tru.watch</div>

      <!-- Main Shutdown Message -->
      <div class="shutdown-card">
        <h1 class="shutdown-title">This service has shut down.</h1>
        <p class="shutdown-subtitle">
          March 23, 2026
        </p>

        <div class="message-body">
          <p>
            After months of waiting, hoping, and advocating for the TrueBit community, we have made the decision
            to permanently shut down tru.watch — the independent community monitoring service for the TrueBit network.
          </p>
          <p>
            This decision was not made lightly. It was made inevitable by one thing: the complete and total failure
            of the TrueBit team to communicate with the community they built their project upon.
          </p>
          <p>
            Following a <strong>$26 million security incident</strong>, the TrueBit team went silent. Legal inquiries
            received no response. Community requests were ignored. Stakeholders were left holding losses with no
            acknowledgment, no timeline, and no accountability. In our experience working with multimillion-dollar
            organizations — organizations that handle real crises — we have never witnessed anything close to this
            level of disregard for the people who trusted in a project.
          </p>
          <p>
            From the outside, TrueBit appears to be effectively dead. The occasional note, the vague alignment
            with DAC team timelines — none of it constitutes communication. None of it is enough.
          </p>
          <p>
            This is not what we expected. This is not what the community deserved.
          </p>
        </div>
      </div>

      <!-- Class Action Block -->
      <div class="action-card">
        <div class="action-card-header">
          <span class="action-icon">⚖</span>
          <span class="action-label">Class Action Pre-Registration</span>
        </div>
        <p class="action-text">
          If you have been affected by the TrueBit security incident and wish to explore your legal options,
          a class action pre-registration is now available.
        </p>
        <a href="https://truebitstats.io" target="_blank" rel="noopener noreferrer" class="action-button">
          Register at TrueBitStats.io
          <span class="action-arrow">→</span>
        </a>
      </div>

      <!-- Final Words to TrueBit -->
      <div class="final-words-card">
        <div class="final-words-label">A Final Word — To Jason Teutsch and the TrueBit Team</div>
        <div class="final-words-body">
          <p>
            You had everything. A dedicated community. A compelling technology. People who believed in what you
            were building and who waited patiently, even as circumstances grew darker.
          </p>
          <p>
            All it would have taken was a single post. One message. One sentence to let the community know
            you were still there — that you cared. That is all. Nothing more.
          </p>
          <p>
            What you chose instead was silence. And that silence says everything.
          </p>
          <p>
            This is not a failure of technology. This is a failure of leadership, of character, and of the
            basic professional obligation that every project founder owes to the community they invite to
            trust in them. For a person of your academic standing and professional reputation, this conduct
            is a disgrace — and it will not be forgotten. It will always be part of the record of this project.
          </p>
          <p class="final-line">
            tru.watch was proud to provide an additional layer of value to the TrueBit network.
            That work is now done. This service will not return.
          </p>
        </div>
      </div>

      <!-- Community Statement Link -->
      <div class="statement-link-block">
        <router-link to="/community-statement" class="statement-link">
          Read the full Community Statement →
        </router-link>
      </div>

      <!-- Footer -->
      <div class="page-footer">
        tru.watch — Independent Community Tool, not affiliated with TrueBit Foundation<br />
        <span class="footer-dim">Service terminated March 23, 2026</span>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.shutdown-page {
  min-height: 100vh;
  background: #050810;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 3rem 1rem 4rem;
  font-family: 'JetBrains Mono', 'Fira Mono', 'Courier New', monospace;
}

.shutdown-container {
  max-width: 760px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

/* Status badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: #ef4444;
  text-transform: uppercase;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 6px #ef4444;
}

/* Site name */
.site-name {
  font-size: 2.25rem;
  font-weight: 700;
  color: #00d4ff;
  letter-spacing: 0.05em;
  text-shadow: 0 0 20px rgba(0, 212, 255, 0.4);
}

/* Main shutdown card */
.shutdown-card {
  background: rgba(10, 15, 26, 0.9);
  border: 1px solid rgba(100, 116, 139, 0.25);
  border-radius: 0.5rem;
  padding: 2rem;
}

.shutdown-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 0.25rem;
}

.shutdown-subtitle {
  font-size: 0.75rem;
  color: #475569;
  margin-bottom: 1.5rem;
  letter-spacing: 0.05em;
}

.message-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message-body p {
  font-size: 0.9rem;
  color: #94a3b8;
  line-height: 1.8;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.message-body strong {
  color: #fbbf24;
  font-weight: 600;
}

/* Class action card */
.action-card {
  background: rgba(5, 46, 22, 0.6);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.06);
}

.action-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.action-icon {
  font-size: 1.1rem;
  color: #22c55e;
}

.action-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #22c55e;
  text-transform: uppercase;
}

.action-text {
  font-size: 0.85rem;
  color: #86efac;
  line-height: 1.7;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  margin-bottom: 1.25rem;
}

.action-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.25rem;
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.5);
  border-radius: 0.375rem;
  color: #22c55e;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
  letter-spacing: 0.02em;
}

.action-button:hover {
  background: rgba(34, 197, 94, 0.25);
  box-shadow: 0 0 15px rgba(34, 197, 94, 0.2);
}

.action-arrow {
  transition: transform 0.2s;
}

.action-button:hover .action-arrow {
  transform: translateX(3px);
}

/* Final words card */
.final-words-card {
  background: rgba(10, 15, 26, 0.9);
  border: 1px solid rgba(217, 119, 6, 0.2);
  border-radius: 0.5rem;
  padding: 2rem;
}

.final-words-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #d97706;
  text-transform: uppercase;
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(217, 119, 6, 0.15);
}

.final-words-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.final-words-body p {
  font-size: 0.9rem;
  color: #94a3b8;
  line-height: 1.8;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.final-line {
  color: #cbd5e1 !important;
  font-style: italic;
  border-left: 3px solid #d97706;
  padding-left: 1rem;
  margin-top: 0.5rem;
}

/* Statement link */
.statement-link-block {
  text-align: center;
}

.statement-link {
  color: #00d4ff;
  text-decoration: none;
  font-size: 0.85rem;
  letter-spacing: 0.03em;
  transition: color 0.2s, text-shadow 0.2s;
}

.statement-link:hover {
  color: #67e8f9;
  text-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
}

/* Footer */
.page-footer {
  text-align: center;
  font-size: 0.7rem;
  color: #334155;
  line-height: 1.7;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(30, 41, 59, 0.5);
}

.footer-dim {
  color: #1e293b;
}
</style>
