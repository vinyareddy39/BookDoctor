package com.sosride.app.service

import android.accessibilityservice.AccessibilityService
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.sosride.app.state.SosStateManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * SosAccessibilityService automates the Uber ride confirmation workflow
 * during an active SOS emergency.
 *
 * Scoped strictly to "com.ubercab" in accessibility_service_config.xml.
 */
class SosAccessibilityService : AccessibilityService() {

    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())
    private var lastActionTimestamp = 0L
    private var isProcessing = false

    companion object {
        private const val TAG = "SosAccessibilityService"
        private const val ACTION_COOLDOWN_MS = 900L // Prevent duplicate rapid taps while screen transitions

        /* =========================================================================================
         * UBER UI KEYWORD CONFIGURATION
         * ========================================================================================= */

        // 1. FINAL SUCCESS CONFIRMATION STRINGS
        val CONFIRMATION_INDICATOR_KEYWORDS = listOf(
            "finding your ride",
            "connecting to a driver",
            "looking for nearby drivers",
            "driver is on the way",
            "arriving in",
            "meet at pickup",
            "meet driver",
            "driver assigned",
            "cancel ride",
            "share trip status",
            "on the way to"
        )

        // 2. PRIMARY BOOKING / CONFIRMATION BUTTONS
        val PRIMARY_CONFIRM_BUTTON_KEYWORDS = listOf(
            "confirm ubergo",
            "confirm uber go",
            "confirm auto",
            "confirm uber auto",
            "confirm moto",
            "confirm uber moto",
            "confirm uberx",
            "confirm uber x",
            "confirm ride",
            "choose ubergo",
            "choose uber go",
            "choose auto",
            "choose moto",
            "choose uberx",
            "choose comfort",
            "request ubergo",
            "request uber",
            "request ride",
            "confirm pickup",
            "confirm location",
            "book ubergo",
            "book auto",
            "book ride",
            "book now",
            "confirm",
            "request",
            "book"
        )

        // 3. INTERMEDIATE / MODAL / DIALOG BUTTONS (Auto-tappable)
        val INTERMEDIATE_MODAL_KEYWORDS = listOf(
            "confirm pickup spot",
            "confirm pick-up",
            "confirm pickup",
            "set pickup point",
            "set pickup location",
            "ready to go",
            "got it",
            "understand",
            "continue",
            "done",
            "skip",
            "ok",
            "next"
        )

        // 4. USER CONSENT OR PAYMENT ACTION KEYWORDS
        // Automation never taps these. Instead, it alerts the user with high importance + vibration.
        val USER_CONSENT_OR_PAYMENT_KEYWORDS = listOf(
            "i agree",
            "confirm payment",
            "accept higher fare",
            "pay with cash",
            "select payment",
            "personal profile"
        )

        // 5. PREFERRED EMERGENCY RIDE TIERS (Cheapest / Fastest)
        val PREFERRED_RIDE_TIER_KEYWORDS = listOf(
            "ubergo",
            "uber go",
            "auto",
            "uber auto",
            "moto",
            "uber moto",
            "uberx",
            "uber x",
            "comfort"
        )

        // Single words that require exact full-label equality
        val EXACT_FULL_LABEL_KEYWORDS = setOf("ok", "done", "continue", "request", "book")

        /**
         * Keyword matcher:
         * - Exact full-label equality ONLY for "ok", "done", "continue", "request", "book"
         * - Whole-word matching (\b...\b) for everything else (e.g. tier keywords: ubergo, auto, moto, uberx, comfort, next)
         */
        fun matchesKeyword(text: String, keyword: String): Boolean {
            val target = keyword.lowercase().trim()
            val cleanText = text.lowercase().trim()

            // Exact full-label equality ONLY for the 5 specified single words:
            if (EXACT_FULL_LABEL_KEYWORDS.contains(target)) {
                return cleanText == target
            }

            // Whole-word regex matching for all other keywords and phrases
            val regex = Regex("\\b${Regex.escape(target)}\\b", RegexOption.IGNORE_CASE)
            return regex.containsMatchIn(cleanText)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i(TAG, "SosAccessibilityService CONNECTED and active for package: com.ubercab")
        SosStateManager.addLog("Accessibility Service initialized for Uber automation.")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        // SAFETY GATE: Only automate when SOS is actively running!
        if (!SosStateManager.isSosActive) {
            return
        }

        // Only process com.ubercab events
        val packageName = event.packageName?.toString()
        if (packageName != "com.ubercab") {
            return
        }

        val eventType = event.eventType
        if (eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
            eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
        ) {
            return
        }

        val currentTime = System.currentTimeMillis()
        if (currentTime - lastActionTimestamp < ACTION_COOLDOWN_MS || isProcessing) {
            return
        }

        serviceScope.launch {
            processUberScreen()
        }
    }

    private suspend fun processUberScreen() {
        isProcessing = true
        try {
            val rootNode = rootInActiveWindow ?: return
            try {
                delay(250L) // Settle delay

                // STEP 1: CHECK FOR SUCCESS / DRIVER ASSIGNED
                val confirmedText = findConfirmationIndicator(rootNode)
                if (confirmedText != null) {
                    Log.d(TAG, "SUCCESS! Booking confirmed by keyword: '$confirmedText'")
                    SosStateManager.onBookingConfirmed("Ride booked successfully. Driver search/dispatch underway.")
                    return
                }

                // STEP 2: CHECK FOR SCREENS REQUIRING USER CONSENT / PAYMENT (Do NOT auto-tap)
                val userConsentNode = findNodeByKeywords(rootNode, USER_CONSENT_OR_PAYMENT_KEYWORDS)
                if (userConsentNode != null) {
                    val label = getNodeTextOrDescription(userConsentNode)
                    Log.w(TAG, "Screen requires manual user action: '$label'. Alerting user via high-importance notification.")
                    SosStateManager.onAccessibilityAction("Uber needs you to tap '$label'")
                    SosForegroundService.updateAlertNotification(this@SosAccessibilityService, "Uber needs you to tap '$label'")
                    return
                }

                // STEP 3: CHECK FOR INTERMEDIATE / MODAL CONFIRMATIONS
                val intermediateButton = findNodeByKeywords(rootNode, INTERMEDIATE_MODAL_KEYWORDS)
                if (intermediateButton != null) {
                    val buttonText = getNodeTextOrDescription(intermediateButton)
                    Log.d(TAG, "Found intermediate dialog button: '$buttonText'. Tapping...")
                    SosStateManager.onAccessibilityAction("Handling dialog: '$buttonText'")
                    if (performClickOnNodeOrParent(intermediateButton)) {
                        lastActionTimestamp = System.currentTimeMillis()
                        return
                    }
                }

                // STEP 4: CHECK FOR PRIMARY CONFIRM / REQUEST / BOOK BUTTON
                val confirmButton = findNodeByKeywords(rootNode, PRIMARY_CONFIRM_BUTTON_KEYWORDS)
                if (confirmButton != null) {
                    val buttonText = getNodeTextOrDescription(confirmButton)
                    Log.d(TAG, "Found primary booking button: '$buttonText'. Tapping...")
                    SosStateManager.onAccessibilityAction("Tapping booking button: '$buttonText'")
                    if (performClickOnNodeOrParent(confirmButton)) {
                        lastActionTimestamp = System.currentTimeMillis()
                        return
                    }
                }

                // STEP 5: CHECK IF WE NEED TO SELECT A PREFERRED RIDE TIER
                val rideTierNode = findNodeByKeywords(rootNode, PREFERRED_RIDE_TIER_KEYWORDS)
                if (rideTierNode != null) {
                    val tierText = getNodeTextOrDescription(rideTierNode)
                    Log.d(TAG, "Found preferred ride tier option: '$tierText'. Selecting...")
                    SosStateManager.onAccessibilityAction("Selecting ride tier: '$tierText'")
                    if (performClickOnNodeOrParent(rideTierNode)) {
                        lastActionTimestamp = System.currentTimeMillis()
                        return
                    }
                }

                Log.v(TAG, "Screen scanned; waiting for interactive booking elements to render...")

            } finally {
                rootNode.recycle()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error while processing Uber screen: ${e.message}", e)
        } finally {
            isProcessing = false
        }
    }

    private fun findConfirmationIndicator(root: AccessibilityNodeInfo): String? {
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)

        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            val text = getNodeTextOrDescription(node).lowercase().trim()
            if (text.isNotBlank()) {
                for (keyword in CONFIRMATION_INDICATOR_KEYWORDS) {
                    if (matchesKeyword(text, keyword)) {
                        return keyword
                    }
                }
            }
            for (i in 0 until node.childCount) {
                val child = node.getChild(i)
                if (child != null) queue.add(child)
            }
        }
        return null
    }

    private fun findNodeByKeywords(
        root: AccessibilityNodeInfo,
        keywords: List<String>
    ): AccessibilityNodeInfo? {
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)

        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()

            val text = getNodeTextOrDescription(node).lowercase().trim()
            if (text.isNotBlank()) {
                for (keyword in keywords) {
                    if (matchesKeyword(text, keyword)) {
                        val clickableNode = findClickableTarget(node)
                        if (clickableNode != null) {
                            return clickableNode
                        }
                    }
                }
            }

            for (i in 0 until node.childCount) {
                val child = node.getChild(i)
                if (child != null) {
                    queue.add(child)
                }
            }
        }

        return null
    }

    /**
     * Traverses upward to find the closest clickable ancestor.
     * Uses isClickable ONLY (isEnabled removed).
     * Limits search to 3 levels max, and never clicks a node that has more than 3 children.
     */
    private fun findClickableTarget(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        var current: AccessibilityNodeInfo? = node
        var depth = 0
        while (current != null && depth < 3) {
            if (current.childCount <= 3 && current.isClickable) {
                return current
            }
            current = current.parent
            depth++
        }
        return if (node.childCount <= 3 && node.isClickable) node else null
    }

    /**
     * Performs an accessibility click on the node or its parents up to 3 levels deep.
     * Handles null node safely.
     * Never clicks a node with more than 3 children, and requires isClickable.
     */
    private fun performClickOnNodeOrParent(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false
        var current: AccessibilityNodeInfo? = node
        var depth = 0
        while (current != null && depth < 3) {
            if (current.childCount <= 3 && current.isClickable && current.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                Log.d(TAG, "ACTION_CLICK successfully executed on ${current.className} at depth $depth")
                return true
            }
            current = current.parent
            depth++
        }
        return false
    }

    private fun getNodeTextOrDescription(node: AccessibilityNodeInfo): String {
        val text = node.text?.toString() ?: ""
        if (text.isNotBlank()) return text
        return node.contentDescription?.toString() ?: ""
    }

    override fun onInterrupt() {
        Log.w(TAG, "SosAccessibilityService interrupted.")
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        Log.i(TAG, "SosAccessibilityService destroyed.")
    }
}
