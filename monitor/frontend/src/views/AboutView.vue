<template>
  <div class="space-y-6">
    <div class="card">
      <!-- What This Monitor Is For -->
      <div class="mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">What This Monitor Is For</h2>
        <div class="space-y-4 text-sm text-gray-700">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span class="text-blue-600 font-bold">1</span>
            </div>
            <div>
              <p class="font-semibold text-gray-900">Network Statistics</p>
              <p>See how many TrueBit nodes are currently online and how many tasks are being processed across the network.</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span class="text-green-600 font-bold">2</span>
            </div>
            <div>
              <p class="font-semibold text-gray-900">Monitor Your Node</p>
              <p>Keep an eye on your own TrueBit node to make sure it's running without problems - track tasks, invoices, and logs.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- How It Works -->
      <div class="mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">How It Works</h2>
        <div class="space-y-2 text-sm text-gray-700">
          <p>
            This monitor connects to your Docker daemon with <strong>read-only access</strong> to:
          </p>
          <ol class="list-decimal ml-5 space-y-2">
            <li>
              <strong>Read log files</strong> from the TrueBit node container
            </li>
            <li>
              <strong>Read task/invoice data</strong> from the EventDB
            </li>
            <li>
              <strong>Display</strong> this information in an easy-to-read dashboard
            </li>
          </ol>
          <p class="mt-4 font-semibold">
            All data stays on your local server unless you opt into federation.
          </p>
        </div>
      </div>

      <!-- Not Affiliated Notice -->
      <div class="bg-gray-50 p-4 rounded border border-gray-200">
        <p class="text-sm text-gray-600 text-center">
          This is an <strong>independent, community-developed</strong> tool and is not affiliated with TrueBit Foundation or any official TrueBit entities.
        </p>
      </div>

      <!-- Version & GitHub -->
      <div class="border-t pt-6 mt-6 flex items-center justify-between">
        <p class="text-xs text-gray-500">
          TrueBit Monitor v0.0.1
        </p>
        <a
          href="https://github.com/marcuspuchalla/truebit-node-monitor"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
          title="View on GitHub"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd" />
          </svg>
          <span class="text-sm">GitHub</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
// No script needed for static content
</script>
