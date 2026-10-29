package com.sosride.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.sosride.app.MainActivity
import com.sosride.app.R
import com.sosride.app.data.model.SosPhase
import com.sosride.app.data.repository.ContactRepository
import com.sosride.app.data.repository.HospitalRepository
import com.sosride.app.data.repository.LocationRepository
import com.sosride.app.state.SosStateManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class SosForegroundService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())
    private lateinit var locationRepo: LocationRepository
    private lateinit var hospitalRepo: HospitalRepository
    private lateinit var contactRepo: ContactRepository
    private lateinit var smsSender: SmsSender

    companion object {
        private const val TAG = "SosForegroundService"
        private const val NOTIFICATION_ID = 9110
        private const val ALERT_NOTIFICATION_ID = 9115

        private const val CHANNEL_ID = "sos_emergency_channel"
        private const val ALERT_CHANNEL_ID = "sos_action_alert_channel"

        const val ACTION_START_EMERGENCY = "com.sosride.app.action.START_EMERGENCY"
        const val ACTION_CANCEL_EMERGENCY = "com.sosride.app.action.CANCEL_EMERGENCY"
        const val ACTION_UPDATE_NOTIFICATION = "com.sosride.app.action.UPDATE_NOTIFICATION"
        const val ACTION_ALERT_NOTIFICATION = "com.sosride.app.action.ALERT_NOTIFICATION"
        const val EXTRA_STATUS_TEXT = "extra_status_text"
        const val EXTRA_ALERT_TEXT = "extra_alert_text"

        fun startEmergency(context: Context) {
            try {
                val intent = Intent(context, SosForegroundService::class.java).apply {
                    action = ACTION_START_EMERGENCY
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start emergency service: ${e.message}", e)
            }
        }

        fun updateStatusNotification(context: Context, statusText: String) {
            try {
                val intent = Intent(context, SosForegroundService::class.java).apply {
                    action = ACTION_UPDATE_NOTIFICATION
                    putExtra(EXTRA_STATUS_TEXT, statusText)
                }
                context.startService(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to update status notification: ${e.message}", e)
            }
        }

        fun updateAlertNotification(context: Context, statusText: String) {
            try {
                val intent = Intent(context, SosForegroundService::class.java).apply {
                    action = ACTION_ALERT_NOTIFICATION
                    putExtra(EXTRA_ALERT_TEXT, statusText)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send alert notification: ${e.message}", e)
            }
        }

        fun stopEmergency(context: Context) {
            try {
                val intent = Intent(context, SosForegroundService::class.java).apply {
                    action = ACTION_CANCEL_EMERGENCY
                }
                context.startService(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to stop emergency service: ${e.message}", e)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        locationRepo = LocationRepository(this)
        hospitalRepo = HospitalRepository()
        contactRepo = ContactRepository(this)
        smsSender = SmsSender(this)
        createNotificationChannels()

        // Hook up 45s watchdog failure SMS alert
        SosStateManager.setOnWatchdogTimeoutListener {
            val contacts = contactRepo.getContacts()
            if (contacts.isNotEmpty()) {
                smsSender.sendWatchdogFailedAlert(contacts)
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        Log.d(TAG, "onStartCommand received action: $action")

        when (action) {
            ACTION_CANCEL_EMERGENCY -> {
                SosStateManager.cancelSos()
                stopForeground(true)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_UPDATE_NOTIFICATION -> {
                val statusText = intent.getStringExtra(EXTRA_STATUS_TEXT) ?: "SOS Ride Active"
                updateNotification(statusText)
                return START_STICKY
            }
            ACTION_ALERT_NOTIFICATION -> {
                val alertText = intent.getStringExtra(EXTRA_ALERT_TEXT) ?: "Action required in Uber"
                showHighImportanceAlert(alertText)
                return START_STICKY
            }
            ACTION_START_EMERGENCY -> {
                startForegroundNotification("SOS Triggered - Locating Emergency Hospital...")
                executeEmergencyFlow()
            }
        }

        return START_STICKY
    }

    private fun startForegroundNotification(statusText: String) {
        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingOpen = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val call108Intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:108")).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        val pendingCall = PendingIntent.getActivity(
            this,
            1,
            call108Intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val cancelIntent = Intent(this, SosForegroundService::class.java).apply {
            action = ACTION_CANCEL_EMERGENCY
        }
        val pendingCancel = PendingIntent.getService(
            this,
            2,
            cancelIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🚨 SOS RIDE ACTIVE")
            .setContentText(statusText)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(pendingOpen)
            .addAction(android.R.drawable.ic_menu_call, "Call 108", pendingCall)
            .addAction(android.R.drawable.ic_delete, "Cancel SOS", pendingCancel)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun updateNotification(statusText: String) {
        val manager = getSystemService(NotificationManager::class.java)
        val openAppIntent = Intent(this, MainActivity::class.java)
        val pendingOpen = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🚨 SOS RIDE ACTIVE")
            .setContentText(statusText)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setContentIntent(pendingOpen)
            .build()

        manager?.notify(NOTIFICATION_ID, notification)
    }

    private fun showHighImportanceAlert(alertText: String) {
        val manager = getSystemService(NotificationManager::class.java)
        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingOpen = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
            .setContentTitle("⚠️ Action Required in Uber")
            .setContentText(alertText)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVibrate(longArrayOf(0, 500, 200, 500))
            .setContentIntent(pendingOpen)
            .setAutoCancel(true)
            .build()

        manager?.notify(ALERT_NOTIFICATION_ID, notification)
    }

    private fun executeEmergencyFlow() {
        serviceScope.launch {
            try {
                val contacts = contactRepo.getContacts()

                // Step 1: Acquire Location
                SosStateManager.setPhase(SosPhase.AcquiringLocation)
                updateNotification("Getting high-accuracy GPS coordinates...")
                val locationResult = locationRepo.getCurrentLocation()

                if (locationResult.isFailure) {
                    val error = locationResult.exceptionOrNull()?.message ?: "Failed to acquire GPS location"
                    // Send location unavailable fallback SMS to contacts
                    if (contacts.isNotEmpty()) {
                        smsSender.sendLocationUnavailableAlert(contacts)
                    }
                    SosStateManager.setPhase(SosPhase.Failed(error))
                    updateNotification("Error: $error. Call 108 immediately.")
                    return@launch
                }

                val location = locationResult.getOrThrow()
                SosStateManager.setLocation(location.latitude, location.longitude)

                // Step 2: Send Emergency Location SMS BEFORE Hospital Lookup
                // Guarantees contacts get the user's location immediately even if hospital lookup fails
                if (contacts.isNotEmpty()) {
                    SosStateManager.setPhase(SosPhase.SendingAlerts)
                    updateNotification("Sending emergency live location SMS...")
                    val smsCount = smsSender.sendLocationAlert(contacts, location.latitude, location.longitude)
                    SosStateManager.setSmsResults(smsCount, contacts.map { it.phoneNumber })
                } else {
                    Log.w(TAG, "No emergency contacts configured; proceeding with ride flow and skipping SMS.")
                }

                // Step 3: Find nearest hospital with emergency department
                SosStateManager.setPhase(SosPhase.FindingHospital)
                updateNotification("Locating nearest Emergency Hospital...")
                val hospitalResult = hospitalRepo.getNearestEmergencyHospital(location.latitude, location.longitude)

                if (hospitalResult.isFailure) {
                    val error = "No emergency hospital found nearby. Uber dispatch skipped. Call 108 or 112 immediately."
                    SosStateManager.setPhase(SosPhase.Failed(error))
                    updateNotification(error)
                    return@launch
                }

                val hospital = hospitalResult.getOrThrow()
                SosStateManager.setNearestHospital(hospital)

                // Send short second follow-up SMS with destination hospital name
                if (contacts.isNotEmpty()) {
                    smsSender.sendHospitalUpdate(contacts, hospital.name)
                }

                // Step 4: Launch Uber Deep Link & start 45-second watchdog timer
                SosStateManager.setPhase(SosPhase.DispatchingUber)
                updateNotification("Opening Uber to ${hospital.name}...")
                SosStateManager.startWatchdogTimer()

                val launched = UberDeepLinkManager.launchUber(
                    context = this@SosForegroundService,
                    pickupLat = location.latitude,
                    pickupLng = location.longitude,
                    dropoffLat = hospital.latitude,
                    dropoffLng = hospital.longitude,
                    dropoffName = hospital.name
                )

                if (!launched) {
                    SosStateManager.onAutomationFailed("Unable to launch Uber deep link or web fallback.")
                } else {
                    SosStateManager.setPhase(SosPhase.AutomationActive("Uber launched, waiting for ride screen...", 0))
                    updateNotification("Automating Uber booking to ${hospital.name}...")
                }

            } catch (e: Exception) {
                Log.e(TAG, "Error in emergency workflow", e)
                SosStateManager.setPhase(SosPhase.Failed(e.message ?: "Unknown emergency workflow error"))
            }
        }
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)

            // Ongoing status channel
            val ongoingChannel = NotificationChannel(
                CHANNEL_ID,
                "SOS Emergency Service",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Shows live emergency dispatch status and call ambulance shortcut"
                enableVibration(true)
            }
            manager?.createNotificationChannel(ongoingChannel)

            // High-importance alert channel with vibration
            val alertChannel = NotificationChannel(
                ALERT_CHANNEL_ID,
                "SOS Action Required Alert",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "High-importance alerts requiring user action in Uber"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500)
            }
            manager?.createNotificationChannel(alertChannel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        Log.d(TAG, "SosForegroundService destroyed")
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
