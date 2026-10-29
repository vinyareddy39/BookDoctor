package com.sosride.app.service

import android.content.Context
import android.os.Build
import android.telephony.SmsManager
import android.util.Log
import com.sosride.app.data.model.EmergencyContact

class SmsSender(private val context: Context) {

    companion object {
        private const val TAG = "SmsSender"
    }

    private fun getSmsManager(): SmsManager {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(SmsManager::class.java)
        } else {
            @Suppress("DEPRECATION")
            SmsManager.getDefault()
        }
    }

    /**
     * Initial SMS sent BEFORE hospital lookup.
     * Guaranteed to be dispatched so contacts get the user's location immediately.
     */
    fun sendLocationAlert(
        contacts: List<EmergencyContact>,
        userLat: Double,
        userLng: Double
    ): Int {
        if (contacts.isEmpty()) {
            return 0
        }

        val mapsLink = "https://maps.google.com/?q=$userLat,$userLng"
        val message = "🚨 EMERGENCY SOS! I need help. My location: $mapsLink"
        return sendToContacts(contacts, message)
    }

    /**
     * Second short follow-up SMS sent once the destination hospital is identified.
     */
    fun sendHospitalUpdate(
        contacts: List<EmergencyContact>,
        hospitalName: String
    ): Int {
        if (contacts.isEmpty()) {
            return 0
        }

        val message = "Nearest emergency hospital: $hospitalName"
        return sendToContacts(contacts, message)
    }

    /**
     * Third SMS sent when the 45-second watchdog timer expires without ride confirmation.
     */
    fun sendWatchdogFailedAlert(
        contacts: List<EmergencyContact>
    ): Int {
        if (contacts.isEmpty()) {
            return 0
        }

        val message = "Ride could not be confirmed. Please call me or send help."
        return sendToContacts(contacts, message)
    }

    /**
     * Fallback SMS sent when GPS location lookup fails.
     */
    fun sendLocationUnavailableAlert(
        contacts: List<EmergencyContact>
    ): Int {
        if (contacts.isEmpty()) {
            return 0
        }

        val message = "SOS - location unavailable, please call me"
        return sendToContacts(contacts, message)
    }

    /**
     * Sends SMS without logging phone numbers or message bodies. Only contact name is logged.
     */
    private fun sendToContacts(contacts: List<EmergencyContact>, message: String): Int {
        val smsManager = getSmsManager()
        var successCount = 0

        for (contact in contacts) {
            val phone = contact.phoneNumber.trim()
            if (phone.isNotBlank()) {
                try {
                    Log.d(TAG, "Dispatching SMS to ${contact.name}")
                    val parts = smsManager.divideMessage(message)
                    if (parts.size > 1) {
                        smsManager.sendMultipartTextMessage(phone, null, parts, null, null)
                    } else {
                        smsManager.sendTextMessage(phone, null, message, null, null)
                    }
                    successCount++
                    Log.d(TAG, "Successfully sent SMS to ${contact.name}")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed sending SMS to ${contact.name}: ${e.message}")
                }
            }
        }
        return successCount
    }
}
