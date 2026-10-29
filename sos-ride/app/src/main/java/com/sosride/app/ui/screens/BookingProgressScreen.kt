package com.sosride.app.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Message
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sosride.app.data.model.Hospital
import com.sosride.app.data.model.SosPhase
import com.sosride.app.state.SosStateManager
import com.sosride.app.ui.components.CallAmbulanceBar
import com.sosride.app.ui.theme.AmbulanceGreen
import com.sosride.app.ui.theme.DarkBackground
import com.sosride.app.ui.theme.DarkSurface
import com.sosride.app.ui.theme.DarkSurfaceVariant
import com.sosride.app.ui.theme.RedDark
import com.sosride.app.ui.theme.RedLight
import com.sosride.app.ui.theme.RedPrimary
import com.sosride.app.ui.theme.SuccessGreen
import com.sosride.app.ui.theme.TextMuted
import com.sosride.app.ui.theme.TextWhite
import com.sosride.app.ui.theme.WarningYellow

@Composable
fun BookingProgressScreen(
    phase: SosPhase,
    userLat: Double?,
    userLng: Double?,
    hospital: Hospital?,
    smsSentCount: Int,
    onCallAmbulance: () -> Unit,
    onCancelSos: () -> Unit,
    onDismissSuccess: () -> Unit
) {
    val isConfirmed = phase is SosPhase.Confirmed
    val currentAutomationStep = when (phase) {
        is SosPhase.AutomationActive -> phase.currentAction
        is SosPhase.DispatchingUber -> "Launching Uber app..."
        else -> "Preparing ride request..."
    }
    val elapsedSeconds = when (phase) {
        is SosPhase.AutomationActive -> phase.elapsedSeconds
        else -> 0
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(horizontal = 20.dp, vertical = 16.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header Status
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                if (isConfirmed) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = SuccessGreen,
                        modifier = Modifier.size(32.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "RIDE CONFIRMED!",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Black,
                        color = SuccessGreen
                    )
                } else {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 3.dp,
                        color = RedPrimary
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "EMERGENCY IN PROGRESS",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = RedLight
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            if (!isConfirmed) {
                Text(
                    text = "Automated Watchdog: ${elapsedSeconds}s / ${SosStateManager.WATCHDOG_TIMEOUT_SECONDS}s timeout",
                    fontSize = 12.sp,
                    color = WarningYellow,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Step 1: Location Fix
            ProgressStepCard(
                icon = Icons.Default.LocationOn,
                title = "1. Live GPS Location",
                subtitle = if (userLat != null && userLng != null) {
                    String.format("%.5f, %.5f (High Accuracy)", userLat, userLng)
                } else "Acquiring GPS fix...",
                isCompleted = userLat != null,
                isLoading = phase is SosPhase.AcquiringLocation
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Step 2: Emergency Hospital
            ProgressStepCard(
                icon = Icons.Default.LocalHospital,
                title = "2. Nearest Emergency Hospital",
                subtitle = if (hospital != null) {
                    "${hospital.name}\n${hospital.formattedDistance} away • ${hospital.source}"
                } else "Locating nearest ER facility...",
                isCompleted = hospital != null,
                isLoading = phase is SosPhase.FindingHospital
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Step 3: Emergency SMS Alerts
            ProgressStepCard(
                icon = Icons.Default.Message,
                title = "3. Emergency SMS Broadcast",
                subtitle = if (smsSentCount > 0) {
                    "Sent Google Maps link to $smsSentCount contact(s)"
                } else "Sending alerts to registered family contacts...",
                isCompleted = smsSentCount > 0,
                isLoading = phase is SosPhase.SendingAlerts
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Step 4: Uber Automated Booking
            ProgressStepCard(
                icon = Icons.Default.DirectionsCar,
                title = "4. Uber Autonomous Booking",
                subtitle = if (isConfirmed) {
                    (phase as SosPhase.Confirmed).confirmationDetails
                } else {
                    currentAutomationStep
                },
                isCompleted = isConfirmed,
                isLoading = !isConfirmed && (phase is SosPhase.DispatchingUber || phase is SosPhase.AutomationActive)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Success Card Details
            if (isConfirmed) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = AmbulanceGreen.copy(alpha = 0.2f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Driver Match Underway",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = SuccessGreen
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "The Uber app is open in background. Please check the Uber app to track the vehicle's arrival.",
                            fontSize = 13.sp,
                            color = TextWhite
                        )
                    }
                }
            }
        }

        // Action Section
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (isConfirmed) {
                Button(
                    onClick = onDismissSuccess,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = AmbulanceGreen)
                ) {
                    Text(
                        text = "RETURN TO HOME",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            } else {
                OutlinedButton(
                    onClick = onCancelSos,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = "CANCEL SOS DISPATCH",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = RedLight
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Persistent 108 dialer
            CallAmbulanceBar(onCallClick = onCallAmbulance)
        }
    }
}

@Composable
private fun ProgressStepCard(
    icon: ImageVector,
    title: String,
    subtitle: String,
    isCompleted: Boolean,
    isLoading: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = DarkSurface)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(
                        when {
                            isCompleted -> SuccessGreen.copy(alpha = 0.2f)
                            isLoading -> RedPrimary.copy(alpha = 0.2f)
                            else -> DarkSurfaceVariant
                        }
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = when {
                        isCompleted -> SuccessGreen
                        isLoading -> RedPrimary
                        else -> TextMuted
                    },
                    modifier = Modifier.size(20.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextWhite
                )
                Text(
                    text = subtitle,
                    fontSize = 12.sp,
                    color = if (isCompleted) TextWhite else TextMuted
                )
            }

            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = RedPrimary
                )
            } else if (isCompleted) {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = "Completed",
                    tint = SuccessGreen,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}
