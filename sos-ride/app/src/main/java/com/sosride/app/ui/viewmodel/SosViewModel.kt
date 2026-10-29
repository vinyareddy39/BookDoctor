package com.sosride.app.ui.viewmodel

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sosride.app.data.model.EmergencyContact
import com.sosride.app.data.model.SosPhase
import com.sosride.app.data.model.SosUiState
import com.sosride.app.data.repository.ContactRepository
import com.sosride.app.service.SosForegroundService
import com.sosride.app.service.UberDeepLinkManager
import com.sosride.app.state.SosStateManager
import com.sosride.app.util.PermissionUtils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class ScreenState {
    ONBOARDING,
    HOME,
    SETTINGS
}

class SosViewModel(
    private val contactRepo: ContactRepository
) : ViewModel() {

    private val _screenState = MutableStateFlow(ScreenState.HOME)
    val screenState: StateFlow<ScreenState> = _screenState.asStateFlow()

    private val _emergencyContacts = MutableStateFlow<List<EmergencyContact>>(emptyList())
    val emergencyContacts: StateFlow<List<EmergencyContact>> = _emergencyContacts.asStateFlow()

    val uiState: StateFlow<SosUiState> = SosStateManager.uiState

    init {
        loadContacts()
    }

    fun loadContacts() {
        _emergencyContacts.value = contactRepo.getContacts()
    }

    fun addContact(name: String, phone: String) {
        contactRepo.addContact(name, phone)
        loadContacts()
    }

    fun deleteContact(id: String) {
        contactRepo.removeContact(id)
        loadContacts()
    }

    fun navigateTo(screen: ScreenState) {
        _screenState.value = screen
    }

    fun refreshPermissions(context: Context) {
        val loc = PermissionUtils.hasLocationPermissions(context)
        val sms = PermissionUtils.hasSmsPermission(context)
        val call = PermissionUtils.hasCallPermission(context)
        val acc = PermissionUtils.isAccessibilityServiceEnabled(context)
        val uber = UberDeepLinkManager.isUberInstalled(context)

        SosStateManager.updatePermissions(
            location = loc,
            sms = sms,
            call = call,
            accessibility = acc,
            uberInstalled = uber
        )

        // If core permissions are missing, show onboarding
        if (!PermissionUtils.hasAllRuntimePermissions(context)) {
            _screenState.value = ScreenState.ONBOARDING
        }
    }

    fun triggerSos(context: Context): Boolean {
        // Proceed with ride flow even if contacts are empty (SMS step will be skipped with home screen warning)
        if (_emergencyContacts.value.isEmpty()) {
            android.util.Log.w("SosViewModel", "Triggering SOS without emergency contacts. SMS step will be skipped.")
        }

        SosStateManager.startSosCountdown {
            SosForegroundService.startEmergency(context)
        }
        return true
    }

    fun cancelSos(context: Context) {
        SosForegroundService.stopEmergency(context)
    }

    fun dismissSuccessOrAlert() {
        SosStateManager.resetToIdle()
    }

    fun dialAmbulance108(context: Context) {
        makeDirectCall(context, "108")
    }

    fun dialNationalEmergency112(context: Context) {
        makeDirectCall(context, "112")
    }

    private fun makeDirectCall(context: Context, number: String) {
        try {
            val uri = Uri.parse("tel:$number")
            val callIntent = if (PermissionUtils.hasCallPermission(context)) {
                Intent(Intent.ACTION_CALL, uri)
            } else {
                Intent(Intent.ACTION_DIAL, uri)
            }
            callIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(callIntent)
        } catch (e: Exception) {
            Log.e("SosViewModel", "Failed to initiate emergency call to $number: ${e.message}")
        }
    }
}
