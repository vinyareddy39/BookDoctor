package com.sosride.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sosride.app.data.model.SosPhase
import com.sosride.app.data.repository.ContactRepository
import com.sosride.app.ui.screens.BookingProgressScreen
import com.sosride.app.ui.screens.CountdownScreen
import com.sosride.app.ui.screens.HomeScreen
import com.sosride.app.ui.screens.OnboardingPermissionsScreen
import com.sosride.app.ui.screens.SettingsContactsScreen
import com.sosride.app.ui.screens.TimeoutAlertScreen
import com.sosride.app.ui.theme.DarkBackground
import com.sosride.app.ui.theme.SosRideTheme
import com.sosride.app.ui.viewmodel.ScreenState
import com.sosride.app.ui.viewmodel.SosViewModel
import com.sosride.app.util.PermissionUtils

class MainActivity : ComponentActivity() {

    private lateinit var contactRepository: ContactRepository
    private lateinit var viewModel: SosViewModel

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        viewModel.refreshPermissions(this)
        if (PermissionUtils.hasAllRuntimePermissions(this)) {
            viewModel.navigateTo(ScreenState.HOME)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        contactRepository = ContactRepository(this)
        viewModel = SosViewModel(contactRepository)

        setContent {
            SosRideTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = DarkBackground
                ) {
                    SosRideApp(
                        viewModel = viewModel,
                        onRequestPermissions = {
                            permissionLauncher.launch(PermissionUtils.REQUIRED_PERMISSIONS)
                        },
                        onOpenAccessibilitySettings = {
                            PermissionUtils.openAccessibilitySettings(this)
                        }
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.refreshPermissions(this)
    }
}

@Composable
fun SosRideApp(
    viewModel: SosViewModel,
    onRequestPermissions: () -> Unit,
    onOpenAccessibilitySettings: () -> Unit
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val screenState by viewModel.screenState.collectAsState()
    val emergencyContacts by viewModel.emergencyContacts.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.refreshPermissions(context)
    }

    // 1. If an SOS Emergency or countdown is underway, show the corresponding emergency screens
    when (val phase = uiState.phase) {
        is SosPhase.Countdown -> {
            CountdownScreen(
                secondsLeft = phase.secondsLeft,
                onCancel = { viewModel.cancelSos(context) },
                onCallAmbulance = { viewModel.dialAmbulance108(context) }
            )
            return
        }

        is SosPhase.TimeoutAlert -> {
            TimeoutAlertScreen(
                reason = phase.reason,
                onCall108 = { viewModel.dialAmbulance108(context) },
                onCall112 = { viewModel.dialNationalEmergency112(context) },
                onRetry = {
                    viewModel.dismissSuccessOrAlert()
                    viewModel.triggerSos(context)
                },
                onDismiss = { viewModel.dismissSuccessOrAlert() }
            )
            return
        }

        is SosPhase.Failed -> {
            TimeoutAlertScreen(
                reason = "Emergency dispatch error: ${phase.errorMessage}",
                onCall108 = { viewModel.dialAmbulance108(context) },
                onCall112 = { viewModel.dialNationalEmergency112(context) },
                onRetry = {
                    viewModel.dismissSuccessOrAlert()
                    viewModel.triggerSos(context)
                },
                onDismiss = { viewModel.dismissSuccessOrAlert() }
            )
            return
        }

        is SosPhase.AcquiringLocation,
        is SosPhase.FindingHospital,
        is SosPhase.SendingAlerts,
        is SosPhase.DispatchingUber,
        is SosPhase.AutomationActive,
        is SosPhase.Confirmed -> {
            BookingProgressScreen(
                phase = phase,
                userLat = uiState.userLatitude,
                userLng = uiState.userLongitude,
                hospital = uiState.nearestHospital,
                smsSentCount = uiState.smsSentCount,
                onCallAmbulance = { viewModel.dialAmbulance108(context) },
                onCancelSos = { viewModel.cancelSos(context) },
                onDismissSuccess = { viewModel.dismissSuccessOrAlert() }
            )
            return
        }

        SosPhase.Idle,
        SosPhase.Cancelled -> {
            // Normal navigation between screens
            when (screenState) {
                ScreenState.ONBOARDING -> {
                    OnboardingPermissionsScreen(
                        hasLocationPermission = uiState.hasLocationPermission,
                        hasSmsPermission = uiState.hasSmsPermission,
                        hasCallPermission = uiState.hasCallPermission,
                        isAccessibilityEnabled = uiState.isAccessibilityEnabled,
                        onRequestPermissions = onRequestPermissions,
                        onOpenAccessibilitySettings = onOpenAccessibilitySettings,
                        onContinue = { viewModel.navigateTo(ScreenState.HOME) }
                    )
                }

                ScreenState.SETTINGS -> {
                    SettingsContactsScreen(
                        contacts = emergencyContacts,
                        onAddContact = { name, phone -> viewModel.addContact(name, phone) },
                        onDeleteContact = { id -> viewModel.deleteContact(id) },
                        onBack = { viewModel.navigateTo(ScreenState.HOME) }
                    )
                }

                ScreenState.HOME -> {
                    HomeScreen(
                        isAccessibilityEnabled = uiState.isAccessibilityEnabled,
                        isUberInstalled = uiState.isUberInstalled,
                        contactsCount = emergencyContacts.size,
                        onSosClick = { viewModel.triggerSos(context) },
                        onCallAmbulanceClick = { viewModel.dialAmbulance108(context) },
                        onOpenAccessibilitySettings = onOpenAccessibilitySettings,
                        onOpenSettings = { viewModel.navigateTo(ScreenState.SETTINGS) }
                    )
                }
            }
        }
    }
}
