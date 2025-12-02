<template>
  <div class="space-y-6">
    <div class="card">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">About TrueBit Monitor</h1>

      <!-- CRITICAL DISCLAIMER -->
      <div class="mb-8 p-6 bg-red-50 border-4 border-red-600 rounded-lg">
        <h2 class="text-2xl font-bold text-red-900 mb-4">⚠️ CRITICAL DISCLAIMER</h2>

        <div class="space-y-4 text-sm text-red-900">
          <div class="bg-red-100 p-4 rounded border-2 border-red-700">
            <p class="font-bold text-lg mb-2">USE AT YOUR OWN RISK</p>
            <p>
              This software is provided "AS IS" without any warranties or guarantees of any kind.
              The authors and contributors are <strong>NOT RESPONSIBLE</strong> for any damages, losses,
              financial losses, security breaches, or issues that may arise from using this software.
            </p>
          </div>

          <div class="bg-red-100 p-4 rounded border-2 border-red-700">
            <p class="font-bold text-lg mb-2">NOT AFFILIATED WITH TRUEBIT</p>
            <p>
              This project is an <strong>INDEPENDENT, COMMUNITY-DEVELOPED</strong> monitoring tool and is
              <strong>NOT officially associated with, endorsed by, or affiliated with TrueBit Foundation,
              TrueBit Company, or any official TrueBit entities</strong>. TrueBit is a trademark of its respective owners.
            </p>
          </div>

          <div class="bg-yellow-50 p-4 rounded border-2 border-yellow-600">
            <p class="font-bold text-yellow-900 mb-2">YOU ARE SOLELY RESPONSIBLE FOR:</p>
            <ul class="list-disc ml-5 space-y-1 text-yellow-900">
              <li>Securing your infrastructure and private keys</li>
              <li>Reviewing the source code before use</li>
              <li>Testing thoroughly before production use</li>
              <li>Any financial losses or damages</li>
              <li>Compliance with all applicable laws</li>
            </ul>
          </div>

          <p class="font-semibold text-center text-base">
            BY USING THIS SOFTWARE, YOU ACKNOWLEDGE ALL RISKS AND ACCEPT FULL RESPONSIBILITY
          </p>
        </div>
      </div>

      <!-- Security Warning -->
      <div class="mb-8 p-4 bg-orange-50 border-l-4 border-orange-500 rounded">
        <h2 class="text-lg font-semibold text-orange-900 mb-3">🔒 Security Considerations</h2>
        <div class="space-y-3 text-sm text-orange-800">

          <p>
            This monitoring application requires <strong>read access to your Docker daemon</strong> and the running TrueBit node container.
            The Docker container running your TrueBit node contains <strong>private keys controlling your TrueBit funds</strong>.
          </p>

          <p class="font-bold text-orange-900">
            🔐 DO NOT use this monitor if you do not trust the developers or have not reviewed the source code.
          </p>

          <div class="bg-red-100 p-3 rounded mt-3">
            <p class="font-semibold mb-2">What this monitor does:</p>
            <ul class="list-disc ml-5 space-y-1">
              <li>Reads log files from your TrueBit node container</li>
              <li>Provides a web interface to view task execution, invoices, and logs</li>
              <li>All processing happens locally on your server</li>
            </ul>
          </div>

          <div class="bg-red-100 p-3 rounded mt-3">
            <p class="font-semibold mb-2">What this monitor does NOT do:</p>
            <ul class="list-disc ml-5 space-y-1">
              <li>Does NOT read your private keys or wallet configuration</li>
              <li>Does NOT send any data to external servers</li>
              <li>Does NOT modify your TrueBit node in any way</li>
              <li>Does NOT have write access to your Docker containers</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Source Code -->
      <div class="mb-8 p-4 bg-green-50 border-l-4 border-green-500 rounded">
        <h2 class="text-lg font-semibold text-green-900 mb-2">📖 Open Source</h2>
        <p class="text-sm text-green-800 mb-3">
          The complete source code for this monitor is available for review. You can inspect every line of code to verify that:
        </p>
        <ul class="list-disc ml-5 text-sm text-green-800 space-y-1 mb-3">
          <li>No private keys are accessed or transmitted</li>
          <li>No data is sent to external servers</li>
          <li>Only log files are read for monitoring purposes</li>
        </ul>
        <p class="text-sm text-green-800 font-semibold">
          ⚠️ ONLY use the official repository. Do not download or run modified versions from untrusted sources.
        </p>
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
              <strong>Read log files</strong> from the TrueBit node container at <code class="bg-gray-100 px-2 py-1 rounded">/app/logs/</code>
            </li>
            <li>
              <strong>Read EventDB</strong> (structured task/invoice data) from <code class="bg-gray-100 px-2 py-1 rounded">/app/build/datadb/</code>
            </li>
            <li>
              <strong>Parse and display</strong> this information in an easy-to-read web interface
            </li>
          </ol>
          <p class="mt-4 font-semibold">
            All data stays on your local server. Nothing is transmitted externally.
          </p>
        </div>
      </div>

      <!-- Technical Details -->
      <div class="mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Technical Details</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div class="bg-gray-50 p-3 rounded">
            <div class="font-semibold text-gray-700 mb-1">Docker Access</div>
            <div class="text-gray-600">Read-only socket mount</div>
          </div>
          <div class="bg-gray-50 p-3 rounded">
            <div class="font-semibold text-gray-700 mb-1">Data Storage</div>
            <div class="text-gray-600">Local SQLite database</div>
          </div>
          <div class="bg-gray-50 p-3 rounded">
            <div class="font-semibold text-gray-700 mb-1">Backend</div>
            <div class="text-gray-600">Node.js + Express + dockerode</div>
          </div>
          <div class="bg-gray-50 p-3 rounded">
            <div class="font-semibold text-gray-700 mb-1">Frontend</div>
            <div class="text-gray-600">Vue 3 + Vite + Tailwind CSS</div>
          </div>
        </div>
      </div>

      <!-- Full Legal Disclaimer -->
      <div class="border-t pt-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Complete Legal Disclaimer</h2>
        <div class="bg-gray-50 p-4 rounded">
          <p class="text-sm text-gray-700 leading-relaxed mb-3">
            This software is provided "AS IS", without warranty of any kind, express or implied.
            The authors assume <strong>NO RESPONSIBILITY</strong> for any damages, losses, financial losses,
            security breaches, or issues that may arise from using this monitoring tool.
          </p>
          <p class="text-sm text-gray-700 leading-relaxed mb-3">
            You are <strong>SOLELY RESPONSIBLE</strong> for securing your server, private keys, funds, and infrastructure.
            By using this monitor, you acknowledge and accept all risks associated with running third-party software
            with access to your Docker environment.
          </p>
          <p class="text-sm text-gray-700 font-semibold">
            For the complete legal disclaimer, see the
            <a href="https://github.com/marcuspuchalla/truebit-node-monitor/blob/main/DISCLAIMER.md"
               target="_blank"
               rel="noopener noreferrer"
               class="text-blue-600 hover:text-blue-800 underline">
              DISCLAIMER.md
            </a> file in the repository.
          </p>
        </div>
      </div>

      <!-- Version & GitHub -->
      <div class="border-t pt-6 mt-6 flex items-center justify-between">
        <p class="text-xs text-gray-500">
          TrueBit Monitor v0.0.1 (Unofficial Community Tool)
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
