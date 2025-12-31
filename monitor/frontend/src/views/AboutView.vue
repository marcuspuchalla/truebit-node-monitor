<template>
  <div class="space-y-6">
    <div class="card">
      <!-- What This Monitor Is For -->
      <div class="mb-8">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400 mb-3">What This Monitor Is For</h2>
        <div class="space-y-4 text-sm text-gray-700 dark:text-slate-300">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-cyan-900/40 rounded-full flex items-center justify-center">
              <span class="text-blue-600 dark:text-cyan-400 font-bold">1</span>
            </div>
            <div>
              <p class="font-semibold text-gray-900 dark:text-slate-100">Network Statistics</p>
              <p>See how many TrueBit nodes are currently online and how many tasks are being processed across the network.</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center">
              <span class="text-green-600 dark:text-emerald-400 font-bold">2</span>
            </div>
            <div>
              <p class="font-semibold text-gray-900 dark:text-slate-100">Monitor Your Node</p>
              <p>Keep an eye on your own TrueBit node to make sure it's running without problems - track tasks, invoices, and logs.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- How It Works -->
      <div class="mb-8">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400 mb-3">How It Works</h2>
        <div class="space-y-2 text-sm text-gray-700 dark:text-slate-300">
          <p>
            This monitor connects to your Docker daemon with <strong class="dark:text-slate-100">read-only access</strong> to:
          </p>
          <ol class="list-decimal ml-5 space-y-2">
            <li>
              <strong class="dark:text-slate-100">Read log files</strong> from the TrueBit node container
            </li>
            <li>
              <strong class="dark:text-slate-100">Read task/invoice data</strong> from the EventDB
            </li>
            <li>
              <strong class="dark:text-slate-100">Display</strong> this information in an easy-to-read dashboard
            </li>
          </ol>
          <p class="mt-4 font-semibold dark:text-slate-100">
            All data stays on your local server unless you opt into federation.
          </p>
        </div>
      </div>

      <!-- Security Notice for Node Operators -->
      <div class="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded">
        <h2 class="text-lg font-semibold text-amber-900 dark:text-amber-400 mb-3">Security Notice for Node Operators</h2>
        <div class="space-y-3 text-sm text-amber-800 dark:text-amber-200/90">
          <p>
            <strong class="dark:text-amber-300">By using this software, you acknowledge and accept full responsibility for any risks associated with running it on your systems.</strong>
          </p>
          <p>
            <strong class="dark:text-amber-300">Only use the official repository:</strong> Always download and run this software exclusively from the official GitHub repository linked below. Do not use forks, clones, or modified versions from untrusted sources.
          </p>
          <p>
            <strong class="dark:text-amber-300">No liability for third-party modifications:</strong> The author accepts no responsibility for any damages, data loss, security breaches, or other issues caused by running software obtained from sources other than the official repository. Modified versions may contain malicious code or backdoors.
          </p>
          <p>
            <strong class="dark:text-amber-300">Verify before you trust:</strong> This is open source software - you can and should review the code before running it. If you cannot verify the code yourself, only use the official repository.
          </p>
        </div>
      </div>

      <!-- Disclaimer -->
      <div class="mb-8 p-4 bg-gray-100 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-600/50 rounded">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3">Disclaimer & License</h2>
        <div class="space-y-3 text-xs text-gray-700 dark:text-slate-400">
          <p>
            This software is provided <strong class="dark:text-slate-200">"AS IS"</strong>, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement.
          </p>
          <p>
            In no event shall the author be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.
          </p>
          <p>
            This is an <strong class="dark:text-slate-200">independent open source project</strong> developed by a private individual, not a company or organization. It is not affiliated with, endorsed by, or connected to TrueBit Foundation or any official TrueBit entities.
          </p>
          <p>
            By using this software, you agree to these terms and accept all risks associated with running third-party software on your systems.
          </p>
          <p class="pt-2">
            Licensed under the <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-cyan-400 hover:underline">GNU General Public License v3.0</a>
          </p>
        </div>
      </div>

      <!-- Not Affiliated Notice -->
      <div class="bg-gray-50 dark:bg-slate-800/30 p-4 rounded border border-gray-200 dark:border-slate-600/50">
        <p class="text-sm text-gray-600 dark:text-slate-400 text-center">
          This is an <strong class="dark:text-slate-200">independent, community-developed</strong> tool and is not affiliated with TrueBit Foundation or any official TrueBit entities.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
// No script needed for static content
</script>
