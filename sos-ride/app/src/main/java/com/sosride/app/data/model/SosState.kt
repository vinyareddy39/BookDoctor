package com.sosride.app.data.model

sealed class SosPhase {
    object Idle : SosPhase()
    data class Countdown(val secondsLeft: Int) : SosPhase()
    object AcquiringLocation : SosPhase()
    object FindingHospital : SosPhase()
    object SendingAlerts : SosPhase()
    object DispatchingUber : SosPhase()
    data class AutomationActive(val currentAction: String, val elapsedSeconds: Int) : SosPhase()
    data class Confirmed(val confirmationDetails: String) : SosPhase()
    data class TimeoutAlert(val reason: String = "Uber booking took longer than 45 seconds to confirm") : SosPhase()
    data class Failed(val errorMessage: String) : SosPhase()
    object Cancelled : SosPhase()
}

data class SosUiState(
    val phase: SosPhase = SosPhase.Idle,
    val userLatitude: Double? = null,
    val userLongitude: Double? = null,
    val nearestHospital: Hospital? = null,
    val smsSentCount: Int = 0,
    val smsRecipients: List<String> = emptyList(),
    val isAccessibilityEnabled: Boolean = false,
    val hasLocationPermission: Boolean = false,
    val hasSmsPermission: Boolean = false,
    val hasCallPermission: Boolean = false,
    val isUberInstalled: Boolean = false,
    val logs: List<String> = emptyList()
) {
    val isSosActive: Boolean
        get() = phase !is SosPhase.Idle && phase !is SosPhase.Cancelled && phase !is SosPhase.Failed

    val isAutomationRunning: Boolean
        get() = phase is SosPhase.DispatchingUber || phase is SosPhase.AutomationActive
}
