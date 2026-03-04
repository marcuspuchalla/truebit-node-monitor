<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <!-- Header Banner -->
    <div class="community-header-banner mb-6">
      <div class="flex items-start gap-3">
        <span class="text-amber-400 text-2xl">⚠</span>
        <div>
          <h2 class="text-amber-400 font-bold text-lg uppercase tracking-widest">Community Statement</h2>
          <p class="text-amber-300/70 text-sm mt-1">
            An open letter from the TrueBit community — published {{ publishedDate }}
          </p>
        </div>
      </div>
    </div>

    <!-- Open Letter -->
    <div class="letter-card">
      <div class="letter-meta">
        <div class="letter-label">OPEN LETTER</div>
        <div class="letter-date">{{ publishedDate }}</div>
      </div>

      <h1 class="letter-title">To the TrueBit Team and Jason Teutsch</h1>

      <div class="letter-body">
        <p>
          We are writing on behalf of members of the TrueBit community — people who have invested not only capital
          but significant time, expertise, and trust in this project.
        </p>

        <p>
          Many of us have professional backgrounds working with large-scale institutions and organizations where
          incidents, setbacks, and delays are not uncommon. We understand that building in this space is hard.
          What we do not understand — and what we cannot accept — is silence.
        </p>

        <p>
          From where we stand, the TrueBit team's communication with its community has fallen well below any
          reasonable professional standard. Requests for information have gone unanswered. Legal inquiries have
          received no response. Updates, when they appear at all, are sparse and offer no meaningful clarity to
          those who are waiting and watching.
        </p>

        <p>
          In our collective experience, this level of non-communication is not just unusual — it is genuinely
          unprecedented. Incidents happen. Delays happen. What defines a team's integrity is not whether things
          go wrong, but how they respond when they do.
        </p>

        <p>
          We are aware that there appears to be continued coordination around a publishing timeline in connection
          with the DAC team. That is noted. But in the absence of transparent, regular communication, your
          community is left to interpret silence — and silence, in this context, reads as abandonment.
        </p>

        <p>
          Users are holding losses. Questions are going unanswered. Trust, once eroded, is extraordinarily
          difficult to rebuild.
        </p>

        <p>
          We are not asking for perfection. We are asking for basic respect — the kind that any community of
          stakeholders deserves. A brief, honest update is infinitely better than continued silence.
        </p>

        <p class="letter-closing-statement">
          If TrueBit intends to have a future, that future begins with communication. We urge Jason Teutsch
          and the broader team to break the silence now, before what little goodwill remains is gone entirely.
        </p>

        <div class="letter-signature">
          <div class="signature-line">— The TrueBit Community</div>
          <div class="signature-platform">Published on <a href="https://tru.watch" class="signature-link">tru.watch</a></div>
        </div>
      </div>
    </div>

    <!-- Back link -->
    <div class="mt-8">
      <router-link to="/" class="back-link">← Back to Network Overview</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
const publishedDate = 'March 4, 2026';
</script>

<style scoped>
.community-header-banner {
  background: linear-gradient(135deg, #451a03 0%, #78350f 50%, #451a03 100%);
  border: 1px solid #d97706;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  box-shadow: 0 0 15px rgba(217, 119, 6, 0.25);
}

.letter-card {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(217, 119, 6, 0.3);
  border-radius: 0.75rem;
  padding: 2.5rem;
  box-shadow: 0 0 30px rgba(217, 119, 6, 0.08);
}

.letter-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(217, 119, 6, 0.2);
}

.letter-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #d97706;
  text-transform: uppercase;
}

.letter-date {
  font-size: 0.75rem;
  color: #64748b;
}

.letter-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #fbbf24;
  margin-bottom: 2rem;
  line-height: 1.3;
}

.letter-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.letter-body p {
  color: #cbd5e1;
  line-height: 1.75;
  font-size: 0.95rem;
}

.letter-closing-statement {
  color: #e2e8f0 !important;
  font-weight: 500;
  border-left: 3px solid #d97706;
  padding-left: 1rem;
}

.letter-signature {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(217, 119, 6, 0.2);
}

.signature-line {
  font-size: 1rem;
  font-weight: 600;
  color: #fbbf24;
  margin-bottom: 0.25rem;
}

.signature-platform {
  font-size: 0.8rem;
  color: #64748b;
}

.signature-link {
  color: #00d4ff;
  text-decoration: none;
}

.signature-link:hover {
  text-decoration: underline;
}

.back-link {
  color: #64748b;
  text-decoration: none;
  font-size: 0.85rem;
  transition: color 0.2s;
}

.back-link:hover {
  color: #00d4ff;
}
</style>
