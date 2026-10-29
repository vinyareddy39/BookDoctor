package com.sosride.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sosride.app.ui.components.BigRedSosButton
import com.sosride.app.ui.components.CallAmbulanceBar
import com.sosride.app.ui.theme.DarkBackground
import com.sosride.app.ui.theme.DarkSurface
import com.sosride.app.ui.theme.DarkSurfaceVariant
import com.sosride.app.ui.theme.RedLight
import com.sosride.app.ui.theme.RedPrimary
import com.sosride.app.ui.theme.SuccessGreen
import com.sosride.app.ui.theme.TextMuted
import com.sosride.app.ui.theme.TextWhite
import com.sosride.app.ui.theme.WarningYellow

@Composable
fun HomeScreen(
    isAccessibilityEnabled: Boolean,
    isUberInstalled: Boolean,
    contactsCount: Int,
    onSosClick: () -> Unit,
    onCallAmbulanceClick: () -> Unit,
    onOpenAccessibilitySettings: () -> Unit,
    onOpenSettings: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(horizontal = 20.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Top App Bar
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "SOS Ride",
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Black,
                    color = TextWhite,
                    letterSpacing = 0.5.sp
                )
                Text(
                    text = "Autonomous Emergency Transport",
                    fontSize = 12.sp,
                    color = TextMuted
                )
            }

            IconButton(
                onClick = onOpenSettings,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(DarkSurfaceVariant)
            ) {
                Icon(
                    imageVector = Icons.Default.Settings,
                    contentDescription = "Settings",
                    tint = TextWhite
                )
            }
        }

        // Status Card / Warnings
        Column(modifier = Modifier.fillMaxWidth()) {
            if (contactsCount == 0) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpenSettings() },
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = RedPrimary.copy(alpha = 0.2f))
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Warning,
                            contentDescription = null,
                            tint = RedLight,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "No Emergency Contacts Added",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = RedLight
                            )
                            Text(
                                text = "SMS alerts will be skipped. Emergency ride will still proceed. Tap to add.",
                                fontSize = 11.sp,
                                color = TextWhite
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(10.dp))
            }

            if (!isAccessibilityEnabled) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpenAccessibilitySettings() },
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = WarningYellow.copy(alpha = 0.15f))
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Warning,
                            contentDescription = null,
                            tint = WarningYellow,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Accessibility Service Disabled",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = WarningYellow
                            )
                            Text(
                                text = "Tap here to enable autonomous Uber ride booking.",
                                fontSize = 11.sp,
                                color = TextWhite
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(10.dp))
            }

            // Quick Status Chips
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                StatusChip(
                    label = if (isAccessibilityEnabled) "Auto-Book Ready" else "Manual Confirm Only",
                    isGood = isAccessibilityEnabled,
                    modifier = Modifier.weight(1f)
                )
                StatusChip(
                    label = if (isUberInstalled) "Uber App" else "Uber Web",
                    isGood = true,
                    modifier = Modifier.weight(1f)
                )
                StatusChip(
                    label = "$contactsCount Contacts",
                    isGood = contactsCount > 0,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Main Red SOS Button
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(vertical = 12.dp)
        ) {
            BigRedSosButton(onClick = onSosClick)

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Tap to instantly locate nearest emergency hospital, dispatch Uber & alert family.",
                fontSize = 13.sp,
                color = TextMuted,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.padding(horizontal = 24.dp)
            )
        }

        // Persistent 108 Helpline at bottom
        CallAmbulanceBar(onCallClick = onCallAmbulanceClick)
    }
}

@Composable
private fun StatusChip(
    label: String,
    isGood: Boolean,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = DarkSurface)
    ) {
        Row(
            modifier = Modifier
                .padding(vertical = 8.dp, horizontal = 10.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(if (isGood) SuccessGreen else WarningYellow)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = TextWhite,
                maxLines = 1
            )
        }
    }
}
