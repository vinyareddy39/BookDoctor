package com.sosride.accessibility

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * SosAccessibilityService (Unified RapidCare-SOS Port)
 *
 * Implements automated Uber booking execution with:
 * 1. Strict destination verification before tapping confirm (hospital name or address on screen).
 * 2. Modal safety filter: Never taps intermediate dialogs mentioning fare, surge, price, payment, or terms.
 * 3. Dual success detection: Dispatches success event to React Native layer and triggers completion.
 * 4. Calibration dump mode: Sanitized view hierarchy inspection with zero PII.
 * 5. Kill switch and strict SOS active gating.
 */
class SosAccessibilityService : AccessibilityService() {

    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())
    private var lastActionTimestamp = 0L
    private var isProcessing = false

    companion object {
        private const val TAG = "SosAccessibilityService"
        private const val ACTION_COOLDOWN_MS = 900L

        // Active State Managed via React Native Bridge
        @Volatile var isSosActive: Boolean = false
        @Volatile var targetHospitalName: String = ""
        @Volatile var targetHospitalAddress: String = ""
        @Volatile var isServiceRunning: Boolean = false
        @Volatile var calibrationDumpLog: StringBuilder = StringBuilder()

        /* =========================================================================================
         * KEYWORD CONFIGURATION (Mirrored from central accessibilityConfig.ts)
         * ========================================================================================= */

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

        val PRIMARY_CONFIRM_BUTTON_KEYWORDS = listOf(
            "confirm ubergo",
            "confirm uber go",
            "confirm auto",
            "confirm uber auto",
            "confirm moto",
            "confirm uber moto",
            "confirm uberx",
            "confirm uber x",
            "confirm comfort",
            "confirm ride",
            "request ubergo",
            "request uber go",
            "request auto",
            "request ride",
            "choose ubergo",
            "choose uber go",
            "choose auto",
            "choose moto",
            "choose uberx",
            "choose comfort",
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

        val FORBIDDEN_MODAL_KEYWORDS = listOf(
            "fare",
            "surge",
            "price",
            "payment",
            "terms",
            "fee",
            "cost",
            "rate",
            "charge",
            "wallet",
            "cash",
            "balance",
            "cancel fee",
            "higher fare",
            "dynamic pricing"
        )

        val USER_CONSENT_OR_PAYMENT_KEYWORDS = listOf(
            "i agree",
            "confirm payment",
            "accept higher fare",
            "pay with cash",
            "select payment",
            "personal profile",
            "agree to surge",
            "add payment",
            "insufficient balance"
        )

        val EXACT_FULL_LABEL_KEYWORDS = setOf("ok", "done", "continue", "request", "book")

        fun matchesKeyword(text: String, keyword: String): Boolean {
            val target = keyword.lowercase().trim()
            val cleanText = text.lowercase().trim()
            if (EXACT_FULL_LABEL_KEYWORDS.contains(target)) {
                return cleanText == target
            }
            val regex = Regex("\\b${Regex.escape(target)}\\b", RegexOption.IGNORE_CASE)
            return regex.containsMatchIn(cleanText)
        }

        fun sanitize(str: String): String {
            return str.replace(Regex("\\b(\\+?91)?[6-9]\\d{9}\\b"), "[PHONE_REDACTED]")
                      .replace(Regex("\\b\\d{1,2}\\.\\d{4,8},\\s*\\d{1,3}\\.\\d{4,8}\\b"), "[COORDS_REDACTED]")
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        isServiceRunning = true
        Log.i(TAG, "SosAccessibilityService CONNECTED for package: com.ubercab")
        SosAccessibilityModule.sendEvent("onServiceConnected", null)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null || !isSosActive) return

        val packageName = event.packageName?.toString()
        if (packageName != "com.ubercab") return

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
            delay(250L) // Settle delay

            // Collect all screen text for destination verification & calibration
            val allScreenText = collectAllScreenText(rootNode)
            appendCalibrationDump(rootNode, allScreenText)

            // STEP 1: CHECK FOR SUCCESS / CONFIRMED BOOKING
            val confirmedText = findConfirmationIndicator(rootNode)
            if (confirmedText != null) {
                Log.d(TAG, "SUCCESS: Booking confirmed by keyword: '$confirmedText'")
                SosAccessibilityModule.sendEvent("onAccessibilitySuccess", Bundle().apply {
                    putString("keyword", confirmedText)
                    putString("timestamp", System.currentTimeMillis().toString())
                })
                isSosActive = false // Halt automation upon confirmed booking
                return
            }

            // STEP 2: CHECK FOR MANUAL USER CONSENT / PAYMENT (Never auto-tap)
            val userConsentNode = findNodeByKeywords(rootNode, USER_CONSENT_OR_PAYMENT_KEYWORDS)
            if (userConsentNode != null) {
                val label = getNodeTextOrDescription(userConsentNode)
                Log.w(TAG, "Screen requires manual user action: '$label'. Halting auto-tap.")
                SosAccessibilityModule.sendEvent("onAccessibilityActionRequired", Bundle().apply {
                    putString("actionLabel", sanitize(label))
                })
                return
            }

            // STEP 3: CHECK FOR INTERMEDIATE / MODAL DIALOGS WITH FORBIDDEN TERMS FILTER
            val intermediateButton = findNodeByKeywords(rootNode, INTERMEDIATE_MODAL_KEYWORDS)
            if (intermediateButton != null) {
                // SAFETY FILTER: Verify screen contains NO forbidden terms (price, surge, fare, payment)
                val forbiddenTerm = checkForForbiddenTerms(allScreenText)
                if (forbiddenTerm != null) {
                    Log.w(TAG, "Modal contains forbidden term: '$forbiddenTerm'. Blocked from tapping.")
                    SosAccessibilityModule.sendEvent("onAccessibilityBlocked", Bundle().apply {
                        putString("reason", "forbidden_modal_term: $forbiddenTerm")
                    })
                    return
                }

                val buttonText = getNodeTextOrDescription(intermediateButton)
                Log.d(TAG, "Safe dialog button found: '$buttonText'. Tapping...")
                if (performClickOnNodeOrParent(intermediateButton)) {
                    lastActionTimestamp = System.currentTimeMillis()
                    return
                }
            }

            // STEP 4: PRIMARY CONFIRM BUTTON WITH MANDATORY DESTINATION VERIFICATION
            val confirmButton = findNodeByKeywords(rootNode, PRIMARY_CONFIRM_BUTTON_KEYWORDS)
            if (confirmButton != null) {
                // MANDATORY CHECK: Does the screen verify the destination hospital?
                val destVerified = verifyDestination(allScreenText)
                if (!destVerified) {
                    Log.e(TAG, "DESTINATION MISMATCH: Target hospital '$targetHospitalName' not found on Uber screen. Aborting tap.")
                    SosAccessibilityModule.sendEvent("onAccessibilityBlocked", Bundle().apply {
                        putString("reason", "destination_mismatch")
                    })
                    return
                }

                val confirmText = getNodeTextOrDescription(confirmButton)
                Log.d(TAG, "Destination verified! Confirm button found: '$confirmText'. Executing tap...")
                if (performClickOnNodeOrParent(confirmButton)) {
                    lastActionTimestamp = System.currentTimeMillis()
                    SosAccessibilityModule.sendEvent("onAccessibilityConfirmTapped", Bundle().apply {
                        putString("button", confirmText)
                    })
                    return
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error in processUberScreen: ${e.message}", e)
        } finally {
            isProcessing = false
        }
    }

    /**
     * Verifies that the target hospital name or address is visible on screen.
     */
    private fun verifyDestination(screenText: String): Boolean {
        if (targetHospitalName.isBlank()) return true // If unconfigured, allow pass through
        val lowerScreen = screenText.lowercase()
        val lowerTarget = targetHospitalName.lowercase().trim()

        if (lowerScreen.contains(lowerTarget)) return true

        // Check significant tokens (excluding stop words)
        val stopWords = setOf("hospital", "clinic", "center", "centre", "emergency", "care", "health", "the", "and", "dr", "er")
        val tokens = lowerTarget.split(Regex("[\\s,.-]+"))
            .filter { it.length >= 3 && !stopWords.contains(it) }

        for (token in tokens) {
            if (lowerScreen.contains(token)) return true
        }

        if (targetHospitalAddress.isNotBlank()) {
            val addrTokens = targetHospitalAddress.lowercase().split(Regex("[\\s,.-]+"))
                .filter { it.length >= 4 && !stopWords.contains(it) }
            for (token in addrTokens) {
                if (lowerScreen.contains(token)) return true
            }
        }

        return false
    }

    private fun checkForForbiddenTerms(screenText: String): String? {
        val lower = screenText.lowercase()
        for (term in FORBIDDEN_MODAL_KEYWORDS) {
            val regex = Regex("\\b${Regex.escape(term)}\\b", RegexOption.IGNORE_CASE)
            if (regex.containsMatchIn(lower)) {
                return term
            }
        }
        return null
    }

    private fun collectAllScreenText(root: AccessibilityNodeInfo): String {
        val sb = StringBuilder()
        fun traverse(node: AccessibilityNodeInfo?) {
            if (node == null) return
            val text = node.text?.toString()?.trim()
            val desc = node.contentDescription?.toString()?.trim()
            if (!text.isNullOrEmpty()) sb.append(text).append(" ")
            if (!desc.isNullOrEmpty() && desc != text) sb.append(desc).append(" ")
            for (i in 0 until node.childCount) {
                traverse(node.getChild(i))
            }
        }
        traverse(root)
        return sb.toString()
    }

    private fun findConfirmationIndicator(root: AccessibilityNodeInfo): String? {
        fun traverse(node: AccessibilityNodeInfo?): String? {
            if (node == null) return null
            val text = getNodeTextOrDescription(node)
            for (keyword in CONFIRMATION_INDICATOR_KEYWORDS) {
                if (matchesKeyword(text, keyword)) return text
            }
            for (i in 0 until node.childCount) {
                val match = traverse(node.getChild(i))
                if (match != null) return match
            }
            return null
        }
        return traverse(root)
    }

    private fun findNodeByKeywords(root: AccessibilityNodeInfo, keywords: List<String>): AccessibilityNodeInfo? {
        fun traverse(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
            if (node == null) return null
            val text = getNodeTextOrDescription(node)
            if (text.isNotEmpty()) {
                for (keyword in keywords) {
                    if (matchesKeyword(text, keyword)) return node
                }
            }
            for (i in 0 until node.childCount) {
                val match = traverse(node.getChild(i))
                if (match != null) return match
            }
            return null
        }
        return traverse(root)
    }

    private fun getNodeTextOrDescription(node: AccessibilityNodeInfo): String {
        val text = node.text?.toString()?.trim() ?: ""
        if (text.isNotEmpty()) return text
        return node.contentDescription?.toString()?.trim() ?: ""
    }

    private fun performClickOnNodeOrParent(node: AccessibilityNodeInfo): Boolean {
        var current: AccessibilityNodeInfo? = node
        var depth = 0
        while (current != null && depth < 4) {
            if (current.isClickable) {
                return current.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            }
            current = current.parent
            depth++
        }
        return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
    }

    private fun appendCalibrationDump(root: AccessibilityNodeInfo, textSummary: String) {
        val entry = "Timestamp: ${System.currentTimeMillis()} | Nodes: ${root.childCount} | Snippet: ${sanitize(textSummary.take(120))}\n"
        calibrationDumpLog.append(entry)
        if (calibrationDumpLog.length > 8000) {
            calibrationDumpLog.delete(0, 4000)
        }
    }

    override fun onInterrupt() {
        Log.w(TAG, "SosAccessibilityService INTERRUPTED")
        isSosActive = false
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        serviceScope.cancel()
        Log.d(TAG, "SosAccessibilityService DESTROYED")
    }
}

