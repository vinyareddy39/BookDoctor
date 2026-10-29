package com.sosride.app.ui.screens

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
import androidx.compose.material.icons.filled.Accessibility
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Message
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import com.sosride.app.ui.theme.AmbulanceGreen
import com.sosride.app.ui.theme.DarkBackground
import com.sosride.app.ui.theme.DarkSurface
import com.sosride.app.ui.theme.DarkSurfaceVariant
import com.sosride.app.ui.theme.RedPrimary
import com.sosride.app.ui.theme.SuccessGreen
import com.sosride.app.ui.theme.TextMuted
import com.sosride.app.ui.theme.TextWhite
import com.sosride.app.ui.theme.WarningYellow

@Composable
fun OnboardingPermissionsScreen(
    hasLocationPermission: Boolean,
    hasSmsPermission: Boolean,
    hasCallPermission: Boolean,
    isAccessibilityEnabled: Boolean,
    onRequestPermissions: () -> Unit,
    onOpenAccessibilitySettings: () -> Unit,
    onContinue: () -> Unit
) {
    val allPermissionsGranted = hasLocationPermission && hasSmsPermission && hasCallPermission
    val isFullyReady = allPermissionsGranted && isAccessibilityEnabled

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(horizontal = 24.dp, vertical = 20.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(16.dp))

        // Header
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(RedPrimary.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = RedPrimary,
                modifier = Modifier.size(36.dp)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Emergency Setup",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = TextWhite
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "SOS Ride requires specific permissions and accessibility access to automatically order an emergency Uber ride and dispatch alerts with zero extra taps.",
            fontSize = 14.sp,
            color = TextMuted,
            modifier = Modifier.padding(horizontal = 8.dp)
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Permission Card: Location
        PermissionRow(
            icon = Icons.Default.LocationOn,
            title = "1. Precise Location",
            description = "Locates you instantly to identify the nearest emergency hospital and set the Uber pickup pin.",
            isGranted = hasLocationPermission
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Permission Card: SMS
        PermissionRow(
            icon = Icons.Default.Message,
            title = "2. Emergency SMS",
            description = "Sends your live Google Maps coordinates and hospital destination to your emergency contacts.",
            isGranted = hasSmsPermission
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Permission Card: Phone Call
        PermissionRow(
            icon = Icons.Default.Phone,
            title = "3. Phone Call",
            description = "Provides direct 1-tap dialing to the 108 Ambulance helpline in life-threatening scenarios.",
            isGranted = hasCallPermission
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Request Permissions Button
        if (!allPermissionsGranted) {
            Button(
                onClick = onRequestPermissions,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = RedPrimary)
            ) {
                Text(
                    text = "Grant Required Permissions",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Step 4: Accessibility Service (Essential for Uber automation)
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(
                containerColor = if (isAccessibilityEnabled) DarkSurface else DarkSurfaceVariant
            )
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(if (isAccessibilityEnabled) SuccessGreen.copy(alpha = 0.2f) else WarningYellow.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Accessibility,
                            contentDescription = null,
                            tint = if (isAccessibilityEnabled) SuccessGreen else WarningYellow,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "4. Accessibility Service",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextWhite
                        )
                        Text(
                            text = if (isAccessibilityEnabled) "Active & Ready" else "Requires manual activation",
                            fontSize = 12.sp,
                            color = if (isAccessibilityEnabled) SuccessGreen else WarningYellow
                        )
                    }
                    if (isAccessibilityEnabled) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = "Enabled",
                            tint = SuccessGreen
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Required to automatically detect Uber's ride screen, choose the fastest/cheapest option, and tap Confirm without extra user intervention.",
                    fontSize = 13.sp,
                    color = TextMuted
                )

                if (!isAccessibilityEnabled) {
                    Spacer(modifier = Modifier.height(14.dp))
                    OutlinedButton(
                        onClick = onOpenAccessibilitySettings,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            text = "Open Accessibility Settings",
                            fontWeight = FontWeight.SemiBold,
                            color = WarningYellow
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(30.dp))

        // Continue Button
        Button(
            onClick = onContinue,
            enabled = allPermissionsGranted,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = AmbulanceGreen,
                disabledContainerColor = DarkSurfaceVariant
            )
        ) {
            Text(
                text = if (isFullyReady) "Enter SOS Ride" else if (allPermissionsGranted) "Continue (Accessibility Recommended)" else "Grant Permissions Above",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        Spacer(modifier = Modifier.height(20.dp))
    }
}

@Composable
private fun PermissionRow(
    icon: ImageVector,
    title: String,
    description: String,
    isGranted: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = DarkSurface)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(if (isGranted) SuccessGreen.copy(alpha = 0.2f) else DarkSurfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = if (isGranted) SuccessGreen else TextMuted,
                    modifier = Modifier.size(22.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextWhite
                )
                Text(
                    text = description,
                    fontSize = 12.sp,
                    color = TextMuted
                )
            }

            if (isGranted) {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = "Granted",
                    tint = SuccessGreen,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}
