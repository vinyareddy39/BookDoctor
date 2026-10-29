package com.sosride.app.state

import android.util.Log
import com.sosride.app.data.model.Hospital
import com.sosride.app.data.model.SosPhase
import com.sosride.app.data.model.SosUiState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

object SosStateManager {

    private const val TAG = "SosStateManager"

    // Configurable constants
    const val CANCEL_COUNTDOWN_SECONDS = 5 // Set to 0 to disable countdown
    const val WATCHDOG_TIMEOUT_SECONDS = 45 // 45 seconds watchdog timeout for Uber confirmation

    private val _uiState = MutableStateFlow(SosUiState())
    val uiState: StateFlow<SosUiState> = _uiState.asStateFlow()

    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private var watchdogJob: Job? = null
    private var elapsedJob: Job? = null
    private var countdownJob: Job? = null
    private var onWatchdogTimeout: (() -> Unit)? = null

    fun setOnWatchdogTimeoutListener(listener: (() -> Unit)?) {
        onWatchdogTimeout = listener
    }

    val isSosActive: Boolean
        get() = _uiState.value.isSosActive

    fun addLog(entry: String) {
        Log.d(TAG, entry)
        _uiState.update { current ->
            current.copy(logs = (current.logs + entry).takeLast(40))
        }
    }

    fun updatePermissions(
        location: Boolean,
        sms: Boolean,
        call: Boolean,
        accessibility: Boolean,
        uberInstalled: Boolean
    ) {
        _uiState.update {
            it.copy(
                hasLocationPermission = location,
                hasSmsPermission = sms,
                hasCallPermission = call,
                isAccessibilityEnabled = accessibility,
                isUberInstalled = uberInstalled
            )
        }
    }

    fun startSosCountdown(onCountdownComplete: () -> Unit) {
        if (CANCEL_COUNTDOWN_SECONDS <= 0) {
            addLog("Countdown disabled (0s). Initiating emergency pipeline immediately.")
            onCountdownComplete()
            return
        }

        countdownJob?.cancel()
        countdownJob = scope.launch {
            addLog("SOS Triggered! Starting $CANCEL_COUNTDOWN_SECONDS second cancel countdown...")
            for (i in CANCEL_COUNTDOWN_SECONDS downTo 1) {
                _uiState.update { it.copy(phase = SosPhase.Countdown(i)) }
                delay(1000L)
            }
            addLog("Countdown finished. Executing emergency dispatch.")
            onCountdownComplete()
        }
    }

    fun startWatchdogTimer() {
        watchdogJob?.cancel()
        elapsedJob?.cancel()

        var elapsed = 0
        elapsedJob = scope.launch {
            while (true) {
                delay(1000L)
                elapsed++
                if (_uiState.value.phase is SosPhase.AutomationActive) {
                    val currentAction = (_uiState.value.phase as SosPhase.AutomationActive).currentAction
                    _uiState.update { it.copy(phase = SosPhase.AutomationActive(currentAction, elapsed)) }
                }
            }
        }

        watchdogJob = scope.launch {
            addLog("Started 45-second watchdog timer for Uber confirmation...")
            delay(WATCHDOG_TIMEOUT_SECONDS * 1000L)

            val currentPhase = _uiState.value.phase
            if (currentPhase is SosPhase.DispatchingUber || currentPhase is SosPhase.AutomationActive) {
                val warning = "Watchdog triggered: Uber booking not confirmed within ${WATCHDOG_TIMEOUT_SECONDS}s. Showing Emergency Alert."
                addLog(warning)
                _uiState.update { it.copy(phase = SosPhase.TimeoutAlert(warning)) }
                onWatchdogTimeout?.invoke()
            }
        }
    }

    fun cancelWatchdog() {
        watchdogJob?.cancel()
        watchdogJob = null
        elapsedJob?.cancel()
        elapsedJob = null
    }

    fun cancelSos() {
        addLog("SOS Emergency cancelled by user.")
        countdownJob?.cancel()
        cancelWatchdog()
        _uiState.update { it.copy(phase = SosPhase.Cancelled) }
    }

    fun resetToIdle() {
        cancelWatchdog()
        countdownJob?.cancel()
        _uiState.update {
            it.copy(
                phase = SosPhase.Idle,
                nearestHospital = null,
                smsSentCount = 0,
                smsRecipients = emptyList()
            )
        }
    }

    fun setLocation(lat: Double, lng: Double) {
        addLog("User location updated: $lat, $lng")
        _uiState.update { it.copy(userLatitude = lat, userLongitude = lng) }
    }

    fun setNearestHospital(hospital: Hospital) {
        addLog("Nearest hospital: ${hospital.name} (${hospital.formattedDistance}) via ${hospital.source}")
        _uiState.update { it.copy(nearestHospital = hospital) }
    }

    fun setSmsResults(count: Int, recipients: List<String>) {
        addLog("Sent emergency SMS alerts to $count contacts: $recipients")
        _uiState.update { it.copy(smsSentCount = count, smsRecipients = recipients) }
    }

    fun setPhase(phase: SosPhase) {
        addLog("SOS Phase transition -> ${phase::class.simpleName}")
        _uiState.update { it.copy(phase = phase) }
    }

    fun onAccessibilityAction(stepDescription: String) {
        addLog("Uber Automation: $stepDescription")
        val currentElapsed = when (val p = _uiState.value.phase) {
            is SosPhase.AutomationActive -> p.elapsedSeconds
            else -> 0
        }
        _uiState.update { it.copy(phase = SosPhase.AutomationActive(stepDescription, currentElapsed)) }
    }

    fun onBookingConfirmed(driverDetails: String) {
        addLog("Uber Ride CONFIRMED! Details: $driverDetails")
        cancelWatchdog()
        _uiState.update { it.copy(phase = SosPhase.Confirmed(driverDetails)) }
    }

    fun onAutomationFailed(reason: String) {
        addLog("Uber Automation Alert: $reason")
        cancelWatchdog()
        _uiState.update { it.copy(phase = SosPhase.TimeoutAlert(reason)) }
    }
}
