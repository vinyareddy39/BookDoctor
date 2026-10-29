package com.sosride.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sosride.app.state.SosStateManager
import com.sosride.app.ui.components.CallAmbulanceBar
import com.sosride.app.ui.theme.DarkBackground
import com.sosride.app.ui.theme.DarkSurfaceVariant
import com.sosride.app.ui.theme.RedDark
import com.sosride.app.ui.theme.RedLight
import com.sosride.app.ui.theme.RedPrimary
import com.sosride.app.ui.theme.TextMuted
import com.sosride.app.ui.theme.TextWhite

@Composable
fun CountdownScreen(
    secondsLeft: Int,
    onCancel: () -> Unit,
    onCallAmbulance: () -> Unit
) {
    val totalSeconds = SosStateManager.CANCEL_COUNTDOWN_SECONDS.toFloat().coerceAtLeast(1f)
    val progress = secondsLeft / totalSeconds

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(top = 20.dp)
        ) {
            Text(
                text = "EMERGENCY ACTIVATED",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = RedLight,
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Dispatching Uber & notifying contacts in...",
                fontSize = 14.sp,
                color = TextMuted
            )
        }

        // Circular Countdown Display
        Box(
            modifier = Modifier.size(240.dp),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxSize(),
                color = RedPrimary,
                trackColor = DarkSurfaceVariant,
                strokeWidth = 14.dp,
            )

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "$secondsLeft",
                    fontSize = 72.sp,
                    fontWeight = FontWeight.Black,
                    color = TextWhite
                )
                Text(
                    text = "SECONDS",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = RedLight,
                    letterSpacing = 2.sp
                )
            }
        }

        // Action Buttons: Cancel and Ambulance
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Button(
                onClick = onCancel,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = RedDark)
            ) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = null,
                    tint = Color.White
                )
                Spacer(modifier = Modifier.size(8.dp))
                Text(
                    text = "CANCEL SOS (FALSE ALARM)",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            CallAmbulanceBar(onCallClick = onCallAmbulance)
        }
    }
}
